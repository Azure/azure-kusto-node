// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";

import moment from "moment";

import sinon from "sinon";

// @ts-ignore
import {Client as KustoClient} from "azure-kusto-data";

import {IngestClientResources, ResourceManager, ResourceURI} from "../source/resourceManager";

describe("ResourceURI", function () {
    describe("#fromUri()", function () {
        it("valid input", function () {
            const accountName = "account";
            const objectType = "blob";
            const objectName = "container";
            const sas = "sas";

            let uri = `https://${accountName}.${objectType}.core.windows.net/${objectName}?${sas}`;
            const storageUrl = ResourceURI.fromURI(uri);

            assert.strictEqual(storageUrl.storageAccountName, accountName);
            assert.strictEqual(storageUrl.objectType, objectType);
            assert.strictEqual(storageUrl.objectName, objectName);
            assert.strictEqual(storageUrl.sas, sas);
        });
    });

    describe("#getSASConnectionString()", function () {
        it("valid input", function () {
            const accountName = "account";
            const objectType = "blob";
            const objectName = "container";
            const sas = "sas";


            const storageUrl = new ResourceURI(accountName, objectType, objectName, sas);

            assert.strictEqual(storageUrl.getSASConnectionString(), `BlobEndpoint=https://${accountName}.blob.core.windows.net/;SharedAccessSignature=${sas}`);
        });
    });
});


describe("ResourceManager", function () {
    const rows = [
        { ResourceTypeName: "SecuredReadyForAggregationQueue", StorageRoot: "https://account.queue.core.windows.net/ready1?sas" },
        { ResourceTypeName: "FailedIngestionsQueue", StorageRoot: "https://account.queue.core.windows.net/failed?sas" },
        { ResourceTypeName: "SuccessfulIngestionsQueue", StorageRoot: "https://account.queue.core.windows.net/success?sas" },
        { ResourceTypeName: "SecuredReadyForAggregationQueue", StorageRoot: "https://account.queue.core.windows.net/ready2?sas" },
        { ResourceTypeName: "TempStorage", StorageRoot: "https://account.blob.core.windows.net/t1?sas" },
        { ResourceTypeName: "TempStorage", StorageRoot: "https://account.blob.core.windows.net/t2?sas" }
    ];

    const mockedResourcesResponse = {
        primaryResults: [{
            rows: function* () {
                for (let row of rows) {
                    yield row;
                }
            }
        }]
    };

    describe("#constructor()", function () {
        it("valid input", function () {
            let resourceManager = new ResourceManager(new KustoClient("https://cluster.kusto.windows.net"));

            assert.strictEqual(resourceManager.ingestClientResources, null);
            assert.strictEqual(resourceManager.authorizationContext, null);
        });
    });

    describe("#getIngestClientResourcesFromService()", function () {
        it("valid input", async function () {
            const client = new KustoClient("https://cluster.kusto.windows.net")
            sinon.stub(client, "execute").returns(mockedResourcesResponse);

            let resourceManager = new ResourceManager(client);

            const resources = await resourceManager.getIngestClientResourcesFromService();
            assert.strictEqual(resources.containers!!.length, 2);
            assert.strictEqual(resources.successfulIngestionsQueues!!.length, 1);
            assert.strictEqual(resources.failedIngestionsQueues!!.length, 1);
            assert.strictEqual(resources.securedReadyForAggregationQueues!!.length, 2);
        });


        it("error response", async function () {
            const client = new KustoClient("https://cluster.kusto.windows.net");
            sinon.stub(client, "execute").throwsException(new Error("Kusto request erred (403)"));

            const resourceManager = new ResourceManager(client);
            try{
                await resourceManager.getIngestClientResourcesFromService();
            }
            catch(ex){
                assert(ex.message.startsWith( "Kusto request erred (403)"));
                return;
            }
            assert.fail();
        });
    });

    describe("#getResourceByName()", function () {
        it("valid input", function () {
            let resourceManager = new ResourceManager(new KustoClient("https://cluster.kusto.windows.net"));

            let resources = resourceManager.getResourceByName(mockedResourcesResponse.primaryResults[0], "TempStorage");
            assert.strictEqual(resources.length, 2);
        });
    });

    describe("#refreshIngestClientResources()", function () {
        it("should refresh", async function () {
            let resourceManager = new ResourceManager(new KustoClient("https://cluster.kusto.windows.net"));

            let call = sinon.stub(resourceManager, "getIngestClientResourcesFromService");

            await resourceManager.refreshIngestClientResources();
            assert.strictEqual(call.calledOnce, true);
        });

        it("shouldn't refresh", async function () {
            let resourceManager = new ResourceManager(new KustoClient("https://cluster.kusto.windows.net"));

            let call = sinon.stub(resourceManager, "getIngestClientResourcesFromService");
            resourceManager.ingestClientResourcesLastUpdate = moment();
            resourceManager.ingestClientResources = new IngestClientResources([], [], [], []);

            await resourceManager.refreshIngestClientResources();
            assert.strictEqual(call.calledOnce, false);
        });
    });
});

