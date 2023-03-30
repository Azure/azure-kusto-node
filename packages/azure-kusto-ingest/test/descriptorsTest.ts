// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { Readable } from "stream";
import { DataFormat, IngestionDescriptors, IngestionProperties } from "../src";
import { generateBlobName } from "../src/descriptors";

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
});
