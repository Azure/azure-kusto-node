// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable no-console */

import assert from "assert";
import IngestClient from "../src/ingestClient.browser.js";
import sinon from "sinon";
import { BlobDescriptor, CompressionType } from "../src/descriptors.js";
import { FileDescriptor } from "../src/fileDescriptor.browser.js";
import { DataFormat } from "../src/ingestionProperties.js";
import { gunzipSync, gzipSync } from "zlib";
import pako from "pako";

describe("Kcsb", () => {
    describe("queued file preparation", () => {
        let sandbox: sinon.SinonSandbox;
        let client: IngestClient;

        beforeEach(() => {
            sandbox = sinon.createSandbox();
            client = new IngestClient("https://cluster.kusto.windows.net", { table: "table", database: "db" });
        });

        afterEach(() => {
            sandbox.restore();
            client.close();
        });

        it.each([null, 1234])("compresses a real Blob and queues raw-size hint %s", async (size) => {
            const input = new Blob(["value\n123\n"]);
            const descriptor = new FileDescriptor(input, null, size);
            assert.strictEqual(descriptor.size, size ?? input.size);
            const queued = sandbox.stub(client, "ingestFromBlob").resolves();
            const upload = sandbox.stub(client, "uploadToBlobWithRetry").resolves("https://storage.blob.core.windows.net/container/file.csv.gz");

            await client.ingestFromFile(descriptor);

            sandbox.assert.calledOnce(upload);
            sandbox.assert.calledOnce(queued);
            const uploaded = upload.firstCall.args[0];
            assert.ok(uploaded instanceof Blob);
            assert.deepStrictEqual(gunzipSync(Buffer.from(await uploaded.arrayBuffer())), Buffer.from(await input.arrayBuffer()));
            const blobDescriptor = queued.firstCall.args[0];
            assert.ok(blobDescriptor instanceof BlobDescriptor);
            assert.strictEqual(blobDescriptor.size, size ?? input.size);
        });

        it.each([
            { name: "plain", size: null, compressionType: CompressionType.None, format: DataFormat.CSV },
            { name: "positive size hint", size: 1234, compressionType: CompressionType.None, format: DataFormat.CSV },
            { name: "compressed", size: null, compressionType: CompressionType.GZIP, format: DataFormat.CSV },
            { name: "binary", size: null, compressionType: CompressionType.None, format: DataFormat.AVRO },
        ])("rejects an empty Blob ($name) before uploading or queuing", async ({ size, compressionType, format }) => {
            const upload = sandbox.stub(client, "uploadToBlobWithRetry").resolves("https://storage.blob.core.windows.net/container/file");
            const queued = sandbox.stub(client, "ingestFromBlob").resolves();
            const descriptor = new FileDescriptor(new Blob([]), null, size, compressionType);

            await assert.rejects(client.ingestFromFile(descriptor, { format }), /Empty file/);

            sandbox.assert.notCalled(upload);
            sandbox.assert.notCalled(queued);
        });

        it.each(["read", "gzip"])("propagates a Blob %s failure without uploading or queuing", async (operation) => {
            const input = new Blob(["value\n123\n"]);
            const error = new Error(`Failed to ${operation}`);
            if (operation === "read") {
                sandbox.stub(input, "arrayBuffer").rejects(error);
            } else {
                sandbox.stub(pako, "gzip").throws(error);
            }
            const upload = sandbox.stub(client, "uploadToBlobWithRetry").resolves("https://storage.blob.core.windows.net/container/file");
            const queued = sandbox.stub(client, "ingestFromBlob").resolves();

            await assert.rejects(client.ingestFromFile(input), (actual) => actual === error);

            sandbox.assert.notCalled(upload);
            sandbox.assert.notCalled(queued);
        });

        it.each(["default", "zero", "explicit"] as const)("queues raw size for an already-compressed Blob with a %s hint", async (hint) => {
            const input = new Blob([new Uint8Array(gzipSync("value\n123\n"))]);
            const size = hint === "default" ? null : hint === "zero" ? 0 : input.size;
            const descriptor = new FileDescriptor(input, null, size, CompressionType.GZIP);
            assert.strictEqual(descriptor.size, size || input.size);
            const upload = sandbox.stub(client, "uploadToBlobWithRetry").resolves("https://storage.blob.core.windows.net/container/file.csv.gz");
            const queued = sandbox.stub(client, "ingestFromBlob").resolves();

            await client.ingestFromFile(descriptor);

            assert.strictEqual(upload.firstCall.args[0], input);
            const blobDescriptor = queued.firstCall.args[0];
            assert.ok(blobDescriptor instanceof BlobDescriptor);
            assert.strictEqual(blobDescriptor.size, descriptor.size);
            if (hint === "explicit") {
                assert.strictEqual(blobDescriptor.size, size);
            } else {
                assert.ok(blobDescriptor.size !== null && blobDescriptor.size > input.size);
            }
            assert.strictEqual(await descriptor.prepare(), input);
            assert.strictEqual(descriptor.size, blobDescriptor.size);
        });

        it.each([false, true])("preserves an assigned raw-size hint after prior preparation: %s", async (prepareFirst) => {
            const input = new Blob([new Uint8Array(gzipSync("value\n123\n"))]);
            const descriptor = new FileDescriptor(input, null, null, CompressionType.GZIP);
            if (prepareFirst) {
                await descriptor.prepare();
            }
            descriptor.size = input.size;
            sandbox.stub(client, "uploadToBlobWithRetry").resolves("https://storage.blob.core.windows.net/container/file.csv.gz");
            const queued = sandbox.stub(client, "ingestFromBlob").resolves();

            await client.ingestFromFile(descriptor);

            const blobDescriptor = queued.firstCall.args[0];
            assert.ok(blobDescriptor instanceof BlobDescriptor);
            assert.strictEqual(blobDescriptor.size, input.size);
            assert.strictEqual(await descriptor.prepare(), input);
            assert.strictEqual(descriptor.size, input.size);
        });

        it("does not compress or inflate the raw size of uncompressed binary data", async () => {
            const input = new Blob(["uncompressed binary data"]);
            const upload = sandbox.stub(client, "uploadToBlobWithRetry").resolves("https://storage.blob.core.windows.net/container/file.avro");
            const queued = sandbox.stub(client, "ingestFromBlob").resolves();

            await client.ingestFromFile(input, { format: DataFormat.AVRO });

            assert.strictEqual(upload.firstCall.args[0], input);
            const blobDescriptor = queued.firstCall.args[0];
            assert.ok(blobDescriptor instanceof BlobDescriptor);
            assert.strictEqual(blobDescriptor.size, input.size);
        });
    });

    it.concurrent("auto correct from query endpoint", () => {
        const client = new IngestClient("https://somecluster.kusto.windows.net");
        assert.strictEqual(
            client.resourceManager.kustoClient.cluster,
            "https://ingest-somecluster.kusto.windows.net",
            "Kusto cluster URL does not match expected value",
        );
    });
    it.concurrent("auto correct from ingestion endpoint", () => {
        const client = new IngestClient("https://ingest-somecluster.kusto.windows.net");
        assert.strictEqual(
            client.resourceManager.kustoClient.cluster,
            "https://ingest-somecluster.kusto.windows.net",
            "Kusto cluster URL does not match expected value",
        );
    });
});
