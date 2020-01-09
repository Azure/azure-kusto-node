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

    describe("#toURI()", function () {
        it("valid input", function () {
            const accountName = "account";
            const objectType = "blob";
            const objectName = "container";
            const sas = "sas";


            const storageUrl = new ResourceURI(accountName, objectType, objectName, sas);

            assert.equal(storageUrl.toURI(), `https://${accountName}.${objectType}.core.windows.net/${objectName}?${sas}`);
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
        it("valid input", function (done) {
            let client = new KustoClient("https://cluster.kusto.windows.net");

            sinon.replace(client, "execute", (db, query, callback) => {
                callback(null, mockedResourcesResponse);
            });

            let resourceManager = new ResourceManager(client);

            resourceManager.getIngestClientResourcesFromService((err, resources) => {
                assert.equal(err, null);
                assert.equal(resources.containers.length, 2);
                assert.equal(resources.successfulIngestionsQueues.length, 1);
                assert.equal(resources.failedIngestionsQueues.length, 1);
                assert.equal(resources.securedReadyForAggregationQueues.length, 2);

                done();
            });
        });

        it("error response", function(done){
            const client = new KustoClient("https://cluster.kusto.windows.net");

            sinon.replace(client, "execute", (db, query, callback) => {
                return callback("Kusto request erred (403)", null);
            });

            const resourceManager = new ResourceManager(client);

            resourceManager.getIngestClientResourcesFromService((err, resources) => {
                assert.equal(err, "Kusto request erred (403)");
                assert.equal(resources, undefined);
                done();
            });
        });

        it("no exceptions after callback", function() {
            const client = new KustoClient("https://cluster.kusto.windows.net");

            sinon.replace(client, "execute", (db, query, callback) => {
                return callback("Kusto request erred (403)", null);
            });

            const resourceManager = new ResourceManager(client);

            const response = resourceManager.getIngestClientResourcesFromService(() => true);

            assert.ok(response)
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
        it("should refresh", function (done) {
            let resourceManager = new ResourceManager(new KustoClient("https://cluster.kusto.windows.net"));

            let callback = sinon.stub(resourceManager, "getIngestClientResourcesFromService");
            callback.yields(null);

            resourceManager.refreshIngestClientResources((err) => {
                assert.equal(callback.calledOnce, true);
                done();
            });
        });

        it("shouldn't refresh", function (done) {
            let resourceManager = new ResourceManager(new KustoClient("https://cluster.kusto.windows.net"));

            let callback = sinon.fake();
            sinon.replace(resourceManager, "getIngestClientResourcesFromService", callback);
            resourceManager.ingestClientResourcesLastUpdate = moment.now();
            resourceManager.ingestClientResources = new IngestClientResources({}, {}, {}, {});
            
            resourceManager.refreshIngestClientResources((err) => {
                assert.equal(callback.calledOnce, false);
                done();
            });
        });
    });
});

