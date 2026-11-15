// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DataFormat, FileDescriptor } from "azure-kusto-ingest";
import "../dist/SampleApp.js";
import { Ingestion } from "../dist/Utils.js";

test("ingests bundled data independently of the working directory", async () => {
    const originalDirectory = process.cwd();
    const dataset = fileURLToPath(new URL("../src/dataset.csv", import.meta.url));
    const expected = await readFile(dataset, "utf8");
    let ingested = false;
    const client = {
        async ingestFromFile(descriptor) {
            assert.ok(descriptor instanceof FileDescriptor);
            assert.equal(descriptor.file, dataset);
            assert.equal(await readFile(descriptor.file, "utf8"), expected);
            ingested = true;
        },
    };

    try {
        process.chdir(tmpdir());
        await Ingestion.ingestFromFile(client, "database", "table", "dataset.csv", DataFormat.CSV, "", false);
        assert.ok(ingested);
    } finally {
        process.chdir(originalDirectory);
    }
});

test("preserves absolute ingestion paths containing spaces", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kusto-quickstart-"));
    const file = join(directory, "data with spaces.csv");
    await writeFile(file, "value\n1\n");
    let ingested = false;
    const client = {
        async ingestFromFile(descriptor) {
            assert.equal(descriptor.file, file);
            assert.equal(await readFile(descriptor.file, "utf8"), "value\n1\n");
            ingested = true;
        },
    };

    try {
        await Ingestion.ingestFromFile(client, "database", "table", file, DataFormat.CSV, "", false);
        assert.ok(ingested);
    } finally {
        await rm(directory, { recursive: true });
    }
});
