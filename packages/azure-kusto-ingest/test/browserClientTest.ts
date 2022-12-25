// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable no-console */

import assert from "assert";
import IngestClient from "../src/ingestClient.browser";
import { KustoConnectionStringBuilder as ConnectionStringBuilder } from "azure-kusto-data/src/connectionBuilder.browser";
import {Client} from "azure-kusto-data"
// import StreamingIngestClient from "../../src/streamingIngestClient";
// import { StreamingIngestClient } from "azure-kusto-ingest";
import sinon from "sinon";
import ResourceManager, { ResourceURI } from "../src/resourceManager";
import { ContainerClient } from "@azure/storage-blob";


describe(`Browser Unit tests`, () => {
    const cluster = "https://somecluster.kusto.windows.net";
    const storage = "https://storage.blob.windows.net/container";
    const getMockedClient = () => {
        const sandbox = sinon.createSandbox();

        // const mockedStreamingIngestClient = new StreamingIngestClient("http://test.kusto.com");
        const mockedIngestClient = new IngestClient("http://test.kusto.com");
        // const streamStub = sinon.stub(mockedStreamingIngestClient, "ingestFromFile");
        const queuedStub = sinon.stub(mockedIngestClient, "ingestFromFile");

        const resourceManager = new ResourceManager(new Client(cluster));
        const resourceManagerStub = sinon.stub(resourceManager, "getBlockBlobClient");
        resourceManagerStub.returns(Promise.resolve<ContainerClient>([new ContainerClient(storage)]))
        mockedIngestClient.resourceManager = resourceManager;
        return { sandbox, queuedStub,mockedIngestClient };
    };

    describe("Kcsb", () => {
        it("Fail to create non-browser compatible authentication", () => {
            try {
                ConnectionStringBuilder.withAadApplicationKeyAuthentication(cluster,"","");
            } catch (ex) {
                assert(
                    ex instanceof Error &&
                        ex.message.startsWith(
                            "Not supported for browser"
                        )
                );
                return;
            }

            assert.fail();
        });
        it("Create browser compatible authentication with params", () => {
            ConnectionStringBuilder.withUserPrompt(cluster, {redirectUri:"redirect", clientId: "cid"});
        });
        it("Create browser compatible authentication must provide clientId", () => {
            try {
                ConnectionStringBuilder.withUserPrompt(cluster, {redirectUri:"redirect"});
            } catch (ex) {
                assert(
                    ex instanceof Error &&
                        ex.message.startsWith(
                            "Invalid parameters"
                        )
                );
                return;
            }

            assert.fail();
        });
        it("Create browser compatible authentication must provide redirectUri", () => {
            try {
                ConnectionStringBuilder.withUserPrompt(cluster, {clientId:"cid"});
            } catch (ex) {
                assert(
                    ex instanceof Error &&
                        ex.message.startsWith(
                            "Invalid parameters"
                        )
                );
                return;
            }

            assert.fail();
        });
        it("Create browser compatible authentication must provide redirectUri", () => {
            try {
                ConnectionStringBuilder.withUserPrompt(cluster, {clientId:"cid"});
            } catch (ex) {
                assert(
                    ex instanceof Error &&
                        ex.message.startsWith(
                            "Ivalid parameters"
                        )
                );
                return;
            }

            assert.fail();
        });
        it("Only ingest from Blob object", async () => {
            const cli = new IngestClient(cluster);
            try {
                await cli.ingestFromFile(new Blob());
            } catch (ex) {
                assert(
                    ex instanceof Error &&
                        ex.message.startsWith(
                            "Expected object of type Blob"
                        )
                );
            }
            const {queuedStub,sandbox, mockedIngestClient} = getMockedClient();
            await mockedIngestClient.ingestFromFile(new Blob());
            sandbox.assert.calledOnce(queuedStub);
        });
    });
});

