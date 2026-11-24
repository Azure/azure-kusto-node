// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { cpus } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type * as Kusto from "../../src/index.js";
import type * as Identity from "@azure/identity";
import {
    LoadConfigurationError,
    LoadValidationError,
    comparisonPassed,
    makeWorkloads,
    performanceChange,
    readOptions,
    runCase,
    safeFailure,
    summarize,
    withCachedTokens,
} from "./resultRowsLoad.js";
import type { CaseSamples, LoadLimits, LoadOptions, Variant } from "./resultRowsLoad.js";
import { assertNewOutputs, display, hash, identifyAndBuild, sdkDirectory, target } from "./resultRowsHarness.js";

const execFile = promisify(execFileCallback);
const limitsOf = ({ rows, iterations, concurrency, warmup, rounds, timeoutMs, maxDurationSeconds }: LoadLimits): LoadLimits => ({
    rows,
    iterations,
    concurrency,
    warmup,
    rounds,
    timeoutMs,
    maxDurationSeconds,
});

const worker = async (options: LoadOptions): Promise<CaseSamples[]> => {
    const { cluster, database } = target();
    const sdkFile = join(sdkDirectory(options.worker === "before" ? options.before : options.after), "index.js");
    const module: typeof Kusto = await import(pathToFileURL(sdkFile).href);
    const identity: typeof Identity = createRequire(sdkFile)("@azure/identity");
    const credential = withCachedTokens(new identity.AzureCliCredential());
    const client = new module.Client(module.KustoConnectionStringBuilder.withTokenCredential(cluster, credential));
    const runId = randomUUID();
    const results: CaseSamples[] = [];
    try {
        for (const workload of makeWorkloads(options.rows)) {
            const result = await runCase(workload, options, async (query, sequence) => {
                const properties = new module.ClientRequestProperties();
                properties.application = "azure-kusto-node-result-row-load";
                properties.clientRequestId = `NodeResultLoad;${runId};${options.worker};${options.round};${workload.id};${sequence}`;
                properties.setTimeout(options.timeoutMs);
                properties.setClientTimeout(options.timeoutMs + 5000);
                properties.setOption("query_results_cache_max_age", "00:00:00");
                const response = await client.executeQuery(database, query, properties);
                if (response.primaryResults.length !== 1) {
                    throw new Error("The synthetic query did not return exactly one primary table");
                }
                return response.primaryResults[0];
            });
            results.push(result);
            if (result.queryErrors > 0) {
                break;
            }
        }
    } finally {
        client.close();
    }
    return results;
};

const isCaseSamples = (value: unknown): value is CaseSamples => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const numbers = [
        "attempted",
        "succeeded",
        "warmupFailures",
        "queryErrors",
        "validationErrors",
        "processingErrors",
        "bytes",
        "elapsedMs",
        "cpuMs",
        "peakRssBytes",
    ];
    return (
        "workload" in value &&
        typeof value.workload === "string" &&
        numbers.every((key) => key in value && typeof Reflect.get(value, key) === "number" && Number.isFinite(Reflect.get(value, key))) &&
        ["queryMs", "modelMs", "totalMs"].every((key) => {
            const samples: unknown = Reflect.get(value, key);
            return Array.isArray(samples) && samples.every((sample: unknown) => typeof sample === "number" && Number.isFinite(sample));
        }) &&
        "failures" in value &&
        Array.isArray(value.failures)
    );
};

const runWorker = async (options: LoadOptions, variant: Variant, round: number, timeout: number): Promise<CaseSamples[]> => {
    const args = [fileURLToPath(import.meta.url), "--before", options.before, "--after", options.after, "--worker", variant, "--round", String(round)];
    for (const [key, value] of Object.entries(limitsOf(options))) {
        const flag = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        args.push(`--${flag}`, String(value));
    }
    let result: Awaited<ReturnType<typeof execFile>>;
    try {
        result = await execFile(process.execPath, args, { timeout, maxBuffer: 8 * 1024 * 1024 });
    } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "killed" in error && error.killed === true) {
            throw new LoadConfigurationError("The worker exceeded the time budget and was stopped");
        }
        if (typeof error === "object" && error !== null && "stderr" in error && typeof error.stderr === "string") {
            const detail = /Result-row load test failed: (\w+)(?: \(HTTP (\d+)\))?\./.exec(error.stderr);
            if (detail) {
                const wrapped = new Error("Worker query failed");
                wrapped.name = detail[1];
                throw Object.assign(wrapped, detail[2] ? { response: { status: Number(detail[2]) } } : {});
            }
        }
        throw error;
    }
    const samples: unknown = JSON.parse(result.stdout.toString());
    if (!Array.isArray(samples) || !samples.every(isCaseSamples)) {
        throw new Error("Worker returned an invalid report");
    }
    return samples;
};

const compare = async (options: LoadOptions): Promise<boolean> => {
    const destination = options.output;
    await assertNewOutputs([destination, `${destination}.md`]);
    const settings = limitsOf(options);
    const configured = target();
    const before = await identifyAndBuild(options.before, "before");
    const after = await identifyAndBuild(options.after, "after");
    const identicalSdk = before.compiledSdkSha256 === after.compiledSdkSha256 && before.lockfileSha256 === after.lockfileSha256;
    const workloads = makeWorkloads(options.rows);
    const runs: { variant: Variant; round: number; samples: CaseSamples[] }[] = [];
    const deadline = Date.now() + options.maxDurationSeconds * 1000;
    let fatalError: string | undefined;
    outer: for (let round = 0; round < options.rounds; round++) {
        const order: Variant[] = round % 2 === 0 ? ["before", "after"] : ["after", "before"];
        for (const variant of order) {
            process.stderr.write(`Round ${round + 1}/${options.rounds}: ${variant}\n`);
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                fatalError = "The load run exceeded its time budget";
                break outer;
            }
            try {
                const samples = await runWorker(options, variant, round, remaining);
                runs.push({ variant, round, samples });
                if (samples.length !== workloads.length || samples.some((sample) => sample.queryErrors > 0 || sample.attempted !== options.iterations)) {
                    fatalError = `${variant} stopped after a query failure; no further load was scheduled`;
                    break outer;
                }
            } catch (error: unknown) {
                const failure = safeFailure("query", error);
                fatalError =
                    error instanceof LoadConfigurationError
                        ? `${variant}: ${error.message}`
                        : `${variant} worker failed (${failure.name}${failure.status ? `, HTTP ${failure.status}` : ""}); check authentication, connectivity, and the time budget`;
                break outer;
            }
        }
    }
    const comparisons = workloads.map((workload) => {
        const select = (variant: Variant) =>
            runs.filter((run) => run.variant === variant).flatMap((run) => run.samples.filter((sample) => sample.workload === workload.id));
        const a = summarize(select("before"));
        const b = summarize(select("after"));
        const complete = a.attempted === options.iterations * options.rounds && b.attempted === options.iterations * options.rounds;
        return {
            workload: workload.id,
            expectedBaselineFailure: workload.expectedBaselineFailure,
            before: a,
            after: b,
            rowsPerSecond: { before: a.requestsPerSecond * options.rows, after: b.requestsPerSecond * options.rows },
            change: complete ? performanceChange(a, b) : null,
        };
    });
    const passed =
        !fatalError &&
        comparisons.every((comparison) =>
            comparisonPassed(comparison.before, comparison.after, options.iterations * options.rounds, comparison.expectedBaselineFailure && !identicalSdk),
        );
    const report = {
        schemaVersion: 1,
        comparisonKind: identicalSdk ? "A/A" : "A/B",
        generatedAt: new Date().toISOString(),
        targetSha256: hash(`${configured.cluster}\n${configured.database}`),
        authentication: "Azure CLI with an in-memory per-worker token cache",
        runtime: { node: process.version, platform: process.platform, architecture: process.arch, cpuCount: cpus().length },
        settings,
        revisions: { before, after },
        workloads: workloads.map(({ id, query, expectedBaselineFailure }) => ({ id, query, expectedBaselineFailure })),
        completed: fatalError === undefined,
        correctnessPassed: passed,
        fatalError,
        comparisons,
        runs,
    };
    const lines = [
        "# Result-row live load comparison",
        "",
        `Before: \`${before.revision}\`; after: \`${after.revision}\`.`,
        `Rows/query: ${options.rows}; concurrency: ${options.concurrency}; measured requests/case/revision: ${options.iterations * options.rounds}.`,
        `Completed: ${report.completed}; correctness passed: ${passed}.`,
        "",
        "| Workload | Before req/s | After req/s | Change | Before/after p95 ms | Before/after model p95 ms | Failed before/after |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ...comparisons.map(
            (item) =>
                `| ${item.workload} | ${display(item.before.requestsPerSecond)} | ${display(item.after.requestsPerSecond)} | ` +
                `${item.change ? `${display(item.change.requestsPerSecondPercent)}%` : "n/a"} | ` +
                `${display(item.before.totalMs.p95)} / ${display(item.after.totalMs.p95)} | ` +
                `${display(item.before.modelMs.p95)} / ${display(item.after.modelMs.p95)} | ` +
                `${item.before.attempted - item.before.succeeded}+${item.before.warmupFailures} / ` +
                `${item.after.attempted - item.after.succeeded}+${item.after.warmupFailures} |`,
        ),
        "",
        "Failures are measured + warm-up for each revision.",
        "",
        "## Latency percentiles (ms)",
        "",
        "| Workload | Component | Before P90 | Before P95 | Before P99 | After P90 | After P95 | After P99 |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ...comparisons.flatMap((item) =>
            (["totalMs", "queryMs", "modelMs"] as const).map(
                (component) =>
                    `| ${item.workload} | ${component} | ` +
                    `${display(item.before[component].p90)} | ${display(item.before[component].p95)} | ${display(item.before[component].p99)} | ` +
                    `${display(item.after[component].p90)} | ${display(item.after[component].p95)} | ${display(item.after[component].p99)} |`,
            ),
        ),
        "",
        "Percentiles pool individual samples across rounds. With 1-99 successful samples, nearest-rank P99 is the observed maximum.",
        "Only successful requests contribute to throughput and end-to-end/model percentiles. Deltas are omitted for failed or incomplete cases.",
        "Performance deltas are informational, not an automatic regression gate. JSON includes executeQuery latency, CPU, observed peak RSS, warm-up failures, and raw samples.",
        ...(fatalError ? ["", `Failure: ${fatalError}.`] : []),
        "",
    ];
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    await writeFile(`${destination}.md`, lines.join("\n"), { flag: "wx" });
    process.stdout.write(`${lines.join("\n")}\nJSON: ${destination}\n`);
    return passed;
};

const main = async (): Promise<void> => {
    if (process.argv.includes("--help")) {
        process.stdout.write(
            "npm run loadTest -- --before <baseline-checkout> [--after <candidate-checkout>] [--output <report.json>]\n" +
                "Options: --rows 1000 --iterations 20 --concurrency 4 --warmup 2 --rounds 3 --timeout-ms 30000 --max-duration-seconds 300\n" +
                "Requires npm ci in both checkouts, az login, ENGINE_CONNECTION_STRING, and TEST_DATABASE. " +
                `See ${join("packages", "azure-kusto-data", "test", "load", "README.md")}.\n`,
        );
        return;
    }
    const options = readOptions(process.argv.slice(2));
    if (options.worker) {
        process.stdout.write(JSON.stringify(await worker(options)));
    } else if (!(await compare(options))) {
        process.exitCode = 1;
    }
};

main().catch((error: unknown) => {
    const failure = safeFailure("query", error);
    process.stderr.write(`Result-row load test failed: ${failure.name}${failure.status ? ` (HTTP ${failure.status})` : ""}.\n`);
    if (error instanceof LoadConfigurationError || error instanceof LoadValidationError) {
        process.stderr.write(`${error.message}\n`);
    }
    process.stderr.write("Use --help for configuration and prerequisites.\n");
    process.exitCode = 1;
});
