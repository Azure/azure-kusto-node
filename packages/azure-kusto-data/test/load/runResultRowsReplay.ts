// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { cpus } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type * as Kusto from "../../src/index.js";
import type * as Response from "../../src/response.js";
import type * as Identity from "@azure/identity";
import { assertNewOutputs, display, hash, identifyAndBuild, sdkDirectory, target } from "./resultRowsHarness.js";
import { comparisonPassed, LoadConfigurationError, makeWorkloads, safeFailure, withCachedTokens } from "./resultRowsLoad.js";
import type { Variant } from "./resultRowsLoad.js";
import {
    isReplaySamples,
    cpuSamplingIntervalMicros,
    heapSamplingIntervalBytes,
    parseFixtures,
    primaryFrames,
    readReplayOptions,
    replayComponents,
    runReplayCase,
    sanitizeProfileLocations,
    summarizeReplay,
} from "./resultRowsReplay.js";
import type { ReplayFixtures, ReplayOptions, ReplaySamples } from "./resultRowsReplay.js";

const execFile = promisify(execFileCallback);
const maximumFixtureBytes = 64 * 1024 * 1024;
interface ProfileArtifact {
    workload: string;
    file: string;
    sha256: string;
}
interface WorkerResult {
    fixtureSha256: string;
    samples: ReplaySamples[];
    profiles: ProfileArtifact[];
}

const loadFixtures = async (options: ReplayOptions) => {
    if (!options.fixtures) {
        throw new LoadConfigurationError("--fixtures is required for offline replay");
    }
    if ((await stat(options.fixtures)).size > maximumFixtureBytes) {
        throw new LoadConfigurationError("Replay fixtures cannot exceed 64 MiB");
    }
    const bytes = await readFile(options.fixtures);
    if (bytes.length > maximumFixtureBytes) {
        throw new LoadConfigurationError("Replay fixtures cannot exceed 64 MiB");
    }
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    const fixtures = parseFixtures(value);
    if (fixtures.rows !== options.rows) {
        throw new LoadConfigurationError("--rows must match the captured fixture row count");
    }
    return { fixtures, fixtureSha256: hash(bytes) };
};

const capture = async (options: ReplayOptions): Promise<void> => {
    await assertNewOutputs([options.output, `${options.output}.metadata.json`]);
    const configured = target();
    const sdk = await identifyAndBuild(options.after, "after");
    const sdkFile = join(sdkDirectory(options.after), "index.js");
    const module: typeof Kusto = await import(pathToFileURL(sdkFile).href);
    const identity: typeof Identity = createRequire(sdkFile)("@azure/identity");
    const credential = withCachedTokens(new identity.AzureCliCredential());
    const client = new module.Client(module.KustoConnectionStringBuilder.withTokenCredential(configured.cluster, credential));
    const fixtures: ReplayFixtures = { schemaVersion: 1, rows: options.rows, workloads: [] };
    const runId = randomUUID();
    const deadline = Date.now() + options.maxDurationSeconds * 1000;
    try {
        for (const workload of makeWorkloads(options.rows)) {
            if (Date.now() >= deadline) {
                throw new LoadConfigurationError("Synthetic fixture capture exceeded its time budget");
            }
            const properties = new module.ClientRequestProperties();
            properties.application = "azure-kusto-node-result-row-replay-capture";
            properties.clientRequestId = `NodeResultReplay;${runId};${workload.id}`;
            properties.setTimeout(30000);
            properties.setClientTimeout(35000);
            properties.setOption("query_results_cache_max_age", "00:00:00");
            const response = await client.executeQuery(configured.database, workload.query, properties);
            if (response.primaryResults.length !== 1) {
                throw new LoadConfigurationError("Synthetic capture did not return exactly one primary table");
            }
            const table = response.primaryResults[0];
            const frames = primaryFrames(table, options.rows);
            workload.consume(table);
            const payload = JSON.stringify(frames);
            fixtures.workloads.push({ workload: workload.id, querySha256: hash(workload.query), payloadSha256: hash(payload), payload });
        }
    } finally {
        client.close();
    }
    parseFixtures(fixtures);
    const data = `${JSON.stringify(fixtures, null, 2)}\n`;
    if (Buffer.byteLength(data) > maximumFixtureBytes) {
        throw new LoadConfigurationError("Captured fixtures exceeded 64 MiB");
    }
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, data, { flag: "wx" });
    await writeFile(
        `${options.output}.metadata.json`,
        `${JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                queryCount: fixtures.workloads.length,
                rows: options.rows,
                fixtureSha256: hash(data),
                targetSha256: hash(`${configured.cluster}\n${configured.database}`),
                sdk,
            },
            null,
            2,
        )}\n`,
        { flag: "wx" },
    );
    process.stdout.write(`Captured ${fixtures.workloads.length} sanitized synthetic primary-result payloads (${options.rows} rows each).\n`);
};

const worker = async (options: ReplayOptions): Promise<WorkerResult> => {
    const { fixtures, fixtureSha256 } = await loadFixtures(options);
    if (fixtureSha256 !== options.fixtureSha256) {
        throw new LoadConfigurationError("Replay fixtures changed after coordinator validation");
    }
    const root = options.worker === "before" ? options.before : options.after;
    const directory = sdkDirectory(root);
    const module: typeof Response = await import(pathToFileURL(join(directory, "response.js")).href);
    const samples: ReplaySamples[] = [];
    const profiles: ProfileArtifact[] = [];
    const workloads = makeWorkloads(options.rows);
    for (const [index, fixture] of fixtures.workloads.entries()) {
        const result = await runReplayCase(
            workloads[index],
            fixture.payload,
            (frames) => {
                const dataSet = new module.KustoResponseDataSetV2(frames);
                if (dataSet.primaryResults.length !== 1) {
                    throw new LoadConfigurationError("Replay did not construct exactly one primary table");
                }
                return dataSet.primaryResults[0];
            },
            options,
        );
        samples.push(result.sample);
        const profile = result.cpuProfile ?? result.heapProfile;
        if (profile) {
            sanitizeProfileLocations(profile, [
                { directory, label: "sdk" },
                { directory: dirname(fileURLToPath(import.meta.url)), label: "harness" },
                { directory: join(root, "node_modules"), label: "dependency" },
            ]);
            const file = `${options.worker}-r${options.round + 1}-${fixture.workload}.${options.profile === "cpu" ? "cpuprofile" : "heapprofile"}`;
            const data = `${JSON.stringify(profile)}\n`;
            await writeFile(join(`${options.output}.profiles`, file), data, { flag: "wx" });
            profiles.push({ workload: fixture.workload, file, sha256: hash(data) });
        }
    }
    return { fixtureSha256, samples, profiles };
};

const isWorkerResult = (value: unknown): value is WorkerResult => {
    if (typeof value !== "object" || value === null || !("fixtureSha256" in value) || typeof value.fixtureSha256 !== "string") {
        return false;
    }
    return (
        "samples" in value &&
        Array.isArray(value.samples) &&
        value.samples.every(isReplaySamples) &&
        "profiles" in value &&
        Array.isArray(value.profiles) &&
        value.profiles.every(
            (entry: unknown) =>
                typeof entry === "object" &&
                entry !== null &&
                "workload" in entry &&
                typeof entry.workload === "string" &&
                "file" in entry &&
                typeof entry.file === "string" &&
                /^(before|after)-r[1-5]-(ordinary-json|raw-values|reserved-json|proxy-json|custom-index)\.(cpuprofile|heapprofile)$/.test(entry.file) &&
                "sha256" in entry &&
                typeof entry.sha256 === "string" &&
                /^[a-f0-9]{64}$/.test(entry.sha256),
        )
    );
};

const runWorker = async (options: ReplayOptions, variant: Variant, round: number, fixtureSha256: string, timeout: number): Promise<WorkerResult> => {
    if (!options.fixtures) {
        throw new LoadConfigurationError("--fixtures is required for offline replay");
    }
    const args = [
        fileURLToPath(import.meta.url),
        "--before",
        options.before,
        "--after",
        options.after,
        "--fixtures",
        options.fixtures,
        "--output",
        options.output,
        "--worker",
        variant,
        "--round",
        String(round),
        "--fixture-sha256",
        fixtureSha256,
        "--rows",
        String(options.rows),
        "--iterations",
        String(options.iterations),
        "--warmup",
        String(options.warmup),
        "--rounds",
        String(options.rounds),
        "--profile",
        options.profile,
        "--max-duration-seconds",
        String(options.maxDurationSeconds),
    ];
    const result = await execFile(process.execPath, args, {
        timeout,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, ENGINE_CONNECTION_STRING: "", TEST_DATABASE: "" },
    }).catch((error: unknown): never => {
        if (typeof error === "object" && error !== null && "stderr" in error && typeof error.stderr === "string") {
            const failure = /Result-row replay failed: (\w+)\./.exec(error.stderr);
            if (failure) {
                const wrapped = new Error("Offline replay worker failed");
                wrapped.name = failure[1];
                throw wrapped;
            }
        }
        throw error;
    });
    const value: unknown = JSON.parse(result.stdout);
    if (!isWorkerResult(value) || value.fixtureSha256 !== fixtureSha256 || value.profiles.length !== (options.profile === "none" ? 0 : 5)) {
        throw new LoadConfigurationError("Replay worker returned invalid metrics, fixtures, or profiles");
    }
    return value;
};

const compare = async (options: ReplayOptions): Promise<boolean> => {
    const profileDirectory = `${options.output}.profiles`;
    await assertNewOutputs([options.output, `${options.output}.md`, ...(options.profile === "none" ? [] : [profileDirectory])]);
    const { fixtures, fixtureSha256 } = await loadFixtures(options);
    const before = await identifyAndBuild(options.before, "before");
    const after = await identifyAndBuild(options.after, "after");
    const identicalSdk = before.compiledSdkSha256 === after.compiledSdkSha256 && before.lockfileSha256 === after.lockfileSha256;
    const settings = {
        rows: options.rows,
        iterations: options.iterations,
        warmup: options.warmup,
        rounds: options.rounds,
        profile: options.profile,
        cpuSamplingIntervalMicros: options.profile === "cpu" ? cpuSamplingIntervalMicros : null,
        heapSamplingIntervalBytes: options.profile === "heap" ? heapSamplingIntervalBytes : null,
        includeCollectedAllocations: options.profile === "heap",
    };
    const configurationSha256 = hash(JSON.stringify({ settings, fixtureSha256 }));
    await mkdir(dirname(options.output), { recursive: true });
    if (options.profile !== "none") {
        await mkdir(profileDirectory);
    }
    const runs: { variant: Variant; round: number; samples: ReplaySamples[]; profiles: ProfileArtifact[] }[] = [];
    const workloads = makeWorkloads(options.rows);
    let fatalError: string | undefined;
    const deadline = Date.now() + options.maxDurationSeconds * 1000;
    outer: for (let round = 0; round < options.rounds; round++) {
        for (const variant of (round % 2 === 0 ? ["before", "after"] : ["after", "before"]) as Variant[]) {
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                fatalError = "Replay exceeded its time budget";
                break outer;
            }
            process.stderr.write(`Replay ${options.profile}, round ${round + 1}/${options.rounds}: ${variant}\n`);
            try {
                const result = await runWorker(options, variant, round, fixtureSha256, remaining);
                if (result.samples.length !== workloads.length || result.samples.some((sample, index) => sample.workload !== workloads[index].id)) {
                    throw new LoadConfigurationError("Replay worker did not complete all five workloads");
                }
                runs.push({ variant, round, samples: result.samples, profiles: result.profiles });
            } catch (error: unknown) {
                fatalError = `${variant} replay worker failed (${safeFailure("processing", error).name}); no further replay was scheduled`;
                break outer;
            }
        }
    }
    const comparisons = workloads.map((workload) => {
        const select = (variant: Variant) =>
            runs.filter((run) => run.variant === variant).flatMap((run) => run.samples.filter((s) => s.workload === workload.id));
        const a = summarizeReplay(select("before"));
        const b = summarizeReplay(select("after"));
        const valid =
            [a, b].every(
                (summary) =>
                    summary.attempted === options.iterations * options.rounds && summary.succeeded === summary.attempted && summary.warmupFailures === 0,
            ) && a.bytes === b.bytes;
        return {
            workload: workload.id,
            expectedBaselineFailure: workload.expectedBaselineFailure,
            before: a,
            after: b,
            change:
                options.profile === "none" && valid
                    ? {
                          requestsPerSecondPercent: ((b.requestsPerSecond - a.requestsPerSecond) / a.requestsPerSecond) * 100,
                          modelP95Percent: a.modelMs.p95 && b.modelMs.p95 !== null ? ((b.modelMs.p95 - a.modelMs.p95) / a.modelMs.p95) * 100 : null,
                      }
                    : null,
        };
    });
    const correctnessPassed =
        !fatalError &&
        comparisons.every((item) =>
            comparisonPassed(item.before, item.after, options.iterations * options.rounds, item.expectedBaselineFailure && !identicalSdk),
        );
    const report = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        runtime: { node: process.version, platform: process.platform, architecture: process.arch, cpuCount: cpus().length },
        settings,
        maxDurationSeconds: options.maxDurationSeconds,
        fixtureSha256,
        configurationSha256,
        payloads: fixtures.workloads.map(({ workload, querySha256, payloadSha256, payload }) => ({
            workload,
            querySha256,
            payloadSha256,
            bytes: Buffer.byteLength(payload),
        })),
        revisions: { before, after },
        completed: fatalError === undefined,
        correctnessPassed,
        fatalError,
        profileDirectory: options.profile === "none" ? undefined : basename(profileDirectory),
        comparisons,
        runs,
    };
    const lines = [
        "# Result-row payload replay",
        "",
        `Before: \`${before.revision}\`; after: \`${after.revision}\`.`,
        `Rows: ${options.rows}; measured iterations/case/revision: ${options.iterations * options.rounds}; profile: ${options.profile}.`,
        `Completed: ${report.completed}; correctness passed: ${correctnessPassed}.`,
        "",
        "| Workload | Before req/s | After req/s | Before/after CPU ms | Before/after peak RSS MiB | Failed before/after |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
        ...comparisons.map(
            (item) =>
                `| ${item.workload} | ${display(item.before.requestsPerSecond)} | ${display(item.after.requestsPerSecond)} | ${display(item.before.cpuMs)} / ${display(item.after.cpuMs)} | ${display(item.before.peakRssBytes / 1048576)} / ${display(item.after.peakRssBytes / 1048576)} | ${item.before.attempted - item.before.succeeded}+${item.before.warmupFailures} / ${item.after.attempted - item.after.succeeded}+${item.after.warmupFailures} |`,
        ),
        "",
        "Failures are measured + warm-up. Instrumented rates are diagnostic only; compare performance using the unprofiled run.",
        "",
        "| Workload | Component | Before P90 | Before P95 | Before P99 | After P90 | After P95 | After P99 |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ...comparisons.flatMap((item) =>
            replayComponents.map(
                (component) =>
                    `| ${item.workload} | ${component} | ${display(item.before[component].p90)} | ${display(item.before[component].p95)} | ${display(item.before[component].p99)} | ${display(item.after[component].p90)} | ${display(item.after[component].p95)} | ${display(item.after[component].p99)} |`,
            ),
        ),
        "",
        "Decode and construction samples include model-failed iterations; total/model samples and successful throughput do not.",
        "Each iteration decodes the same immutable primary-result payload into fresh objects and constructs a fresh SDK data set.",
        "Warm-up is excluded; profilers start inside each SDK worker after warm-up. Unprofiled runs do not enable GC observation.",
        "Payloads are normalized primary-result frames, not original compressed HTTP bytes. This excludes network/HTTP/decompression costs.",
        "With 60 successful samples/case/revision, nearest-rank P99 is the observed maximum. Heap deltas are not retained-heap/leak measurements.",
        ...(fatalError ? ["", `Failure: ${fatalError}.`] : []),
        "",
    ];
    await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    await writeFile(`${options.output}.md`, lines.join("\n"), { flag: "wx" });
    process.stdout.write(`${lines.join("\n")}\n`);
    return correctnessPassed;
};

const main = async (): Promise<void> => {
    if (process.argv.includes("--help")) {
        process.stdout.write(
            "npm run replayTest -- --capture --rows 5000 --output <fixtures.json>\n" +
                "npm run replayTest -- --before <checkout> --fixtures <fixtures.json> [--rows 5000 --iterations 20 --warmup 10 --rounds 3 --profile none|cpu|heap --output <report.json>]\n" +
                "Only capture needs ENGINE_CONNECTION_STRING, TEST_DATABASE, and Azure CLI login. Comparison is offline.\n",
        );
        return;
    }
    const options = readReplayOptions(process.argv.slice(2));
    if (options.capture) {
        await capture(options);
    } else if (options.worker) {
        process.stdout.write(JSON.stringify(await worker(options)));
    } else if (!(await compare(options))) {
        process.exitCode = 1;
    }
};

main().catch((error: unknown) => {
    const failure = safeFailure("processing", error);
    process.stderr.write(`Result-row replay failed: ${failure.name}.\n`);
    if (error instanceof LoadConfigurationError) {
        process.stderr.write(`${error.message}\n`);
    }
    process.exitCode = 1;
});
