// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import {KustoIngestClient} from "../source/ingestClient";
import {DataFormat, IngestionProperties} from "../source/ingestionProperties";


describe("KustoIngestClient", function () {
    describe("#constructor()", function () {
        it("valid input", function () {
            let ingestClient = new KustoIngestClient("https://cluster.kusto.windows.net", <IngestionProperties>{
                database: "db",
                table: "table",
                format: "csv"
            });

            assert.notStrictEqual(ingestClient.defaultProps, null);
            assert.strictEqual(ingestClient.resourceManager.kustoClient.cluster, "https://cluster.kusto.windows.net");
            assert.strictEqual(ingestClient.defaultProps!.database, "db");
            assert.strictEqual(ingestClient.defaultProps!.table, "table");
            assert.strictEqual(ingestClient.defaultProps!.format, "csv");
        });
    });

    describe("#_resolveProperties()", function () {
        it("empty default props", function () {
            let newProps = new IngestionProperties({
                database: "db",
                table: "table",
                format: DataFormat.CSV
            });
            // TODO: not sure a unit test will be useful here
            let client = new KustoIngestClient('https://cluster.region.kusto.windows.net');
            let actual = client._mergeProps(newProps);

            assert.strictEqual(actual.database, "db");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "csv");
        });

        it("empty new props", function () {
            // TODO: not sure a unit test will be useful here
            let defaultProps = new IngestionProperties({
                database: "db",
                table: "table",
                format: DataFormat.CSV
            });
            // TODO: not sure a unit test will be useful here
            let client = new KustoIngestClient('https://cluster.region.kusto.windows.net', defaultProps);
            let actual = client._mergeProps(null);

            assert.strictEqual(actual.database, "db");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "csv");
        });

        it("both exist props", function () {
            let defaultProps = new IngestionProperties({
                database: "db",
                table: "table",
                format: DataFormat.CSV
            });
            let newProps = new IngestionProperties({});
            newProps.database = "db2";
            newProps.ingestionMappingReference = "MappingRef";

            let client = new KustoIngestClient('https://cluster.region.kusto.windows.net', defaultProps);
            let actual = client._mergeProps(newProps);

            assert.strictEqual(actual.database, "db2");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "csv");
            assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
        });

        it("empty both", function () {
            let client = new KustoIngestClient('https://cluster.region.kusto.windows.net');

            let actual = client._mergeProps();
            assert.deepStrictEqual(actual, new IngestionProperties({}));
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
