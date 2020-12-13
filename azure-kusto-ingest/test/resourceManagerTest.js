// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const assert = require("assert");
const moment = require("moment");
const sinon = require("sinon");

const KustoClient = require("azure-kusto-data").Client;

const ResourceManager = require("../source/resourceManager").ResourceManager;
const IngestClientResources = require("../source/resourceManager").IngestClientResources;
const ResourceURI = require("../source/resourceManager").ResourceURI;

describe("ResourceURI", function () {
    describe("#fromUri()", function () {
        it("valid input", function () {
            const accountName = "account";
            const objectType = "blob";
            const objectName = "container";
            const sas = "sas";

            let uri = `https://${accountName}.${objectType}.core.windows.net/${objectName}?${sas}`;
            const storageUrl = ResourceURI.fromURI(uri);

            assert.equal(storageUrl.storageAccountName, accountName);
            assert.equal(storageUrl.objectType, objectType);
            assert.equal(storageUrl.objectName, objectName);
            assert.equal(storageUrl.sas, sas);
        });
    });

    describe("#getSASConnectionString()", function () {
        it("valid input", function () {
            const accountName = "account";
            const objectType = "blob";
            const objectName = "container";
            const sas = "sas";


            const storageUrl = new ResourceURI(accountName, objectType, objectName, sas);

            assert.equal(storageUrl.getSASConnectionString(), `BlobEndpoint=https://${accountName}.blob.core.windows.net/;SharedAccessSignature=${sas}`);
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

            assert.equal(resourceManager.ingestClientResources, null);
            assert.equal(resourceManager.authorizationContext, null);
        });
    });

    describe("#getIngestClientResourcesFromService()", function () {
        it("valid input", async function () {
            const client = new KustoClient("https://cluster.kusto.windows.net")
            sinon.stub(client, "execute").returns(mockedResourcesResponse);

            let resourceManager = new ResourceManager(client);

            const resources = await resourceManager.getIngestClientResourcesFromService();
            assert.equal(resources.containers.length, 2);
            assert.equal(resources.successfulIngestionsQueues.length, 1);
            assert.equal(resources.failedIngestionsQueues.length, 1);
            assert.equal(resources.securedReadyForAggregationQueues.length, 2);
        });


        it("error response", async function () {
            const client = new KustoClient("https://cluster.kusto.windows.net");
            sinon.stub(client, "execute").throwsException("Kusto request erred (403)");

            const resourceManager = new ResourceManager(client);
            try{
                await resourceManager.getIngestClientResourcesFromService();
            }
            catch(ex){
                assert.equal(ex, "Kusto request erred (403)");
                return;
            }
            assert.fail();
        });
    });

    describe("#getResourceByName()", function () {
        it("valid input", function () {
            let resourceManager = new ResourceManager(new KustoClient("https://cluster.kusto.windows.net"));

            let resources = resourceManager.getResourceByName(mockedResourcesResponse.primaryResults[0], "TempStorage");
            assert.equal(resources.length, 2);
        });
    });

    describe("#refreshIngestClientResources()", function () {
        it("should refresh", async function () {
            let resourceManager = new ResourceManager(new KustoClient("https://cluster.kusto.windows.net"));

            let call = sinon.stub(resourceManager, "getIngestClientResourcesFromService");

            await resourceManager.refreshIngestClientResources();
            assert.equal(call.calledOnce, true);
        });

        it("shouldn't refresh", async function () {
            let resourceManager = new ResourceManager(new KustoClient("https://cluster.kusto.windows.net"));

            let call = sinon.stub(resourceManager, "getIngestClientResourcesFromService");
            resourceManager.ingestClientResourcesLastUpdate = moment();
            resourceManager.ingestClientResources = new IngestClientResources({}, {}, {}, {});

            await resourceManager.refreshIngestClientResources();
            assert.equal(call.calledOnce, false);
        });
    });
});

