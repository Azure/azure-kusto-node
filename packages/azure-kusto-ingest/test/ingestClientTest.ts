// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { KustoIngestClient } from "../src/ingestClient";
import { DataFormat, IngestionProperties, IngestionPropertiesInput, ReportLevel, ReportMethod } from "../src/ingestionProperties";
import { IngestionPropertiesValidationError } from "../src/errors";
import KustoStreamingIngestClient from "../src/streamingIngestClient";
import KustoManagedStreamingIngestClient from "../src/managedStreamingIngestClient";
import { KustoConnectionStringBuilder } from "azure-kusto-data";
import { Readable } from "stream";

describe("KustoIngestClient", () => {
    describe("#constructor()", () => {
        it.concurrent("valid input", () => {
            const ingestClient = new KustoIngestClient(
                "https://cluster.kusto.windows.net",
                {
                    database: "db",
                    table: "table",
                    format: "json",
                } as IngestionProperties,
                false
            );

            assert.notStrictEqual(ingestClient.defaultProps, null);
            assert.strictEqual(ingestClient.resourceManager.kustoClient.cluster, "https://cluster.kusto.windows.net");
            assert.strictEqual(ingestClient.defaultProps!.database, "db");
            assert.strictEqual(ingestClient.defaultProps!.table, "table");
            assert.strictEqual(ingestClient.defaultProps!.format, "json");
        });
    });

    describe("#_resolveProperties()", () => {
        it.concurrent("empty default props", () => {
            const newProps = new IngestionProperties({
                database: "db",
                table: "table",
                format: DataFormat.JSON,
            });
            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net");
            const actual = client._getMergedProps(newProps);

            assert.strictEqual(actual.database, "db");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "json");
        });

        it.concurrent("new props object", () => {
            const newProps = {
                database: "db",
                table: "table",
                format: DataFormat.JSON,
            };
            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net");
            const actual = client._getMergedProps(newProps);

            assert.strictEqual(actual.database, "db");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "json");
        });

        it.concurrent("empty new props", () => {
            const defaultProps = new IngestionProperties({
                database: "db",
                table: "table",
                format: DataFormat.JSON,
            });
            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net", defaultProps);
            const actual = client._getMergedProps(null);

            assert.strictEqual(actual.database, "db");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "json");
        });

        it.concurrent("default props object", () => {
            const defaultProps = {
                database: "db",
                table: "table",
                format: DataFormat.JSON,
            };
            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net", defaultProps);
            const actual = client._getMergedProps(null);

            assert.strictEqual(actual.database, "db");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "json");
        });

        it.concurrent("both exists props", () => {
            const defaultProps = new IngestionProperties({
                database: "db",
                table: "table",
                format: DataFormat.JSON,
                reportLevel: ReportLevel.DoNotReport,
            });
            const newProps = new IngestionProperties({});
            newProps.database = "db2";
            newProps.ingestionMappingReference = "MappingRef";
            newProps.format = DataFormat.AVRO;

            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net", defaultProps);
            const actual = client._getMergedProps(newProps);

            assert.strictEqual(actual.database, "db2");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "avro");
            assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
            assert.strictEqual(actual.reportLevel, ReportLevel.DoNotReport);
            assert.strictEqual(actual.reportMethod, ReportMethod.Queue);
        });

        it.concurrent("both exists objects", () => {
            const defaultProps = {
                database: "db",
                table: "table",
                format: DataFormat.JSON,
            };
            const newProps = {
                database: "db2",
                ingestionMappingReference: "MappingRef",
                format: DataFormat.AVRO,
                reportMethod: ReportMethod.Table,
                reportLevel: ReportLevel.FailuresAndSuccesses,
            };

            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net", defaultProps);
            const actual = client._getMergedProps(newProps);

            assert.strictEqual(actual.database, "db2");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "avro");
            assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
            assert.strictEqual(actual.reportLevel, ReportLevel.FailuresAndSuccesses);
            assert.strictEqual(actual.reportMethod, ReportMethod.Table);
        });

        it.concurrent("test defaults", () => {
            const defaultProps = {
                database: "db",
                table: "table",
            };
            const newProps = {
                database: "db2",
                ingestionMappingReference: "MappingRef",
            };

            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net", defaultProps);
            const actual = client._getMergedProps(newProps);

            assert.strictEqual(actual.database, "db2");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
            assert.strictEqual(actual.format, "csv");
            assert.strictEqual(actual.reportLevel, ReportLevel.FailuresOnly);
            assert.strictEqual(actual.reportMethod, ReportMethod.Queue);
        });

        describe("test default database", () => {
            [
                (s: string, p: IngestionPropertiesInput) => new KustoIngestClient(s, p),
                (s: string, p: IngestionPropertiesInput) => new KustoStreamingIngestClient(s, p),
                (s: string, p: IngestionPropertiesInput) =>
                    KustoManagedStreamingIngestClient.fromEngineConnectionString(new KustoConnectionStringBuilder(s), p),
            ].forEach((clientType) => {
                it.concurrent(`${clientType} - test default database`, () => {
                    const defaultProps: IngestionPropertiesInput = {
                        table: "table",
                    };
                    const newProps: IngestionPropertiesInput = {
                        ingestionMappingReference: "MappingRef",
                    };

                    const client = clientType("Data Source=https://cluster.region.kusto.windows.net;Initial Catalog=db3", defaultProps);
                    const actual = client._getMergedProps(newProps);

                    assert.strictEqual(actual.database, "db3");
                    assert.strictEqual(actual.table, "table");
                    assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
                    assert.strictEqual(actual.format, "csv");
                    assert.strictEqual(actual.reportLevel, ReportLevel.FailuresOnly);
                    assert.strictEqual(actual.reportMethod, ReportMethod.Queue);
                });

                it.concurrent(`${clientType} - test default database with defaultProps`, () => {
                    const defaultProps: IngestionPropertiesInput = {
                        table: "table",
                        database: "db",
                    };
                    const newProps: IngestionPropertiesInput = {
                        ingestionMappingReference: "MappingRef",
                    };

                    const client = clientType("Data Source=https://cluster.region.kusto.windows.net;Initial Catalog=db3", defaultProps);
                    const actual = client._getMergedProps(newProps);

                    assert.strictEqual(actual.database, "db");
                    assert.strictEqual(actual.table, "table");
                    assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
                    assert.strictEqual(actual.format, "csv");
                    assert.strictEqual(actual.reportLevel, ReportLevel.FailuresOnly);
                    assert.strictEqual(actual.reportMethod, ReportMethod.Queue);
                });

                it.concurrent(`${clientType} - test default database with given props`, () => {
                    const defaultProps: IngestionPropertiesInput = {
                        table: "table",
                        database: "db",
                    };
                    const newProps: IngestionPropertiesInput = {
                        ingestionMappingReference: "MappingRef",
                        database: "db2",
                    };

                    const client = clientType("Data Source=https://cluster.region.kusto.windows.net;Initial Catalog=db3", defaultProps);
                    const actual = client._getMergedProps(newProps);

                    assert.strictEqual(actual.database, "db2");
                    assert.strictEqual(actual.table, "table");
                    assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
                    assert.strictEqual(actual.format, "csv");
                    assert.strictEqual(actual.reportLevel, ReportLevel.FailuresOnly);
                    assert.strictEqual(actual.reportMethod, ReportMethod.Queue);
                });
            });
        });

        it.concurrent("default both", () => {
            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net");

            assert.throws(() => client._getMergedProps(), new IngestionPropertiesValidationError("Must define a target table"));
        });
        it.concurrent("empty both", () => {
            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net");
            client.defaultDatabase = undefined;

            assert.throws(() => client._getMergedProps(), new IngestionPropertiesValidationError("Must define a target database"));
        });
    });

    describe("test auto correct uri", () => {
        it.concurrent("auto correct from query endpoint", () => {
            const client = new KustoIngestClient("https://somecluster.kusto.windows.net");
            assert.strictEqual(
                client.resourceManager.kustoClient.cluster,
                "https://ingest-somecluster.kusto.windows.net",
                "Kusto cluster URL does not match expected value"
            );
        });
        it.concurrent("auto correct from ingestion endpoint", () => {
            const client = new KustoIngestClient("https://ingest-somecluster.kusto.windows.net");
            assert.strictEqual(
                client.resourceManager.kustoClient.cluster,
                "https://ingest-somecluster.kusto.windows.net",
                "Kusto cluster URL does not match expected value"
            );
        });
    });

    describe("#ingestFromFile()", () => {
        it.concurrent("valid input", () => {
            // TODO: not sure a unit test will be useful here
        });
    });

    describe("#ingestFromStream()", () => {
        it.concurrent("valid input", () => {
            // TODO: not sure a unit test will be useful here
        });
    });

    describe("#ingestFromBlob()", () => {
        it.concurrent("valid input", () => {
            // TODO: not sure a unit test will be useful here
        });
    });

    describe("Close", () => {
        it.concurrent("Queued Client should not be useable when closed", async () => {
            const c = new KustoIngestClient("Data Source=https://cluster.kusto.windows.net");
            c.close();
            await assert.rejects(c.ingestFromFile("test1"), /Client is closed/);
            await assert.rejects(c.ingestFromStream(Readable.from("")), /Client is closed/);
            await assert.rejects(c.ingestFromBlob("test1"), /Client is closed/);
        });

        it.concurrent("Streaming Client should not be useable when closed", async () => {
            const c = new KustoStreamingIngestClient("Data Source=https://cluster.kusto.windows.net");
            c.close();
            await assert.rejects(c.ingestFromFile("test1"), /Client is closed/);
            await assert.rejects(c.ingestFromStream(Readable.from("")), /Client is closed/);
        });

        it.concurrent("Managed Client should not be useable when closed", async () => {
            const c = new KustoManagedStreamingIngestClient("Data Source=https://cluster.kusto.windows.net", "Data Source=https://cluster.kusto.windows.net");
            c.close();
            await assert.rejects(c.ingestFromFile("test1"), /Client is closed/);
            await assert.rejects(c.ingestFromStream(Readable.from("")), /Client is closed/);
        });
    });
});
