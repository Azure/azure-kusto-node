// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { KustoResultTable } from "../../src/models.js";
import { KustoResponseDataSetV2 } from "../../src/response.js";
import { hash } from "./resultRowsHarness.js";
import { LoadValidationError, makeWorkloads } from "./resultRowsLoad.js";
import { parseFixtures, parseFrames, primaryFrames, readReplayOptions, runReplayCase, sanitizeProfileLocations, summarizeReplay } from "./resultRowsReplay.js";
import type { PrimaryFrame, ReplayFixtures } from "./resultRowsReplay.js";

const table = (): KustoResultTable =>
    new KustoResultTable({
        TableName: "private-name",
        TableId: 73,
        TableKind: "PrimaryResult",
        Columns: [{ ColumnName: "RowId", ColumnType: "long" }],
        Rows: [[0], [1]],
    });
const payload = (): string => JSON.stringify(primaryFrames(table(), 2));
const construct = (frames: PrimaryFrame[]): KustoResultTable => new KustoResponseDataSetV2(frames).primaryResults[0];
const limits = { rows: 2, iterations: 3, warmup: 2, profile: "none" as const };
const fixtures = (): ReplayFixtures => ({
    schemaVersion: 1,
    rows: 2,
    workloads: makeWorkloads(2).map((workload) => ({
        workload: workload.id,
        querySha256: hash(workload.query),
        payloadSha256: hash(payload()),
        payload: payload(),
    })),
});

describe("Result-row payload replay", () => {
    it("retains synthetic cells while stripping original table metadata and rejecting diagnostic frames", () => {
        const data = payload();
        assert.ok(!data.includes("private-name"));
        assert.equal(parseFrames(data, 2)[0].Rows[1][0], 1);
        assert.throws(() => parseFrames(JSON.stringify([{ FrameType: "DataSetHeader" }]), 2), /non-primary metadata/);
        const extra = JSON.parse(data) as unknown[];
        extra.push({ FrameType: "QueryCompletionInformation", endpoint: "private" });
        assert.throws(() => parseFrames(JSON.stringify(extra), 2), /exactly one/);
        assert.throws(() => parseFrames(data, 3), /invalid rows/);
    });

    it("validates all workload/query/payload identities rather than replaying mismatched evidence", () => {
        assert.equal(parseFixtures(fixtures()).workloads.length, 5);
        const changed = fixtures();
        changed.workloads[0].payload += " ";
        assert.throws(() => parseFixtures(changed), /hashes do not match/);
        const injected = fixtures();
        injected.workloads[0].querySha256 = hash(".show version");
        assert.throws(() => parseFixtures(injected), /hashes do not match/);
        assert.throws(() => parseFixtures({ ...fixtures(), workloads: [] }), /all five/);
    });

    it("materializes fresh rows and parser state every iteration and excludes warm-up from all measured phases", async () => {
        const seen = new Set<KustoResultTable>();
        const workload = {
            ...makeWorkloads(2)[0],
            consume: (result: KustoResultTable): number => {
                assert.ok(!seen.has(result));
                seen.add(result);
                const parsed: unknown = result.dateTimeParser("2026-01-01");
                assert.ok(parsed instanceof Date);
                result.dateTimeParser = () => "changed";
                const row: unknown = result._rows[0];
                assert.ok(Array.isArray(row));
                assert.equal(row[0], 0);
                row[0] = 42;
                return 100;
            },
        };
        const { sample, cpuProfile, heapProfile } = await runReplayCase(workload, payload(), construct, limits);
        assert.equal(seen.size, limits.warmup + limits.iterations);
        assert.equal(sample.warmupAttempts, limits.warmup);
        assert.equal(sample.warmupFailures, 0);
        assert.equal(sample.attempted, limits.iterations);
        assert.equal(sample.succeeded, limits.iterations);
        assert.equal(sample.bytes, limits.iterations * 100);
        for (const component of ["decodeMs", "constructMs", "modelMs", "totalMs"] as const) {
            assert.equal(sample[component].length, limits.iterations);
        }
        for (let index = 0; index < limits.iterations; index++) {
            assert.ok(Math.abs(sample.totalMs[index] - sample.decodeMs[index] - sample.constructMs[index] - sample.modelMs[index]) < 0.000001);
        }
        assert.equal(sample.gcEvents, null);
        assert.equal(cpuProfile, undefined);
        assert.equal(heapProfile, undefined);
    });

    it("retains decoding/construction diagnostics but does not report failed model work as successful throughput", async () => {
        const broken = {
            ...makeWorkloads(2)[0],
            consume: (): never => {
                throw new LoadValidationError("Synthetic replay mismatch");
            },
        };
        const { sample } = await runReplayCase(broken, payload(), construct, limits);
        assert.equal(sample.validationErrors, limits.iterations);
        assert.equal(sample.warmupFailures, limits.warmup);
        assert.equal(sample.decodeMs.length, limits.iterations);
        assert.equal(sample.constructMs.length, limits.iterations);
        assert.equal(sample.modelMs.length, 0);
        const summary = summarizeReplay([sample]);
        assert.equal(summary.requestsPerSecond, 0);
        assert.equal(summary.totalMs.p99, null);
        assert.equal(summary.gcMs, null);
    });

    it("surfaces data-set construction errors rather than counting them as expected row-model failures", async () => {
        await assert.rejects(
            runReplayCase(
                makeWorkloads(2)[0],
                payload(),
                () => {
                    throw new Error("Broken construction");
                },
                limits,
            ),
            /Broken construction/,
        );
    });

    it("records separate real CPU/allocation profiles and removes private stack paths", async () => {
        for (const profile of ["cpu", "heap"] as const) {
            const result = await runReplayCase(makeWorkloads(2)[0], payload(), construct, { ...limits, profile });
            const captured = result.cpuProfile ?? result.heapProfile;
            assert.ok(captured);
            assert.ok(Array.isArray(result.sample.gcEvents));
            const directory = join(process.cwd(), "private-profile-path");
            const source = pathToFileURL(join(directory, "models.js")).href;
            if ("nodes" in captured) {
                assert.ok(captured.nodes.length > 0);
                captured.nodes[0].callFrame.url = source;
            } else {
                captured.head.callFrame.url = source;
            }
            sanitizeProfileLocations(captured, [{ directory, label: "sdk" }]);
            const output = JSON.stringify(captured);
            assert.ok(output.includes("sdk:models.js"));
            assert.ok(!output.includes("private-profile-path"));
            assert.ok(!output.includes("file:///"));
        }
    });

    it("bounds replay work and refuses mixed capture/worker or invalid profiling configurations", () => {
        assert.throws(() => readReplayOptions([]), /provide --before and --fixtures/);
        for (const args of [
            ["--rows", "1 | .drop table x"],
            ["--profile", "both"],
            ["--warmup", "0"],
            ["--iterations", "200", "--warmup", "50", "--rounds", "5"],
            ["--worker", "before"],
            ["--capture"],
        ]) {
            assert.throws(() => readReplayOptions(["--before", ".", "--fixtures", "synthetic.json", ...args]));
        }
        assert.equal(readReplayOptions(["--capture", "--rows", "5000"]).capture, true);
    });
});
