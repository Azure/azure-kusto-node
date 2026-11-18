// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { KustoResultTable } from "../../src/models.js";
import { LoadValidationError, makeWorkloads, performanceChange, readOptions, runCase, safeFailure, summarize, withCachedTokens } from "./resultRowsLoad.js";
import type { LoadLimits, Workload } from "./resultRowsLoad.js";

const limits: LoadLimits = { rows: 2, iterations: 7, concurrency: 2, warmup: 1, rounds: 1, timeoutMs: 1000, maxDurationSeconds: 30 };
const table = (): KustoResultTable =>
    new KustoResultTable({
        TableName: "PrimaryResult",
        Columns: [{ ColumnName: "RowId", ColumnType: "long" }],
        Rows: [[0], [1]],
    });
const workload = (): Workload => makeWorkloads(limits.rows)[0];

describe("Result-row load suite", () => {
    it("caches Azure CLI tokens per audience and deduplicates concurrent acquisition, refreshing before expiry", async () => {
        let now = 0;
        let acquisitions = 0;
        const credential = withCachedTokens(
            {
                getToken: async () => {
                    acquisitions++;
                    await setImmediate();
                    return { token: "synthetic-test-token", expiresOnTimestamp: now + 120000 };
                },
            },
            () => now,
        );
        await Promise.all([credential.getToken("scope-a"), credential.getToken(["scope-a"]), credential.getToken("scope-a")]);
        assert.equal(acquisitions, 1);
        await credential.getToken("scope-b");
        assert.equal(acquisitions, 2);
        now = 60001;
        await credential.getToken("scope-a");
        assert.equal(acquisitions, 3);
    });

    it("surfaces token acquisition failures and permits a later retry instead of caching failure", async () => {
        let acquisitions = 0;
        const credential = withCachedTokens({
            getToken: () => Promise.resolve(++acquisitions === 1 ? null : { token: "synthetic-test-token", expiresOnTimestamp: Date.now() + 120000 }),
        });
        await assert.rejects(credential.getToken("scope"), /did not return an access token/);
        assert.ok(await credential.getToken("scope"));
        assert.equal(acquisitions, 2);
    });

    it("bounds live query admission and excludes authentication/warm-up requests from measured samples", async () => {
        let active = 0;
        let peak = 0;
        const sequences: number[] = [];
        const samples = await runCase(workload(), limits, async (_query, sequence) => {
            sequences.push(sequence);
            active++;
            peak = Math.max(peak, active);
            await setImmediate();
            active--;
            return table();
        });
        assert.equal(peak, limits.concurrency);
        assert.equal(sequences.length, 1 + limits.warmup * limits.concurrency + limits.iterations);
        assert.equal(new Set(sequences).size, sequences.length);
        assert.equal(samples.attempted, limits.iterations);
        assert.equal(samples.succeeded, limits.iterations);
        assert.equal(samples.queryMs.length, limits.iterations);
        assert.equal(samples.modelMs.length, limits.iterations);
        assert.equal(samples.totalMs.length, limits.iterations);
    });

    it("counts correctness failures without reporting failed requests as fast successful work", async () => {
        const broken = {
            ...workload(),
            consume: (): never => {
                throw new LoadValidationError("Synthetic cell mismatch");
            },
        };
        const samples = await runCase(broken, limits, () => Promise.resolve(table()));
        assert.equal(samples.validationErrors, limits.iterations);
        assert.equal(samples.warmupFailures, 1 + limits.warmup * limits.concurrency);
        assert.equal(samples.succeeded, 0);
        assert.equal(samples.modelMs.length, 0);
        assert.equal(samples.queryMs.length, limits.iterations);
        const summary = summarize([samples]);
        assert.equal(summary.requestsPerSecond, 0);
        assert.equal(summary.totalMs.p95, null);
        assert.equal(performanceChange(summary, summary), null);
    });

    it("stops scheduling on infrastructure errors and keeps endpoint/authentication text out of reports", async () => {
        let calls = 0;
        const samples = await runCase(workload(), limits, () => {
            if (++calls > 1 + limits.warmup * limits.concurrency) {
                return Promise.reject(Object.assign(new Error("Secret token and private endpoint must not appear"), { response: { status: 429 } }));
            }
            return Promise.resolve(table());
        });
        assert.ok(samples.attempted <= limits.concurrency);
        assert.equal(samples.queryErrors, samples.attempted);
        assert.equal(samples.succeeded, 0);
        assert.equal(samples.failures[0].status, 429);
        assert.ok(!JSON.stringify(samples).includes("Secret token"));
        assert.deepEqual(safeFailure("query", { name: "private endpoint", message: "secret" }), { kind: "query", name: "Error" });
    });

    it("does not start measured traffic if an authentication/warm-up query fails", async () => {
        let calls = 0;
        await assert.rejects(
            runCase(workload(), limits, () => {
                calls++;
                return Promise.reject(new Error("Authentication failed"));
            }),
            /Authentication failed/,
        );
        assert.equal(calls, 1);
    });

    it("separates model exceptions from validation and query failures", async () => {
        const broken = {
            ...workload(),
            consume: (): never => {
                throw new TypeError("Overwritten row method");
            },
        };
        const samples = await runCase(broken, limits, () => Promise.resolve(table()));
        assert.equal(samples.processingErrors, limits.iterations);
        assert.equal(samples.queryErrors, 0);
        assert.equal(samples.validationErrors, 0);
        assert.equal(samples.failures[0].name, "TypeError");
        assert.equal(samples.failures[0].message, undefined);
    });

    it("pools samples across rounds and compares successful throughput rather than averaging rates", async () => {
        const samples = await runCase(workload(), limits, () => Promise.resolve(table()));
        const first = { ...samples, elapsedMs: 1000, totalMs: [10, 20], modelMs: [1, 2] };
        const second = { ...samples, elapsedMs: 3000, totalMs: [30, 40], modelMs: [3, 4] };
        const before = summarize([first, second]);
        const after = summarize([
            { ...first, elapsedMs: 2000 },
            { ...second, elapsedMs: 6000 },
        ]);
        assert.equal(before.requestsPerSecond, (2 * limits.iterations) / 4);
        assert.deepEqual(before.totalMs, { p50: 20, p95: 40, p99: 40 });
        assert.equal(performanceChange(before, after)?.requestsPerSecondPercent, -50);
        assert.equal(performanceChange(before, { ...after, bytes: after.bytes + 1 }), null);
    });

    it("rejects unbounded/injected workloads and configurations that understate concurrency", () => {
        assert.throws(() => readOptions([]), /--before/);
        for (const args of [
            ["--rows", "1 | .drop table x"],
            ["--rows", "50001"],
            ["--iterations", "1", "--concurrency", "2"],
            ["--rows", "50000", "--concurrency", "3"],
            ["--iterations", "200", "--rounds", "5", "--concurrency", "16", "--warmup", "10"],
        ]) {
            assert.throws(() => readOptions(["--before", ".", ...args]));
        }
        assert.equal(readOptions(["--before", ".", "--rows", "50000", "--concurrency", "2"]).rows, 50000);
    });
});
