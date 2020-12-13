// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const assert = require("assert");

const KustoIngestClient = require("../source/ingestClient").KustoIngestClient;
const { IngestionProperties , DataFormat } = require("../source/ingestionProperties");

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

    describe("#_resolveProperties()", function () {
        it("empty default props", function () {
            let newProps = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV});
            // TODO: not sure a unit test will be useful here
            let client = new KustoIngestClient('https://cluster.region.kusto.windows.net');
            let actual = client._mergeProps(newProps);

            assert.equal(actual.database, "db");
            assert.equal(actual.table, "table");
            assert.equal(actual.format, "csv");
        });

        it("empty new props", function () {
            // TODO: not sure a unit test will be useful here
            let defaultProps = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV});
            // TODO: not sure a unit test will be useful here
            let client = new KustoIngestClient('https://cluster.region.kusto.windows.net', defaultProps);
            let actual = client._mergeProps(null);

            assert.equal(actual.database, "db");
            assert.equal(actual.table, "table");
            assert.equal(actual.format, "csv");
        });

        it("both exist props", function () {
            let defaultProps = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV});
            let newProps = new IngestionProperties({});
            newProps.database = "db2";
            newProps.ingestionMappingReference = "MappingRef";

            let client = new KustoIngestClient('https://cluster.region.kusto.windows.net', defaultProps);
            let actual = client._mergeProps(newProps);

            assert.equal(actual.database, "db2");
            assert.equal(actual.table, "table");
            assert.equal(actual.format, "csv");
            assert.equal(actual.ingestionMappingReference, "MappingRef");
        });

        it("empty both", function () {
            let client = new KustoIngestClient('https://cluster.region.kusto.windows.net');

            let actual = client._mergeProps();
            assert.equal(actual, undefined);
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
