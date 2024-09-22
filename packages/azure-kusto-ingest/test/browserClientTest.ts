// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable no-console */

import assert from "assert";
import IngestClient from "../src/ingestClient.browser.js";
import sinon from "sinon";
import { IngestionResult } from "azure-kusto-ingest";

describe("Kcsb", () => {
    it.concurrent("Ingest from browser calls the right components", async () => {
        const sandbox = sinon.createSandbox();

        const mockedIngestClient = new IngestClient("http://test.kusto.com", {
            table: "t1",
            database: "d1",
        });

        const queuedStub = sinon.stub(mockedIngestClient, "ingestFromBlob");
        queuedStub.resolves({} as IngestionResult);
        const blobUploadStub = sinon.stub(mockedIngestClient, "uploadToBlobWithRetry");
        blobUploadStub.resolves("https://storage.blob.windows.net/container/file.json.gz");

        await mockedIngestClient.ingestFromFile({} as Blob);
        sandbox.assert.calledOnce(queuedStub);
        sandbox.assert.calledOnce(blobUploadStub);
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
