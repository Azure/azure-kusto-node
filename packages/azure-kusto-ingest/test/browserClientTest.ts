// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable no-console */

import assert from "assert";
import { IngestClient } from "../src/ingestClient.browser";
import { KustoConnectionStringBuilder as ConnectionStringBuilder } from "azure-kusto-data/src/connectionBuilder.browser";
import sinon from "sinon";
import { IngestionResult } from "../src/ingestionResult";

describe(`Browser Unit tests`, () => {
    const cluster = "https://somecluster.kusto.windows.net";

    describe("Kcsb", () => {
        it.concurrent("Fail to create non-browser compatible authentication", () => {
            try {
                ConnectionStringBuilder.withAadApplicationKeyAuthentication(cluster, "", "");
            } catch (ex) {
                assert(ex instanceof Error && ex.message.startsWith("Not supported in browser"));
                return;
            }

            assert.fail();
        });
        it.concurrent("Create browser compatible authentication with params", () => {
            ConnectionStringBuilder.withUserPrompt(cluster, { redirectUri: "redirect", clientId: "cid" });
        });
        it.concurrent("Create browser compatible authentication must provide clientId", () => {
            try {
                ConnectionStringBuilder.withUserPrompt(cluster, { redirectUri: "redirect" });
            } catch (ex) {
                assert((ex as Error).message.startsWith("Invalid parameters"));
                return;
            }

            assert.fail();
        });
        it.concurrent("Create browser compatible authentication must provide redirectUri", () => {
            try {
                ConnectionStringBuilder.withUserPrompt(cluster, { clientId: "cid" });
            } catch (ex) {
                assert((ex as Error).message.startsWith("Invalid parameters"));
                return;
            }

            assert.fail();
        });
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
    });
});
