// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Session } from "node:inspector/promises";
import type { HeapProfiler, Profiler } from "node:inspector";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { performance, PerformanceObserver } from "node:perf_hooks";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { KustoResultTable } from "../../src/models.js";
import { hash } from "./resultRowsHarness.js";
import { integer, LoadConfigurationError, LoadValidationError, makeWorkloads, percentile, safeFailure } from "./resultRowsLoad.js";
import type { Failure, Variant, Workload } from "./resultRowsLoad.js";

export type ProfileMode = "none" | "cpu" | "heap";
export const replayComponents = ["decodeMs", "constructMs", "modelMs", "totalMs"] as const;
export const cpuSamplingIntervalMicros = 1000;
export const heapSamplingIntervalBytes = 32768;
type Component = (typeof replayComponents)[number];

export interface PrimaryFrame {
    FrameType: "DataTable";
    TableId: 0;
    TableName: "PrimaryResult";
    TableKind: "PrimaryResult";
    Columns: { ColumnName: string; ColumnType: string }[];
    Rows: unknown[][];
}

export interface ReplayFixture {
    workload: string;
    querySha256: string;
    payloadSha256: string;
    payload: string;
}

export interface ReplayFixtures {
    schemaVersion: 1;
    rows: number;
    workloads: ReplayFixture[];
}

export interface ReplayOptions {
    capture: boolean;
    before: string;
    after: string;
    output: string;
    fixtures?: string;
    rows: number;
    iterations: number;
    warmup: number;
    rounds: number;
    profile: ProfileMode;
    maxDurationSeconds: number;
    worker?: Variant;
    round: number;
    fixtureSha256?: string;
}

export interface ReplaySamples {
    workload: string;
    attempted: number;
    succeeded: number;
    warmupAttempts: number;
    warmupFailures: number;
    validationErrors: number;
    processingErrors: number;
    bytes: number;
    elapsedMs: number;
    cpuMs: number;
    peakRssBytes: number;
    heapUsedDeltaBytes: number;
    decodeMs: number[];
    constructMs: number[];
    modelMs: number[];
    totalMs: number[];
    gcEvents: { startTime: number; durationMs: number }[] | null;
    failures: Failure[];
}

export interface ReplayRun {
    sample: ReplaySamples;
    cpuProfile?: Profiler.Profile;
    heapProfile?: HeapProfiler.SamplingHeapProfile;
}

export const readReplayOptions = (args: string[]): ReplayOptions => {
    const { values } = parseArgs({
        args,
        options: {
            capture: { type: "boolean", default: false },
            before: { type: "string" },
            after: { type: "string", default: "." },
            fixtures: { type: "string" },
            output: { type: "string", default: `artifacts/result-row-replay-${new Date().toISOString().replace(/[:.]/g, "-")}.json` },
            rows: { type: "string", default: "5000" },
            iterations: { type: "string", default: "20" },
            warmup: { type: "string", default: "10" },
            rounds: { type: "string", default: "3" },
            profile: { type: "string", default: "none" },
            "max-duration-seconds": { type: "string", default: "300" },
            worker: { type: "string" },
            round: { type: "string", default: "0" },
            "fixture-sha256": { type: "string" },
        },
    });
    if ((!values.capture && (!values.before || !values.fixtures)) || (values.capture && (values.fixtures || values.worker))) {
        throw new LoadConfigurationError("Use --capture to write synthetic fixtures, or provide --before and --fixtures for offline replay");
    }
    if (values.worker !== undefined && values.worker !== "before" && values.worker !== "after") {
        throw new LoadConfigurationError("--worker must be before or after");
    }
    if (values.profile !== "none" && values.profile !== "cpu" && values.profile !== "heap") {
        throw new LoadConfigurationError("--profile must be none, cpu, or heap");
    }
    if (values.worker && !/^[a-f0-9]{64}$/.test(values["fixture-sha256"] ?? "")) {
        throw new LoadConfigurationError("A replay worker requires the coordinator's --fixture-sha256");
    }
    const options: ReplayOptions = {
        capture: values.capture,
        before: resolve(values.before ?? values.after),
        after: resolve(values.after),
        output: resolve(values.output),
        fixtures: values.fixtures ? resolve(values.fixtures) : undefined,
        rows: integer("rows", values.rows, 1, 50000),
        iterations: integer("iterations", values.iterations, 1, 200),
        warmup: integer("warmup", values.warmup, 1, 50),
        rounds: integer("rounds", values.rounds, 1, 5),
        profile: values.profile,
        maxDurationSeconds: integer("max-duration-seconds", values["max-duration-seconds"], 10, 1800),
        worker: values.worker,
        round: integer("round", values.round, 0, 4),
        fixtureSha256: values["fixture-sha256"],
    };
    if (2 * options.rounds * 5 * (options.iterations + options.warmup) > 5000) {
        throw new LoadConfigurationError("Replay is limited to 5000 total iterations including warm-up");
    }
    return options;
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isRows = (value: unknown): value is unknown[][] => Array.isArray(value) && value.every((row: unknown) => Array.isArray(row));

export const primaryFrames = (table: KustoResultTable, rows: number): PrimaryFrame[] => {
    const columns = table.columns.map((column) => {
        if (column.name === null || column.type === null) {
            throw new LoadValidationError("Synthetic column metadata was incomplete");
        }
        return { ColumnName: column.name, ColumnType: column.type };
    });
    const raw: unknown = table._rows;
    if (!isRows(raw) || raw.length !== rows || raw.some((row) => row.length !== columns.length)) {
        throw new LoadValidationError("Synthetic primary-result rows did not match their schema");
    }
    return [{ FrameType: "DataTable", TableId: 0, TableName: "PrimaryResult", TableKind: "PrimaryResult", Columns: columns, Rows: raw }];
};

export const parseFrames = (payload: string, rows: number): PrimaryFrame[] => {
    const frames: unknown = JSON.parse(payload);
    if (!Array.isArray(frames) || frames.length !== 1) {
        throw new LoadConfigurationError("Replay requires exactly one sanitized primary-result frame");
    }
    const frame: unknown = frames[0];
    if (!isObject(frame) || !Array.isArray(frame.Columns) || !isRows(frame.Rows)) {
        throw new LoadConfigurationError("Replay fixture contains invalid rows/schema or non-primary metadata");
    }
    const columns = frame.Columns;
    const rowsData = frame.Rows;
    if (
        Object.keys(frame).sort().join() !== "Columns,FrameType,Rows,TableId,TableKind,TableName" ||
        frame.FrameType !== "DataTable" ||
        frame.TableId !== 0 ||
        frame.TableName !== "PrimaryResult" ||
        frame.TableKind !== "PrimaryResult" ||
        !columns.every(
            (column: unknown) =>
                isObject(column) &&
                Object.keys(column).sort().join() === "ColumnName,ColumnType" &&
                typeof column.ColumnName === "string" &&
                typeof column.ColumnType === "string",
        ) ||
        rowsData.length !== rows ||
        rowsData.some((row) => row.length !== columns.length)
    ) {
        throw new LoadConfigurationError("Replay fixture contains invalid rows/schema or non-primary metadata");
    }
    return frames as PrimaryFrame[];
};

export const parseFixtures = (value: unknown): ReplayFixtures => {
    if (!isObject(value) || value.schemaVersion !== 1 || typeof value.rows !== "number" || !Array.isArray(value.workloads)) {
        throw new LoadConfigurationError("Invalid replay fixture manifest");
    }
    const rows = integer("rows", String(value.rows), 1, 50000);
    const expected = makeWorkloads(rows);
    if (value.workloads.length !== expected.length) {
        throw new LoadConfigurationError("Replay requires all five synthetic workloads");
    }
    const workloads = value.workloads.map((item: unknown, index): ReplayFixture => {
        if (
            !isObject(item) ||
            item.workload !== expected[index].id ||
            item.querySha256 !== hash(expected[index].query) ||
            typeof item.payload !== "string" ||
            item.payloadSha256 !== hash(item.payload)
        ) {
            throw new LoadConfigurationError("Replay workload/query/payload hashes do not match");
        }
        parseFrames(item.payload, rows);
        return { workload: expected[index].id, querySha256: hash(expected[index].query), payloadSha256: hash(item.payload), payload: item.payload };
    });
    return { schemaVersion: 1, rows, workloads };
};

export const isReplaySamples = (value: unknown): value is ReplaySamples =>
    isObject(value) &&
    typeof value.workload === "string" &&
    [
        "attempted",
        "succeeded",
        "warmupAttempts",
        "warmupFailures",
        "validationErrors",
        "processingErrors",
        "bytes",
        "elapsedMs",
        "cpuMs",
        "peakRssBytes",
        "heapUsedDeltaBytes",
    ].every((key) => typeof value[key] === "number" && Number.isFinite(value[key])) &&
    replayComponents.every((key) => Array.isArray(value[key]) && value[key].every((item: unknown) => typeof item === "number" && Number.isFinite(item))) &&
    (value.gcEvents === null ||
        (Array.isArray(value.gcEvents) &&
            value.gcEvents.every(
                (entry: unknown) =>
                    isObject(entry) &&
                    typeof entry.startTime === "number" &&
                    Number.isFinite(entry.startTime) &&
                    typeof entry.durationMs === "number" &&
                    Number.isFinite(entry.durationMs),
            ))) &&
    Array.isArray(value.failures);

export const sanitizeProfileLocations = (profile: Profiler.Profile | HeapProfiler.SamplingHeapProfile, roots: { directory: string; label: string }[]): void => {
    const location = (url: string): string => {
        if (!url || url.startsWith("node:")) {
            return url;
        }
        const path = url.startsWith("file:") ? fileURLToPath(url) : url;
        if (!isAbsolute(path)) {
            return "external";
        }
        for (const root of roots) {
            const name = relative(root.directory, path);
            if (name !== ".." && !name.startsWith(`..${sep}`) && !isAbsolute(name)) {
                return `${root.label}:${name.split(sep).join("/")}`;
            }
        }
        return `external:${basename(path)}`;
    };
    if ("nodes" in profile) {
        for (const node of profile.nodes) {
            node.callFrame.url = location(node.callFrame.url);
        }
    } else {
        const visit = (node: HeapProfiler.SamplingHeapProfileNode): void => {
            node.callFrame.url = location(node.callFrame.url);
            node.children.forEach(visit);
        };
        visit(profile.head);
    }
};

export const runReplayCase = async (
    workload: Workload,
    payload: string,
    construct: (frames: PrimaryFrame[]) => KustoResultTable,
    limits: Pick<ReplayOptions, "rows" | "iterations" | "warmup" | "profile">,
): Promise<ReplayRun> => {
    parseFrames(payload, limits.rows);
    const sample: ReplaySamples = {
        workload: workload.id,
        attempted: 0,
        succeeded: 0,
        warmupAttempts: 0,
        warmupFailures: 0,
        validationErrors: 0,
        processingErrors: 0,
        bytes: 0,
        elapsedMs: 0,
        cpuMs: 0,
        peakRssBytes: 0,
        heapUsedDeltaBytes: 0,
        decodeMs: [],
        constructMs: [],
        modelMs: [],
        totalMs: [],
        gcEvents: limits.profile === "none" ? null : [],
        failures: [],
    };
    const iteration = (measured: boolean): void => {
        const start = performance.now();
        // The immutable payload was validated above; do not time another schema walk.
        const frames = JSON.parse(payload) as PrimaryFrame[];
        const decoded = performance.now();
        const table = construct(frames);
        const constructed = performance.now();
        if (measured) {
            sample.attempted++;
            sample.decodeMs.push(decoded - start);
            sample.constructMs.push(constructed - decoded);
        } else {
            sample.warmupAttempts++;
        }
        try {
            const bytes = workload.consume(table);
            if (measured) {
                const end = performance.now();
                sample.succeeded++;
                sample.bytes += bytes;
                sample.modelMs.push(end - constructed);
                sample.totalMs.push(end - start);
            }
        } catch (error: unknown) {
            const kind = error instanceof LoadValidationError ? "validation" : "processing";
            if (measured) {
                sample[kind === "validation" ? "validationErrors" : "processingErrors"]++;
            } else {
                sample.warmupFailures++;
            }
            if (sample.failures.length < 3) {
                sample.failures.push(safeFailure(kind, error));
            }
        }
        if (measured) {
            sample.peakRssBytes = Math.max(sample.peakRssBytes, process.memoryUsage().rss);
        }
    };
    for (let index = 0; index < limits.warmup; index++) {
        iteration(false);
    }
    await setImmediate();
    const events: { startTime: number; durationMs: number }[] = [];
    const observer =
        limits.profile === "none"
            ? undefined
            : new PerformanceObserver((list) => {
                  events.push(...list.getEntries().map((entry) => ({ startTime: entry.startTime, durationMs: entry.duration })));
              });
    const session = limits.profile === "none" ? undefined : new Session();
    const result: ReplayRun = { sample };
    try {
        observer?.observe({ entryTypes: ["gc"] });
        session?.connect();
        if (session && limits.profile === "cpu") {
            await session.post("Profiler.enable");
            await session.post("Profiler.setSamplingInterval", { interval: cpuSamplingIntervalMicros });
            await session.post("Profiler.start");
        } else if (session) {
            await session.post("HeapProfiler.enable");
            const settings = { samplingInterval: heapSamplingIntervalBytes, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true };
            await session.post("HeapProfiler.startSampling", settings);
        }
        const memory = process.memoryUsage();
        sample.peakRssBytes = memory.rss;
        const cpu = process.cpuUsage();
        const start = performance.now();
        for (let index = 0; index < limits.iterations; index++) {
            iteration(true);
        }
        const end = performance.now();
        const used = process.cpuUsage(cpu);
        sample.elapsedMs = end - start;
        sample.cpuMs = (used.user + used.system) / 1000;
        sample.heapUsedDeltaBytes = process.memoryUsage().heapUsed - memory.heapUsed;
        if (session && limits.profile === "cpu") {
            result.cpuProfile = (await session.post("Profiler.stop")).profile;
        } else if (session) {
            result.heapProfile = (await session.post("HeapProfiler.stopSampling")).profile;
        }
        await setImmediate();
        events.push(...(observer?.takeRecords() ?? []).map((entry) => ({ startTime: entry.startTime, durationMs: entry.duration })));
        if (observer) {
            sample.gcEvents = events.filter((entry) => entry.startTime >= start && entry.startTime < end);
        }
        return result;
    } finally {
        observer?.disconnect();
        session?.disconnect();
    }
};

export const summarizeReplay = (runs: ReplaySamples[]) => {
    const sum = (
        field:
            | "attempted"
            | "succeeded"
            | "warmupAttempts"
            | "warmupFailures"
            | "validationErrors"
            | "processingErrors"
            | "bytes"
            | "elapsedMs"
            | "cpuMs"
            | "heapUsedDeltaBytes",
    ) => runs.reduce((total, run) => total + run[field], 0);
    const latency = (field: Component) => {
        const values = runs.flatMap((run) => run[field]);
        return { p50: percentile(values, 0.5), p90: percentile(values, 0.9), p95: percentile(values, 0.95), p99: percentile(values, 0.99) };
    };
    const elapsedMs = sum("elapsedMs");
    const observedGc = runs.length > 0 && runs.every((run) => run.gcEvents !== null);
    const gc = runs.flatMap((run) => run.gcEvents ?? []);
    return {
        attempted: sum("attempted"),
        succeeded: sum("succeeded"),
        warmupAttempts: sum("warmupAttempts"),
        warmupFailures: sum("warmupFailures"),
        validationErrors: sum("validationErrors"),
        processingErrors: sum("processingErrors"),
        bytes: sum("bytes"),
        elapsedMs,
        cpuMs: sum("cpuMs"),
        peakRssBytes: Math.max(0, ...runs.map((run) => run.peakRssBytes)),
        heapUsedDeltaBytes: sum("heapUsedDeltaBytes"),
        requestsPerSecond: elapsedMs > 0 ? (sum("succeeded") * 1000) / elapsedMs : 0,
        gcCount: observedGc ? gc.length : null,
        gcMs: observedGc ? gc.reduce((total, entry) => total + entry.durationMs, 0) : null,
        decodeMs: latency("decodeMs"),
        constructMs: latency("constructMs"),
        modelMs: latency("modelMs"),
        totalMs: latency("totalMs"),
    };
};
