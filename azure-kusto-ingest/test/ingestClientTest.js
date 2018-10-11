const assert = require("assert");

const KustoIngestClient = require("../source/ingestClient");


describe("KustoIngestClient", function () {
    describe("#constructor()", function () {
        it("valid input", function () {
            let ingestClient = new KustoIngestClient("https://cluster.kusto.windows.net", {
                database: "db",
                table: "table",
                format: "csv"
            });

            assert.equal(ingestClient.resourceManager.kustoClient.cluster, "https://cluster.kusto.windows.net");
            assert.equal(ingestClient.defaultProps.database, "db");
            assert.equal(ingestClient.defaultProps.table, "table");
            assert.equal(ingestClient.defaultProps.format, "csv");
        });
    });

    describe("#ingestFromFile()", function () {
        it("valid input", function () {
            // TODO: not sure a unit test will be useful here
        });
    });

    describe("#ingestFromStream()", function () {
        it("valid input", function () {
            // TODO: not sure a unit test will be useful here
        });
    });

    describe("#ingestFromBlob()", function () {
        it("valid input", function () {
            // TODO: not sure a unit test will be useful here
        });
    });
});
