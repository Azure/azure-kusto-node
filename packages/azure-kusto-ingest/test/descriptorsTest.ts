// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { Readable } from "stream";
import { DataFormat, IngestionDescriptors, IngestionProperties } from "azure-kusto-ingest";
import { generateBlobName } from "../src/descriptors.js";
import { FileDescriptor } from "../src/fileDescriptor.js";
import { readFile, writeFile } from "fs/promises";
import { file as tmpFile } from "tmp-promise";
import { gunzipSync } from "zlib";

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
    });
});
