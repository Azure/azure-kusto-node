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

        it.each([
            { extension: ".csv", format: DataFormat.CSV },
            { extension: ".gz", format: DataFormat.CSV },
            { extension: ".avro", format: DataFormat.AVRO },
        ])("rejects empty $extension content despite a positive stat size and raw-size hint", async ({ extension, format }) => {
            const source = await tmpFile({ postfix: extension });
            const descriptor = new FileDescriptor(source.path, null, 1234);
            const sandbox = sinon.createSandbox();

            try {
                const stats = await fs.promises.stat(source.path);
                stats.size = 4096;
                sandbox.stub(fs, "stat").callThrough().withArgs(source.path).yields(null, stats);

                await assert.rejects(descriptor.prepare({ format }), /Empty file/);
                assert.strictEqual(descriptor.cleanupTmp, undefined);
            } finally {
                sandbox.restore();
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
                const prepared = await descriptor.prepare({ format: DataFormat.AVRO });

                assert.notStrictEqual(prepared, source.path);
                assert.deepStrictEqual(await readFile(prepared), input);
                assert.strictEqual(descriptor.size, input.length);
            } finally {
                await descriptor.cleanup();
                await source.cleanup();
            }
        });

        it.each([
            { extension: ".avro", format: DataFormat.CSV, size: null, fileSize: 4096, length: 18 },
            { extension: ".csv", format: DataFormat.AVRO, size: 1234, fileSize: 4096, length: 18 },
            { extension: ".gz", format: DataFormat.CSV, size: null, fileSize: 4096, length: 18 },
            { extension: ".avro", format: DataFormat.AVRO, size: null, fileSize: 1, length: 64 * 1024 + 18 },
            { extension: ".avro", format: DataFormat.AVRO, size: null, fileSize: 1024 * 1024, length: 128 * 1024 },
            { extension: ".avro", format: DataFormat.AVRO, size: null, fileSize: 128 * 1024, length: 256 * 1024 },
            { extension: ".gz", format: DataFormat.CSV, size: null, fileSize: 1024 * 1024, length: 128 * 1024 },
        ])(
            "counts complete $extension input with hint $size when stat incorrectly reports $fileSize bytes",
            async ({ extension, format, size, fileSize, length }) => {
                const source = await tmpFile({ postfix: extension });
                const descriptor = new FileDescriptor(source.path, null, size);
                const sandbox = sinon.createSandbox();
                const payload = Buffer.alloc(length, "a");
                const input = extension === ".gz" ? gzipSync(payload, { level: 0 }) : payload;
                let prepared: string | undefined;

                try {
                    await writeFile(source.path, input);
                    const stats = await fs.promises.stat(source.path);
                    stats.size = fileSize;
                    sandbox.stub(fs, "stat").callThrough().withArgs(source.path).yields(null, stats);

                    prepared = await descriptor.prepare({ format });

                    assert.strictEqual(descriptor.size, size ?? input.length * (descriptor.zipped ? 11 : 1));
                    assert.deepStrictEqual(await readFile(prepared), input);
                    assert.notStrictEqual(prepared, source.path);
                } finally {
                    sandbox.restore();
                    await descriptor.cleanup();
                    await source.cleanup();
                }

                assert.ok(prepared);
                await assert.rejects(readFile(prepared), { code: "ENOENT" });
            },
        );

        it("preserves the completed input when the original changes after preparation", async () => {
            const source = await tmpFile({ postfix: ".avro" });
            const descriptor = new FileDescriptor(source.path);
            const input = Buffer.alloc(64 * 1024 + 18, "a");

            try {
                await writeFile(source.path, input);

                const prepared = await descriptor.prepare();
                await writeFile(source.path, "changed");

                assert.notStrictEqual(prepared, source.path);
                assert.deepStrictEqual(await readFile(prepared), input);
                assert.strictEqual(descriptor.size, input.length);
            } finally {
                await descriptor.cleanup();
                await source.cleanup();
            }
        });

        it("cleans up all concurrent preparations through the legacy cleanup API", async () => {
            const source = await tmpFile({ postfix: ".csv" });
            const descriptor = new FileDescriptor(source.path);
            const input = Buffer.from("value\n123\n");

            try {
                await writeFile(source.path, input);
                const prepared = await Promise.all([descriptor.prepare(), descriptor.prepare()]);

                assert.notStrictEqual(prepared[0], prepared[1]);
                for (const path of prepared) {
                    assert.deepStrictEqual(gunzipSync(await readFile(path)), input);
                }
                await descriptor.cleanup();
                await descriptor.cleanup();
                for (const path of prepared) {
                    await assert.rejects(readFile(path), { code: "ENOENT" });
                }
            } finally {
                await descriptor.cleanup();
                await source.cleanup();
            }
        });

        it.each([null, 3])("distinguishes a calculated size from a subsequently assigned hint %s on reuse", async (hint) => {
            const source = await tmpFile({ postfix: ".avro" });
            const descriptor = new FileDescriptor(source.path);
            const input = Buffer.alloc(128 * 1024, "a");

            try {
                await writeFile(source.path, "old");
                await descriptor.prepare();
                assert.strictEqual(descriptor.size, 3);
                if (hint !== null) {
                    descriptor.size = hint;
                }

                await writeFile(source.path, input);
                const prepared = await descriptor.prepare();

                assert.deepStrictEqual(await readFile(prepared), input);
                assert.strictEqual(descriptor.size, hint ?? input.length);
            } finally {
                await descriptor.cleanup();
                await source.cleanup();
            }
        });

        it.each([".csv", ".avro"])("removes its own temporary %s file after a stream failure and closes the source", async (extension) => {
            const source = await tmpFile({ postfix: extension });
            const descriptor = new FileDescriptor(source.path);
            const sandbox = sinon.createSandbox();
            const error = new Error("Unable to read remaining input");
            await writeFile(source.path, "value\n123\n");
            const input = await fs.promises.open(source.path, "r");
            const tail = input.createReadStream({ autoClose: false });
            sandbox.stub(tail, "_read").callsFake(() => {
                tail.destroy(error);
            });
            sandbox.stub(input, "createReadStream").returns(tail);
            sandbox.stub(fs.promises, "open").callThrough().withArgs(source.path, "r").resolves(input);
            const output = sandbox.spy(fs, "createWriteStream");

            try {
                await assert.rejects(descriptor.prepare(), (actual) => actual === error);

                assert.strictEqual(input.fd, -1);
                sandbox.assert.calledOnce(output);
                const prepared = output.firstCall.args[0];
                assert.strictEqual(typeof prepared, "string");
                await assert.rejects(readFile(prepared), { code: "ENOENT" });
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

        it.each([
            { extension: ".csv", compress: true },
            { extension: ".avro", compress: false },
        ])("preserves a complete one-shot zero-stat $extension read", async ({ extension, compress }) => {
            const source = await tmpFile({ postfix: extension });
            const descriptor = new FileDescriptor(source.path);
            const sandbox = sinon.createSandbox();
            const payload = Buffer.from("9223372036854775807\n");
            await writeFile(source.path, payload);
            const input = await fs.promises.open(source.path, "r");

            try {
                const stats = await fs.promises.stat(source.path);
                stats.size = 0;
                sandbox.stub(fs, "stat").callThrough().withArgs(source.path).yields(null, stats);
                sandbox.stub(fs.promises, "open").withArgs(source.path, "r").resolves(input);
                sandbox.stub(input, "createReadStream").returns(fs.createReadStream(source.path, { fd: input.fd, autoClose: false, start: payload.length }));

                const prepared = await descriptor.prepare();
                const content = await readFile(prepared);

                assert.deepStrictEqual(compress ? gunzipSync(content) : content, payload);
                assert.strictEqual(descriptor.size, payload.length);
            } finally {
                sandbox.restore();
                if (input.fd !== -1) {
                    await input.close();
                }
                await descriptor.cleanup();
                await source.cleanup();
            }
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

        linuxTest("preserves the complete value of a one-shot procfs file", async () => {
            const source = pathlib.join(pathlib.sep, "proc", "sys", "fs", "file-max");
            const expected = await readFile(source);
            const descriptor = new FileDescriptor(source);

            try {
                const prepared = await descriptor.prepare();

                assert.deepStrictEqual(gunzipSync(await readFile(prepared)), expected);
                assert.strictEqual(descriptor.size, expected.length);
            } finally {
                await descriptor.cleanup();
            }
        });

        linuxTest("counts sysfs content despite an inflated positive stat size", async () => {
            const source = pathlib.join(pathlib.sep, "sys", "class", "net", "lo", "address");
            const expected = await readFile(source);
            const descriptor = new FileDescriptor(source);

            try {
                assert.ok((await fs.promises.stat(source)).size > expected.length);

                const prepared = await descriptor.prepare({ format: DataFormat.AVRO });

                assert.strictEqual(descriptor.size, expected.length);
                assert.deepStrictEqual(await readFile(prepared), expected);
            } finally {
                await descriptor.cleanup();
            }
        });
    });
});
