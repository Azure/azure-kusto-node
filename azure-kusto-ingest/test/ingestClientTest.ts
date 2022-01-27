// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import {KustoIngestClient} from "../source/ingestClient";
import {DataFormat, IngestionProperties} from "../source/ingestionProperties";


describe("KustoIngestClient", () => {
    describe("#constructor()", () => {
        it("valid input", () => {
            const ingestClient = new KustoIngestClient("https://cluster.kusto.windows.net", {
                database: "db",
                table: "table",
                format: "csv"
            } as IngestionProperties);

            assert.notStrictEqual(ingestClient.defaultProps, null);
            assert.strictEqual(ingestClient.resourceManager.kustoClient.cluster, "https://cluster.kusto.windows.net");
            assert.strictEqual(ingestClient.defaultProps!.database, "db");
            assert.strictEqual(ingestClient.defaultProps!.table, "table");
            assert.strictEqual(ingestClient.defaultProps!.format, "csv");
        });
    });

    describe("#_resolveProperties()", () => {
        it("empty default props", () => {
            const newProps = new IngestionProperties({
                database: "db",
                table: "table",
                format: DataFormat.CSV
            });
            // TODO: not sure a unit test will be useful here
            const client = new KustoIngestClient('https://cluster.region.kusto.windows.net');
            const actual = client._mergeProps(newProps);

            assert.strictEqual(actual.database, "db");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "csv");
        });

        it("empty new props", () => {
            // TODO: not sure a unit test will be useful here
            const defaultProps = new IngestionProperties({
                database: "db",
                table: "table",
                format: DataFormat.CSV
            });
            // TODO: not sure a unit test will be useful here
            const client = new KustoIngestClient('https://cluster.region.kusto.windows.net', defaultProps);
            const actual = client._mergeProps(null);

            assert.strictEqual(actual.database, "db");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "csv");
        });

        it("both exist props", () => {
            const defaultProps = new IngestionProperties({
                database: "db",
                table: "table",
                format: DataFormat.CSV
            });
            const newProps = new IngestionProperties({});
            newProps.database = "db2";
            newProps.ingestionMappingReference = "MappingRef";

            const client = new KustoIngestClient('https://cluster.region.kusto.windows.net', defaultProps);
            const actual = client._mergeProps(newProps);

            assert.strictEqual(actual.database, "db2");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "csv");
            assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
        });

        it("empty both", () => {
            const client = new KustoIngestClient('https://cluster.region.kusto.windows.net');

            const actual = client._mergeProps();
            assert.deepStrictEqual(actual, new IngestionProperties({}));
        });
    });

    describe("#ingestFromFile()", () => {
        it("valid input", () => {
            // TODO: not sure a unit test will be useful here
        });
    });

    describe("#ingestFromStream()", () => {
        it("valid input", () => {
            // TODO: not sure a unit test will be useful here
        });
    });

    describe("#ingestFromBlob()", () => {
        it("valid input", () => {
            // TODO: not sure a unit test will be useful here
        });
    });
});
