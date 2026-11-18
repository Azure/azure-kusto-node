// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import type { AccessToken, TokenCredential } from "@azure/core-auth";
import type { KustoResultRow, KustoResultTable } from "../../src/models.js";

export type Variant = "before" | "after";

export interface LoadLimits {
    rows: number;
    iterations: number;
    concurrency: number;
    warmup: number;
    rounds: number;
    timeoutMs: number;
    maxDurationSeconds: number;
}

export interface LoadOptions extends LoadLimits {
    before: string;
    after: string;
    output: string;
    worker?: Variant;
    round: number;
}

export interface Workload {
    id: string;
    expectedBaselineFailure: boolean;
    query: string;
    consume: (table: KustoResultTable) => number;
}

export interface Failure {
    kind: "query" | "validation" | "processing";
    name: string;
    status?: number;
    message?: string;
}

export interface CaseSamples {
    workload: string;
    attempted: number;
    succeeded: number;
    warmupFailures: number;
    queryErrors: number;
    validationErrors: number;
    processingErrors: number;
    bytes: number;
    elapsedMs: number;
    cpuMs: number;
    peakRssBytes: number;
    queryMs: number[];
    modelMs: number[];
    totalMs: number[];
    failures: Failure[];
}

export class LoadValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LoadValidationError";
    }
}

export class LoadConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LoadConfigurationError";
    }
}

export const withCachedTokens = (credential: TokenCredential, now: () => number = Date.now): TokenCredential => {
    interface Entry {
        token?: AccessToken;
        pending?: Promise<AccessToken | null>;
    }
    const entries = new Map<string, Entry>();
    return {
        getToken: (scopes, options) => {
            const key = JSON.stringify([(typeof scopes === "string" ? [scopes] : [...scopes]).sort(), options?.tenantId, options?.claims, options?.enableCae]);
            const entry: Entry = entries.get(key) ?? {};
            entries.set(key, entry);
            if (entry.token && entry.token.expiresOnTimestamp > now() + 60000) {
                return Promise.resolve(entry.token);
            }
            return (entry.pending ??= credential
                .getToken(scopes, options)
                .then((token) => {
                    if (!token) {
                        throw new LoadConfigurationError("Azure CLI did not return an access token");
                    }
                    entry.token = token;
                    return token;
                })
                .finally(() => {
                    entry.pending = undefined;
                }));
        },
    };
};

const integer = (name: string, value: string, min: number, max: number): number => {
    const parsed = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
        throw new LoadConfigurationError(`--${name} must be an integer between ${min} and ${max}`);
    }
    return parsed;
};

export const readOptions = (args: string[]): LoadOptions => {
    const { values } = parseArgs({
        args,
        options: {
            before: { type: "string" },
            after: { type: "string", default: "." },
            output: { type: "string", default: `artifacts/result-rows-${new Date().toISOString().replace(/[:.]/g, "-")}.json` },
            rows: { type: "string", default: "1000" },
            iterations: { type: "string", default: "20" },
            concurrency: { type: "string", default: "4" },
            warmup: { type: "string", default: "2" },
            rounds: { type: "string", default: "3" },
            "timeout-ms": { type: "string", default: "30000" },
            "max-duration-seconds": { type: "string", default: "300" },
            worker: { type: "string" },
            round: { type: "string", default: "0" },
        },
    });
    if (!values.before) {
        throw new LoadConfigurationError("--before must name the baseline repository checkout");
    }
    if (values.worker !== undefined && values.worker !== "before" && values.worker !== "after") {
        throw new LoadConfigurationError("--worker must be before or after");
    }
    const options: LoadOptions = {
        before: resolve(values.before),
        after: resolve(values.after),
        output: resolve(values.output),
        rows: integer("rows", values.rows, 1, 50000),
        iterations: integer("iterations", values.iterations, 1, 200),
        concurrency: integer("concurrency", values.concurrency, 1, 16),
        warmup: integer("warmup", values.warmup, 1, 10),
        rounds: integer("rounds", values.rounds, 1, 5),
        timeoutMs: integer("timeout-ms", values["timeout-ms"], 1000, 120000),
        maxDurationSeconds: integer("max-duration-seconds", values["max-duration-seconds"], 10, 1800),
        worker: values.worker,
        round: integer("round", values.round, 0, 4),
    };
    const requests = 2 * options.rounds * makeWorkloads(options.rows).length * (options.iterations + 1 + options.warmup * options.concurrency);
    if (options.concurrency > options.iterations || options.rows * options.concurrency > 100000 || requests > 5000) {
        throw new LoadConfigurationError("Require iterations >= concurrency, rows * concurrency <= 100000, and at most 5000 total queries");
    }
    return options;
};

const requireValue = (condition: boolean, message: string): void => {
    if (!condition) {
        throw new LoadValidationError(message);
    }
};

const collectionViews = new WeakMap<object, object>();
const proxyRow = (row: KustoResultRow): KustoResultRow =>
    new Proxy(row, {
        get: (target, key, receiver): unknown => {
            const value: unknown = Reflect.get(target, key, receiver);
            if (!(value instanceof Map)) {
                return value;
            }
            let view = collectionViews.get(value);
            if (!view) {
                view = new Proxy(value, {
                    get: (map, member): unknown => {
                        const result: unknown = Reflect.get(map, member, map);
                        return typeof result === "function" ? result.bind(map) : result;
                    },
                });
                collectionViews.set(value, view);
            }
            return view;
        },
    });

export const makeWorkloads = (rows: number): Workload[] => {
    const range = `range RowId from 0 to ${rows - 1} step 1\n| order by RowId asc\n`;
    const reservedQuery =
        range +
        '| project ["columns"]=RowId, ["raw"]=strcat("value-", RowId), ["values"]="values", ' +
        '["getValueAt"]="getValueAt", ["toJSON"]="json", ["constructor"]="constructor", ["__proto__"]=bag_pack("id", RowId)';
    const reserved = (table: KustoResultTable, proxy: boolean): number => {
        const snapshot = proxy
            ? { name: table.name, data: Array.from(table.rows(), (row) => proxyRow(row).toJSON<Record<string, unknown>>()) }
            : table.toJSON<Record<string, unknown>>();
        for (const [index, row] of snapshot.data.entries()) {
            requireValue(
                row.columns === index &&
                    row.raw === `value-${index}` &&
                    row.values === "values" &&
                    row.getValueAt === "getValueAt" &&
                    row.toJSON === "json" &&
                    Reflect.get(row, "constructor") === "constructor",
                "Reserved cells were lost or overwritten",
            );
            const prototypeCell: unknown = Reflect.get(row, "__proto__");
            requireValue(
                Object.prototype.hasOwnProperty.call(row, "__proto__") &&
                    Object.getPrototypeOf(row) === Object.prototype &&
                    typeof prototypeCell === "object" &&
                    prototypeCell !== null &&
                    "id" in prototypeCell &&
                    prototypeCell.id === index,
                "The __proto__ cell was not serialized as an own data property with the expected value",
            );
        }
        return Buffer.byteLength(JSON.stringify(snapshot));
    };
    return [
        {
            id: "ordinary-json",
            expectedBaselineFailure: false,
            query:
                range +
                '| extend Timestamp=datetime(2026-01-01) + RowId * 1ms, Duration=RowId * 1ms, Text=strcat("row-", RowId), ' +
                'Metric=todouble(RowId)/10.0, Enabled=(RowId % 2 == 0), Payload=bag_pack("id", RowId, "enabled", true), ' +
                "A=RowId+1, B=RowId+2, C=RowId+3, D=RowId+4, E=RowId+5, F=RowId+6, G=RowId+7, H=RowId+8, I=RowId+9",
            consume: (table) => {
                const snapshot = table.toJSON<{ RowId: number }>();
                requireValue(snapshot.data[0].RowId === 0 && snapshot.data[rows - 1].RowId === rows - 1, "Ordinary row values changed");
                return Buffer.byteLength(JSON.stringify(snapshot));
            },
        },
        {
            id: "raw-values",
            expectedBaselineFailure: true,
            query: range + '| project raw=strcat("GET /", RowId), status=200, level="Info"',
            consume: (table) => {
                let bytes = 0;
                let index = 0;
                for (const row of table.rows()) {
                    const values: unknown[] = Array.from(row.values());
                    requireValue(
                        values.length === 3 && values[0] === `GET /${index++}` && values[1] === 200 && values[2] === "Info",
                        "values() did not return the raw cells",
                    );
                    bytes += Buffer.byteLength(JSON.stringify(values));
                }
                return bytes;
            },
        },
        { id: "reserved-json", expectedBaselineFailure: true, query: reservedQuery, consume: (table) => reserved(table, false) },
        { id: "proxy-json", expectedBaselineFailure: true, query: reservedQuery, consume: (table) => reserved(table, true) },
        {
            id: "custom-index",
            expectedBaselineFailure: true,
            query: range + "| project Timestamp=iff(RowId % 5 == 0, datetime(null), datetime(2026-01-01) + RowId * 1ms), Duration=RowId * 1ms",
            consume: (table) => {
                table.dateTimeParser = (value) => `dt:${value}`;
                table.timeSpanParser = (value) => `ts:${value}`;
                let bytes = 0;
                for (let index = 0; index < rows; index++) {
                    const row: KustoResultRow = table[index];
                    const raw: unknown = table._rows[index];
                    if (!Array.isArray(raw)) {
                        throw new LoadValidationError("A raw query row was not an array");
                    }
                    const timestamp: unknown = raw[0];
                    const duration: unknown = raw[1];
                    requireValue(
                        row.getValueAt(0) === `dt:${timestamp}` && row.getValueAt(1) === `ts:${duration}`,
                        "Numeric row access ignored a custom parser",
                    );
                    bytes += Buffer.byteLength(JSON.stringify(row.toJSON()));
                }
                return bytes;
            },
        },
    ];
};

export const safeFailure = (kind: Failure["kind"], error: unknown): Failure => {
    const names = new Set([
        "TypeError",
        "RangeError",
        "AxiosError",
        "KustoApiError",
        "KustoAuthenticationError",
        "ThrottlingError",
        "AbortError",
        "CanceledError",
        "LoadConfigurationError",
    ]);
    const failure: Failure = { kind, name: error instanceof Error && names.has(error.name) ? error.name : "Error" };
    if (error instanceof LoadValidationError) {
        failure.name = error.name;
        failure.message = error.message;
    }
    if (typeof error === "object" && error !== null && "response" in error) {
        const response: unknown = error.response;
        if (typeof response === "object" && response !== null && "status" in response && typeof response.status === "number") {
            failure.status = response.status;
        }
    }
    return failure;
};

const concurrent = async (count: number, concurrency: number, action: (index: number) => Promise<void>): Promise<void> => {
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.min(count, concurrency) }, async () => {
            while (next < count) {
                const index = next++;
                await action(index);
            }
        }),
    );
};

export const runCase = async (
    workload: Workload,
    limits: LoadLimits,
    execute: (query: string, sequence: number) => Promise<KustoResultTable>,
): Promise<CaseSamples> => {
    const samples: CaseSamples = {
        workload: workload.id,
        attempted: 0,
        succeeded: 0,
        warmupFailures: 0,
        queryErrors: 0,
        validationErrors: 0,
        processingErrors: 0,
        bytes: 0,
        elapsedMs: 0,
        cpuMs: 0,
        peakRssBytes: 0,
        queryMs: [],
        modelMs: [],
        totalMs: [],
        failures: [],
    };
    let sequence = 0;
    const record = (kind: Failure["kind"], error: unknown): void => {
        if (samples.failures.length < 3) {
            samples.failures.push(safeFailure(kind, error));
        }
    };
    const consume = (table: KustoResultTable): number => {
        requireValue(table._rows.length === limits.rows, "The query returned an unexpected number of rows");
        return workload.consume(table);
    };
    const warm = async (): Promise<void> => {
        const table = await execute(workload.query, sequence++);
        try {
            consume(table);
        } catch (error: unknown) {
            samples.warmupFailures++;
            record(error instanceof LoadValidationError ? "validation" : "processing", error);
        }
    };
    // Prime authentication before warming all concurrent keep-alive connections.
    await warm();
    await concurrent(limits.warmup * limits.concurrency, limits.concurrency, warm);
    const start = performance.now();
    const cpu = process.cpuUsage();
    samples.peakRssBytes = process.memoryUsage().rss;
    let stopped = false;
    await concurrent(limits.iterations, limits.concurrency, async () => {
        if (stopped) {
            return;
        }
        samples.attempted++;
        const queryStart = performance.now();
        let table: KustoResultTable;
        try {
            table = await execute(workload.query, sequence++);
        } catch (error: unknown) {
            samples.queryErrors++;
            record("query", error);
            stopped = true;
            return;
        }
        const modelStart = performance.now();
        samples.queryMs.push(modelStart - queryStart);
        try {
            samples.bytes += consume(table);
            const end = performance.now();
            samples.modelMs.push(end - modelStart);
            samples.totalMs.push(end - queryStart);
            samples.succeeded++;
        } catch (error: unknown) {
            if (error instanceof LoadValidationError) {
                samples.validationErrors++;
                record("validation", error);
            } else {
                samples.processingErrors++;
                record("processing", error);
            }
        }
        samples.peakRssBytes = Math.max(samples.peakRssBytes, process.memoryUsage().rss);
    });
    samples.elapsedMs = performance.now() - start;
    const used = process.cpuUsage(cpu);
    samples.cpuMs = (used.user + used.system) / 1000;
    return samples;
};

export const percentile = (values: number[], quantile: number): number | null => {
    if (values.length === 0) {
        return null;
    }
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.ceil(sorted.length * quantile) - 1];
};

export const summarize = (runs: CaseSamples[]) => {
    const sum = (
        field: "attempted" | "succeeded" | "warmupFailures" | "queryErrors" | "validationErrors" | "processingErrors" | "bytes" | "elapsedMs" | "cpuMs",
    ) => runs.reduce((total, run) => total + run[field], 0);
    const latency = (field: "queryMs" | "modelMs" | "totalMs") => {
        const values = runs.flatMap((run) => run[field]);
        return { p50: percentile(values, 0.5), p90: percentile(values, 0.9), p95: percentile(values, 0.95), p99: percentile(values, 0.99) };
    };
    const elapsedMs = sum("elapsedMs");
    return {
        attempted: sum("attempted"),
        succeeded: sum("succeeded"),
        warmupFailures: sum("warmupFailures"),
        queryErrors: sum("queryErrors"),
        validationErrors: sum("validationErrors"),
        processingErrors: sum("processingErrors"),
        bytes: sum("bytes"),
        elapsedMs,
        cpuMs: sum("cpuMs"),
        peakRssBytes: Math.max(0, ...runs.map((run) => run.peakRssBytes)),
        requestsPerSecond: elapsedMs > 0 ? (sum("succeeded") * 1000) / elapsedMs : 0,
        queryMs: latency("queryMs"),
        modelMs: latency("modelMs"),
        totalMs: latency("totalMs"),
    };
};

export const performanceChange = (before: ReturnType<typeof summarize>, after: ReturnType<typeof summarize>) => {
    const failed = (run: typeof before) => run.attempted === 0 || run.succeeded !== run.attempted || run.warmupFailures > 0 || run.queryErrors > 0;
    const change = (a: number | null, b: number | null): number | null => (a !== null && b !== null && a > 0 ? ((b - a) / a) * 100 : null);
    return failed(before) || failed(after) || before.bytes !== after.bytes
        ? null
        : {
              requestsPerSecondPercent: change(before.requestsPerSecond, after.requestsPerSecond),
              totalP95Percent: change(before.totalMs.p95, after.totalMs.p95),
              modelP95Percent: change(before.modelMs.p95, after.modelMs.p95),
          };
};
