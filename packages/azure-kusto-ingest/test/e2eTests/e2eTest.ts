// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable no-console */

import assert from "assert";
import fs, { ReadStream } from "fs";
import IngestClient from "../../src/ingestClient";
import KustoIngestStatusQueues from "../../src/status";
import { Client, ClientRequestProperties, KustoConnectionStringBuilder as ConnectionStringBuilder } from "azure-kusto-data";
import StreamingIngestClient from "../../src/streamingIngestClient";
import ManagedStreamingIngestClient from "../../src/managedStreamingIngestClient";
import { CompressionType, StreamDescriptor } from "../../src/descriptors";
import { DataFormat, IngestionProperties, JsonColumnMapping, ReportLevel } from "../../src";
import { CloudSettings } from "azure-kusto-data/src/cloudSettings";
import { sleep } from "../../src/retry";
import util from "util";

interface ParsedJsonMapping {
    Properties: { Path: string };
    column: string;
    datatype: string;
}

const databaseName = process.env.TEST_DATABASE;
const appId = process.env.APP_ID;
const appKey = process.env.APP_KEY;
const tenantId = process.env.TENANT_ID;

const main = (): void => {
    if (!databaseName || !appId || !appKey || !tenantId) {
        process.stdout.write("Skip E2E test - Missing env variables");
        return;
    }

    const engineKcsb = ConnectionStringBuilder.withAadApplicationKeyAuthentication(process.env.ENGINE_CONNECTION_STRING ?? "", appId, appKey, tenantId);
    engineKcsb.applicationNameForTracing = "NodeE2ETest";

    const queryClient = new Client(engineKcsb);
    const streamingIngestClient = new StreamingIngestClient(engineKcsb);
    const dmKcsb = ConnectionStringBuilder.withAadApplicationKeyAuthentication(process.env.DM_CONNECTION_STRING ?? "", appId, appKey, tenantId);
    const ingestClient = new IngestClient(dmKcsb);
    const statusQueues = new KustoIngestStatusQueues(ingestClient);
    const managedStreamingIngestClient = new ManagedStreamingIngestClient(engineKcsb, dmKcsb);

    class TestDataItem {
        constructor(
            public description: string,
            public path: string,
            public rows: number,
            public ingestionProperties: IngestionProperties,
            public testOnstreamingIngestion = true
        ) {}
    }

    const getTestResourcePath = (name: string) => __dirname + `/e2eData/${name}`;

    const tableName = `NodeTest${Date.now()}`;
    const mappingName = "mappingRef";
    const tableColumns =
        "(rownumber:int, rowguid:string, xdouble:real, xfloat:real, xbool:bool, xint16:int, xint32:int, xint64:long, xuint8:long, xuint16:long, xuint32:long, xuint64:long, xdate:datetime, xsmalltext:string, xtext:string, xnumberAsText:string, xtime:timespan, xtextWithNulls:string, xdynamicWithNulls:dynamic)";

    const mapping = fs.readFileSync(getTestResourcePath("dataset_mapping.json"), { encoding: "utf8" });
    const columnMapping = (JSON.parse(mapping) as ParsedJsonMapping[]).map((m: ParsedJsonMapping) =>
        JsonColumnMapping.withPath(m.column, m.Properties.Path, m.datatype)
    );

    const ingestionPropertiesWithoutMapping = new IngestionProperties({
        database: databaseName,
        table: tableName,
        format: DataFormat.CSV,
        flushImmediately: true,
    });
    const ingestionPropertiesWithMappingReference = new IngestionProperties({
        database: databaseName,
        table: tableName,
        format: DataFormat.JSON,
        ingestionMappingReference: mappingName,
        flushImmediately: true,
    });
    const ingestionPropertiesWithColumnMapping = new IngestionProperties({
        database: databaseName,
        table: tableName,
        format: DataFormat.JSON,
        ingestionMappingColumns: columnMapping,
        flushImmediately: true,
    });

    const testItems = [
        new TestDataItem("csv", getTestResourcePath("dataset.csv"), 10, ingestionPropertiesWithoutMapping),
        new TestDataItem("csv.gz", getTestResourcePath("dataset_gzip.csv.gz"), 10, ingestionPropertiesWithoutMapping),
        new TestDataItem("json with mapping ref", getTestResourcePath("dataset.json"), 2, ingestionPropertiesWithMappingReference),
        new TestDataItem("json.gz with mapping ref", getTestResourcePath("dataset_gzip.json.gz"), 2, ingestionPropertiesWithMappingReference),
        new TestDataItem("json with mapping", getTestResourcePath("dataset.json"), 2, ingestionPropertiesWithColumnMapping, false),
        new TestDataItem("json.gz with mapping", getTestResourcePath("dataset_gzip.json.gz"), 2, ingestionPropertiesWithColumnMapping, false),
    ];

    let currentCount = 0;

    describe(`E2E Tests`, () => {
        afterAll(async () => {
            try {
                await queryClient.execute(databaseName, `.drop table ${tableName} ifexists`);
            } catch (err) {
                assert.fail("Failed to drop table");
            }

            queryClient.close();
            ingestClient.close();
        });

        beforeAll(async () => {
            try {
                await queryClient.execute(databaseName, `.create table ${tableName} ${tableColumns}`);
                await queryClient.execute(databaseName, `.alter table ${tableName} policy streamingingestion enable`);
                await queryClient.execute(databaseName, ".clear database cache streamingingestion schema");

                console.log("Create table ingestion mapping");
                try {
                    await queryClient.execute(databaseName, `.create-or-alter table ${tableName} ingestion json mapping '${mappingName}' '${mapping}'`);
                } catch (err) {
                    assert.fail("Failed to create table ingestion mapping, error: " + util.format(err));
                }
            } catch (err) {
                console.log(`Creating table ${tableName}, with columns ${tableColumns}`);

                assert.fail(`Failed to create table ${tableName} ${err} ${databaseName}, error: ${util.format(err)}`);
            }
        });

        describe("cloud info", () => {
            it("cloud info 404", async () => {
                const cloudInfo = await CloudSettings.getInstance().getCloudInfoForCluster("https://www.microsoft.com");
                assert.strictEqual(cloudInfo, CloudSettings.getInstance().defaultCloudInfo);
            });
        });

        describe("ingestClient", () => {
            it("ingestFromFile", async () => {
                for (const item of testItems) {
                    try {
                        await ingestClient.ingestFromFile(item.path, item.ingestionProperties);
                    } catch (err) {
                        assert.fail(`Failed to ingest ${item.description}, ${util.format(err)}`);
                    }
                    await assertRowsCount(item);
                }
            });

            it("ingestFromStream", async () => {
                for (const item of testItems) {
                    let stream: ReadStream | StreamDescriptor = fs.createReadStream(item.path);
                    if (item.path.endsWith("gz")) {
                        stream = new StreamDescriptor(stream, null, CompressionType.GZIP);
                    }
                    try {
                        await ingestClient.ingestFromStream(stream, item.ingestionProperties);
                    } catch (err) {
                        assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                    }
                    await assertRowsCount(item);
                }
            });
        });

        describe("StreamingIngestClient", () => {
            it("ingestFromFile", async () => {
                for (const item of testItems.filter((i) => i.testOnstreamingIngestion)) {
                    try {
                        await streamingIngestClient.ingestFromFile(item.path, item.ingestionProperties);
                    } catch (err) {
                        assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                    }
                    await assertRowsCount(item);
                }
            });

            it("ingestFromStream", async () => {
                for (const item of testItems.filter((i) => i.testOnstreamingIngestion)) {
                    let stream: ReadStream | StreamDescriptor = fs.createReadStream(item.path);
                    if (item.path.endsWith("gz")) {
                        stream = new StreamDescriptor(stream, null, CompressionType.GZIP);
                    }
                    try {
                        await streamingIngestClient.ingestFromStream(stream, item.ingestionProperties);
                    } catch (err) {
                        assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                    }
                    await assertRowsCount(item);
                }
            });
        });

        describe("ManagedStreamingIngestClient", () => {
            it("ingestFromFile", async () => {
                for (const item of testItems.filter((i) => i.testOnstreamingIngestion)) {
                    try {
                        await managedStreamingIngestClient.ingestFromFile(item.path, item.ingestionProperties);
                    } catch (err) {
                        assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                    }
                    await assertRowsCount(item);
                }
            });
            it("ingestFromStream", async () => {
                for (const item of testItems.filter((i) => i.testOnstreamingIngestion)) {
                    let stream: ReadStream | StreamDescriptor = fs.createReadStream(item.path);
                    if (item.path.endsWith("gz")) {
                        stream = new StreamDescriptor(stream, null, CompressionType.GZIP);
                    }
                    try {
                        await managedStreamingIngestClient.ingestFromStream(stream, item.ingestionProperties);
                    } catch (err) {
                        assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                    }
                    await assertRowsCount(item);
                }
            });
        });

        describe("KustoIngestStatusQueues", () => {
            it("CleanStatusQueues", async () => {
                try {
                    await cleanStatusQueues();
                } catch (err) {
                    assert.fail(`Failed to Clean status queues - ${util.format(err)}`);
                }
            });

            it("CheckSucceededIngestion", async () => {
                const item = testItems[0];
                item.ingestionProperties.reportLevel = ReportLevel.FailuresAndSuccesses;
                try {
                    await ingestClient.ingestFromFile(item.path, item.ingestionProperties);
                    const status = await waitForStatus();
                    assert.strictEqual(status.SuccessCount, 1);
                    assert.strictEqual(status.FailureCount, 0);
                } catch (err) {
                    assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                }
            });

            it("CheckFailedIngestion", async () => {
                const item = testItems[0];
                item.ingestionProperties.reportLevel = ReportLevel.FailuresAndSuccesses;
                item.ingestionProperties.database = "invalid";
                try {
                    await ingestClient.ingestFromFile(item.path, item.ingestionProperties);
                    const status = await waitForStatus();
                    assert.strictEqual(status.SuccessCount, 0);
                    assert.strictEqual(status.FailureCount, 1);
                } catch (err) {
                    assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                }
            });
        });

        describe("QueryClient", () => {
            it("General BadRequest", async () => {
                try {
                    await queryClient.executeQuery(databaseName, "invalidSyntax ");
                } catch (ex) {
                    return;
                }
                assert.fail(`General BadRequest`);
            });

            it("PartialQueryFailure", async () => {
                try {
                    await queryClient.executeQuery(databaseName, "invalidSyntax ");
                } catch (ex) {
                    return;
                }
                assert.fail(`Didn't throw PartialQueryFailure`);
            });

            it("executionTimeout", async () => {
                try {
                    const properties = new ClientRequestProperties();
                    properties.setTimeout(10);
                    await queryClient.executeQuery(databaseName, `${tableName}`, properties);
                } catch (ex: unknown) {
                    assert.ok(ex instanceof Error);
                    assert.match(ex.message, /.*Query is expired.*/, `Fail to get "Query is expired". ex json: ${JSON.stringify(ex)}, ex: ${ex}`);
                    return;
                }
                assert.fail(`Didn't throw executionTimeout`);
            });
        });
    });

    const cleanStatusQueues = async () => {
        while (!(await statusQueues.failure.isEmpty())) {
            await statusQueues.failure.pop();
        }

        while (!(await statusQueues.success.isEmpty())) {
            await statusQueues.success.pop();
        }
    };

    const waitForStatus = async () => {
        while ((await statusQueues.failure.isEmpty()) && (await statusQueues.success.isEmpty())) {
            await sleep(500);
        }

        const failures = await statusQueues.failure.pop();
        const successes = await statusQueues.success.pop();

        return { SuccessCount: successes.length, FailureCount: failures.length };
    };

    const assertRowsCount = async (testItem: TestDataItem) => {
        let count = 0;
        const expected = testItem.rows;
        // Timeout = 3 min
        for (let i = 0; i < 60; i++) {
            let results;
            try {
                results = await queryClient.execute(databaseName ?? "", `${tableName} | count `);
            } catch (ex) {
                continue;
            }

            const row = results.primaryResults[0].toJSON<{ Count: number }>().data[0];

            count = row.Count - currentCount;
            if (count >= expected) {
                break;
            }
            await sleep(1000);
        }
        currentCount += count;
        assert.strictEqual(count, expected, `Failed to ingest ${testItem.description} - '${count}' rows ingested, expected '${expected}'`);
        console.log(`${testItem.description} - '${count}' rows ingested, expected '${expected}'`);
    };
};

main();
