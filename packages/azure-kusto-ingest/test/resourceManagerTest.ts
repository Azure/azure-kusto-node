// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";

import sinon from "sinon";

import { Client as KustoClient, TimeUtils } from "azure-kusto-data";
import { IngestClientResources, ResourceManager, ResourceURI } from "../src/resourceManager";
import { KustoResponseDataSet } from "azure-kusto-data/types/src/response";
import { sleep } from "../src/retry";

describe("ResourceManager", () => {
    const rows = [
        {
            ResourceTypeName: "SecuredReadyForAggregationQueue",
            StorageRoot: "https://account.queue.core.windows.net/ready1?sas",
        },
        { ResourceTypeName: "FailedIngestionsQueue", StorageRoot: "https://account.queue.core.windows.net/failed?sas" },
        {
            ResourceTypeName: "SuccessfulIngestionsQueue",
            StorageRoot: "https://account.queue.core.windows.net/success?sas",
        },
        {
            ResourceTypeName: "SecuredReadyForAggregationQueue",
            StorageRoot: "https://account.queue.core.windows.net/ready2?sas",
        },
        { ResourceTypeName: "TempStorage", StorageRoot: "https://account.blob.core.windows.net/t1?sas" },
        { ResourceTypeName: "TempStorage", StorageRoot: "https://account.blob.core.windows.net/t2?sas" },
    ];

    const mockedResourcesResponse = {
        primaryResults: [
            {
                *rows() {
                    for (const row of rows) {
                        yield row;
                    }
                },
            },
        ],
    };

    describe("#constructor()", () => {
        it.concurrent("valid input", () => {
            const resourceManager = new ResourceManager(new KustoClient("https://cluster.kusto.windows.net"));

            assert.strictEqual(resourceManager.ingestClientResources, null);
            assert.strictEqual(resourceManager.authorizationContext, null);
        });
    });

    describe("#getIngestClientResourcesFromService()", () => {
        it.concurrent("valid input", async () => {
            const client = new KustoClient("https://cluster.kusto.windows.net");
            sinon.stub(client, "execute").returns(Promise.resolve(mockedResourcesResponse as KustoResponseDataSet));

            const resourceManager = new ResourceManager(client);

            const resources = await resourceManager.getIngestClientResourcesFromService();
            assert.strictEqual(resources.containers!.length, 2);
            assert.strictEqual(resources.successfulIngestionsQueues!.length, 1);
            assert.strictEqual(resources.failedIngestionsQueues!.length, 1);
            assert.strictEqual(resources.securedReadyForAggregationQueues!.length, 2);
        });

        it.concurrent("error response", async () => {
            const client = new KustoClient("https://cluster.kusto.windows.net");
            sinon.stub(client, "execute").throwsException(new Error("Kusto request erred (403)"));

            const resourceManager = new ResourceManager(client);
            try {
                await resourceManager.getIngestClientResourcesFromService();
            } catch (ex: any) {
                assert.ok(ex instanceof Error);
                assert(ex.message.startsWith("Kusto request erred (403)"));
                return;
            }
            assert.fail();
        });
    });

    describe("#getResourceByName()", () => {
        it.concurrent("valid input", () => {
            const resourceManager = new ResourceManager(new KustoClient("https://cluster.kusto.windows.net"));

            const resources = resourceManager.getResourceByName(mockedResourcesResponse.primaryResults[0], "TempStorage");
            assert.strictEqual(resources.length, 2);
        });
    });

    describe("#refreshIngestClientResources()", () => {
        it.concurrent("should refresh", async () => {
            const resourceManager = new ResourceManager(new KustoClient("https://cluster.kusto.windows.net"));

            const call = sinon.stub(resourceManager, "getIngestClientResourcesFromService").returns(Promise.resolve(new IngestClientResources([], [], [], [])));

            await resourceManager.refreshIngestClientResources();
            assert.strictEqual(call.calledOnce, true);
        });

        it.concurrent("Should use cached resources if available", async () => {
            // Setup with pre-existing resources
            const client = new KustoClient("https://cluster.kusto.windows.net");
            const resourceManager = new ResourceManager(client);
            resourceManager.refreshPeriodOnError = TimeUtils.toMilliseconds(0, 0, 2);
            const sin = sinon.stub(resourceManager, "getIngestClientResourcesFromService");
            resourceManager.ingestClientResourcesLastUpdate = Date.now();
            const initialResources = new IngestClientResources([], [], [], []);
            resourceManager.ingestClientResources = initialResources;

            // Expect resources to not be re-fetched as old values are still ok
            await resourceManager.refreshIngestClientResources();
            assert.strictEqual(sin.calledOnce, false);

            // Set values to be considered old, refresh throws but resource manager returns old resources
            const date = new Date();
            date.setDate(date.getDate() + 1);
            resourceManager.ingestClientResourcesLastUpdate = date.getDate();
            sin.throwsException(new Error());
            const res = await resourceManager.refreshIngestClientResources();
            assert.strictEqual(res, initialResources);

            // Resources should be fetched in the backend after last error, expect resources to equal the new ones
            const secondResources = new IngestClientResources([new ResourceURI("")], [], [], []);
            sin.returns(Promise.resolve(secondResources));
            await sleep(resourceManager.refreshPeriodOnError + 100);
            assert.strictEqual(resourceManager.ingestClientResources, secondResources);
        });
    });
});
