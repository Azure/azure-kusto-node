// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { Readable } from "stream";
import { DataFormat, IngestionDescriptors, IngestionProperties } from "azure-kusto-ingest";
import { generateBlobName } from "../src/descriptors.js";
import { FileDescriptor } from "../src/fileDescriptor.js";
import { readFile, writeFile } from "fs/promises";
import { file as tmpFile } from "tmp-promise";
import { gunzipSync, gzipSync } from "zlib";
import fs from "fs";
import pathlib from "path";
import sinon from "sinon";

describe("FileDescriptor", () => {
    describe("#constructor()", () => {
        it.concurrent("valid input zipped", () => {
            const desc = new IngestionDescriptors.FileDescriptor("./data/events.json.gz");

            assert.strictEqual(desc.name, "events.json.gz");
            assert.strictEqual(desc.extension, ".gz");
            assert.strictEqual(desc.zipped, true);
        });

        it.concurrent("valid input json", () => {
            const desc = new IngestionDescriptors.FileDescriptor("./data/events.json");

            assert.strictEqual(desc.name, "events.json");
            assert.strictEqual(desc.extension, ".json");
            assert.strictEqual(desc.zipped, false);
        });
        it.concurrent("generate blob name for file descriptor", () => {
            const desc = new IngestionDescriptors.FileDescriptor("./data/events.json");
            const props = new IngestionProperties({ database: "db", table: "table", format: DataFormat.JSON });
            const blobName = generateBlobName(desc, props);

            assert.match(blobName, new RegExp("db__table[\\w-]+events\\.json\\.gz"));
        });
        it.concurrent("generate blob name for stream descriptor", () => {
            const desc = new IngestionDescriptors.StreamDescriptor(new Readable());
            const props = new IngestionProperties({ database: "db", table: "table", format: DataFormat.JSON });
            const blobName = generateBlobName(desc, props);

            assert.match(blobName, new RegExp("db__table[\\w-]+\\.json"));
        });
    });

    describe("#prepare()", () => {
        it.each([
            { extension: ".csv", format: DataFormat.CSV },
            { extension: ".gz", format: DataFormat.CSV },
            { extension: ".avro", format: DataFormat.AVRO },
        ])("rejects an empty $extension file", async ({ extension, format }) => {
            const source = await tmpFile({ postfix: extension });
            const descriptor = new FileDescriptor(source.path);

            try {
                await assert.rejects(descriptor.prepare({ format }), /Empty file/);
                assert.strictEqual(descriptor.cleanupTmp, undefined);
            } finally {
                await descriptor.cleanup();
                await source.cleanup();
            }
        });

        it.each([null, 1234])("compresses nonempty data while preserving raw-size hint %s", async (size) => {
            const source = await tmpFile({ postfix: ".csv" });
            const descriptor = new FileDescriptor(source.path, null, size);
            const input = Buffer.from("value\n123\n");

            try {
                await writeFile(source.path, input);
                const prepared = await descriptor.prepare();
                assert.deepStrictEqual(gunzipSync(await readFile(prepared)), input);
                assert.strictEqual(descriptor.size, size ?? input.length);
            } finally {
                await descriptor.cleanup();
                await source.cleanup();
            }
        });

        it.each([".avro", ".csv"])("does not inflate the size of uncompressed binary data in a %s file", async (extension) => {
            const source = await tmpFile({ postfix: extension });
            const descriptor = new FileDescriptor(source.path);
            const input = Buffer.from("uncompressed binary data");

            try {
                await writeFile(source.path, input);
                assert.strictEqual(await descriptor.prepare({ format: DataFormat.AVRO }), source.path);
                assert.strictEqual(descriptor.size, input.length);
            } finally {
                await descriptor.cleanup();
                await source.cleanup();
            }
        });

        it.each([
            { extension: ".csv", format: DataFormat.CSV, compress: true, size: null },
            { extension: ".csv", format: DataFormat.CSV, compress: true, size: 1234 },
            { extension: ".gz", format: DataFormat.CSV, compress: false, size: null },
            { extension: ".avro", format: DataFormat.AVRO, compress: false, size: null },
            { extension: ".csv", format: DataFormat.AVRO, compress: false, size: null },
        ])("preserves nonempty $extension content with $format and hint $size when stat reports zero", async ({ extension, format, compress, size }) => {
            const source = await tmpFile({ postfix: extension });
            const descriptor = new FileDescriptor(source.path, null, size);
            const sandbox = sinon.createSandbox();
            const payload = Buffer.from("value\n123\n".repeat(8192));
            const input = extension === ".gz" ? gzipSync(payload) : payload;
            let prepared: string | undefined;

            try {
                await writeFile(source.path, input);
                const stats = await fs.promises.stat(source.path);
                stats.size = 0;
                sandbox.stub(fs, "stat").callThrough().withArgs(source.path).yields(null, stats);

                prepared = await descriptor.prepare({ format });

                const uploaded = await readFile(prepared);
                assert.deepStrictEqual(compress ? gunzipSync(uploaded) : uploaded, input);
                if (size !== null) {
                    assert.strictEqual(descriptor.size, size);
                } else if (descriptor.zipped) {
                    assert.ok(descriptor.size !== null && descriptor.size > input.length);
                } else {
                    assert.strictEqual(descriptor.size, input.length);
                }
            } finally {
                sandbox.restore();
                await descriptor.cleanup();
                await source.cleanup();
            }

            assert.ok(prepared);
            await assert.rejects(readFile(prepared), { code: "ENOENT" });
        });

        it("propagates a zero-stat input read failure and closes the file", async () => {
            const source = await tmpFile({ postfix: ".csv" });
            const descriptor = new FileDescriptor(source.path);
            const input = await fs.promises.open(source.path, "r");
            const sandbox = sinon.createSandbox();
            const error = new Error("Unable to read input");

            try {
                sandbox.stub(fs.promises, "open").withArgs(source.path, "r").resolves(input);
                sandbox.stub(input, "read").rejects(error);
                const close = sandbox.spy(input, "close");

                await assert.rejects(descriptor.prepare(), (actual) => actual === error);

                sandbox.assert.calledOnce(close);
                assert.strictEqual(descriptor.cleanupTmp, undefined);
            } finally {
                sandbox.restore();
                if (input.fd !== -1) {
                    await input.close();
                }
                await descriptor.cleanup();
                await source.cleanup();
            }
        });

        const linuxTest = process.platform === "linux" ? it : it.skip;
        linuxTest("prepares nonempty procfs content despite a zero stat size", async () => {
            const descriptor = new FileDescriptor(pathlib.join(pathlib.sep, "proc", "self", "status"), null, 1234);

            try {
                const prepared = await descriptor.prepare();
                const content = gunzipSync(await readFile(prepared)).toString();

                assert.match(content, /^Name:/);
                assert.match(content, new RegExp(`^Pid:\\s+${process.pid}$`, "m"));
                assert.strictEqual(descriptor.size, 1234);
            } finally {
                await descriptor.cleanup();
            }
        });
    });
});
