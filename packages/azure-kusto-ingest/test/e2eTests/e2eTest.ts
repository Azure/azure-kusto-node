// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable no-console */

import assert from "assert";
import fs, { ReadStream } from "fs";
import IngestClient from "../../src/ingestClient";
import KustoIngestStatusQueues from "../../src/status";
import {
    Client,
    ClientRequestProperties,
    CloudSettings,
    KustoConnectionStringBuilder as ConnectionStringBuilder,
    kustoTrustedEndpoints,
    MatchRule,
} from "azure-kusto-data";
import StreamingIngestClient from "../../src/streamingIngestClient";
import ManagedStreamingIngestClient from "../../src/managedStreamingIngestClient";
import { CompressionType, StreamDescriptor } from "../../src/descriptors";
import { DataFormat, IngestionProperties, JsonColumnMapping, ReportLevel } from "../../src";
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
    engineKcsb.applicationNameForTracing = "NodeE2ETest_ø";

    const queryClient = new Client(engineKcsb);
    const streamingIngestClient = new StreamingIngestClient(engineKcsb);
    const dmKcsb = ConnectionStringBuilder.withAadApplicationKeyAuthentication(process.env.DM_CONNECTION_STRING ?? "", appId, appKey, tenantId);
    const ingestClient = new IngestClient(dmKcsb);
    const statusQueues = new KustoIngestStatusQueues(ingestClient);
    const managedStreamingIngestClient = new ManagedStreamingIngestClient(engineKcsb, dmKcsb);

    const tables = [
        "general",
        "queued_file",
        "queued_stream",
        "streaming_file",
        "streaming_stream",
        "managed_file",
        "managed_stream",
        "status_success",
        "status_fail",
    ] as const;

    class TestDataItem {
        constructor(
            public description: string,
            public path: string,
            public rows: number,
            public ingestionPropertiesCallback: (t: string) => IngestionProperties,
            public testOnStreamingIngestion = true
        ) {}
    }

    const getTestResourcePath = (name: string) => __dirname + `/e2eData/${name}`;

    const mappingName = "mappingRef";
    const tableColumns =
        "(rownumber:int, rowguid:string, xdouble:real, xfloat:real, xbool:bool, xint16:int, xint32:int, xint64:long, xuint8:long, xuint16:long, xuint32:long, xuint64:long, xdate:datetime, xsmalltext:string, xtext:string, xnumberAsText:string, xtime:timespan, xtextWithNulls:string, xdynamicWithNulls:dynamic)";

    const mapping = fs.readFileSync(getTestResourcePath("dataset_mapping.json"), { encoding: "utf8" });
    const columnMapping = (JSON.parse(mapping) as ParsedJsonMapping[]).map((m: ParsedJsonMapping) =>
        JsonColumnMapping.withPath(m.column, m.Properties.Path, m.datatype)
    );
    const ingestionPropertiesWithoutMapping = (t: string) =>
        new IngestionProperties({
            database: databaseName,
            table: t,
            format: DataFormat.CSV,
            flushImmediately: true,
        });
    const ingestionPropertiesWithMappingReference = (t: string) =>
        new IngestionProperties({
            database: databaseName,
            table: t,
            format: DataFormat.JSON,
            ingestionMappingReference: mappingName,
            flushImmediately: true,
        });
    const ingestionPropertiesWithColumnMapping = (t: string) =>
        new IngestionProperties({
            database: databaseName,
            table: t,
            format: DataFormat.JSON,
            ingestionMappingColumns: columnMapping,
            flushImmediately: true,
        });

    const testItems = [
        new TestDataItem("csv", getTestResourcePath("dataset.csv"), 10, ingestionPropertiesWithoutMapping),
        new TestDataItem("csv_gz", getTestResourcePath("dataset_gzip.csv.gz"), 10, ingestionPropertiesWithoutMapping),
        new TestDataItem("json_with_mapping_ref", getTestResourcePath("dataset.json"), 2, ingestionPropertiesWithMappingReference),
        new TestDataItem("json_gz_with_mapping_ref", getTestResourcePath("dataset_gzip.json.gz"), 2, ingestionPropertiesWithMappingReference),
        new TestDataItem("json_with_mapping", getTestResourcePath("dataset.json"), 2, ingestionPropertiesWithColumnMapping, false),
        new TestDataItem("json_gz_with_mapping", getTestResourcePath("dataset_gzip.json.gz"), 2, ingestionPropertiesWithColumnMapping, false),
    ] as const;

    type Table = `${(typeof tables)[number]}_${(typeof testItems)[number]["description"]}`;

    const testSuffix = `_node_e2e_${new Date().getTime()}_${Math.floor(Math.random() * 100000)}`;
    const tableWithItems = tables.map((t) => testItems.map((tI) => `${t}_${tI.description}`)).flat() as Table[];
    const tableNames = Object.fromEntries(tableWithItems.map((t) => [t, t + testSuffix])) as Record<Table, string>;

    afterAll(async () => {
        await Promise.all(
            Object.values(tableNames).map(async (tableName) => {
                try {
                    console.log(`Drop table ${tableName}`);
                    await queryClient.execute(databaseName, `.drop table ${tableName} ifexists`);
                } catch (err) {
                    assert.fail("Failed to drop table");
                }
            })
        );
        queryClient.close();
        ingestClient.close();
    });

    beforeAll(async () => {
        await Promise.all(
            Object.values(tableNames).map(async (tableName) => {
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

                    assert.fail(`Failed to create table $,{tableName} ${err} ${databaseName}, error: ${util.format(err)}`);
                }
            })
        );
    });

    describe(`E2E Tests`, () => {
        describe("cloud info", () => {
            it.concurrent("cloud info 404", async () => {
                const cloudInfo = await CloudSettings.getCloudInfoForCluster("https://www.microsoft.com");
                assert.strictEqual(cloudInfo, CloudSettings.defaultCloudInfo);
            });
        });

        describe("queuedIngestClient", () => {
            it.concurrent.each(
                testItems.map((i) => {
                    return { item: i };
                })
            )("ingestFromFile_$item.description", async ({ item }) => {
                const table = tableNames[("queued_file" + "_" + item.description) as Table];
                try {
                    await ingestClient.ingestFromFile(item.path, item.ingestionPropertiesCallback(table));
                } catch (err) {
                    assert.fail(`Failed to ingest ${item.description}, ${util.format(err)}`);
                }
                await assertRowsCount(item, table as Table);
            });

            it.concurrent.each(
                testItems.map((i) => {
                    return { item: i };
                })
            )("ingestFromStream_$item.description", async ({ item }) => {
                let stream: ReadStream | StreamDescriptor = fs.createReadStream(item.path);
                if (item.path.endsWith("gz")) {
                    stream = new StreamDescriptor(stream, null, CompressionType.GZIP);
                }
                const table = tableNames[("queued_stream" + "_" + item.description) as Table];
                try {
                    await ingestClient.ingestFromStream(stream, item.ingestionPropertiesCallback(table));
                } catch (err) {
                    assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                }
                await assertRowsCount(item, table as Table);
            });
        });

        describe("StreamingIngestClient", () => {
            it.concurrent.each(
                testItems
                    .filter((i) => i.testOnStreamingIngestion)
                    .map((i) => {
                        return { item: i };
                    })
            )("ingestFromFile_$item.description", async ({ item }) => {
                const table = tableNames[("streaming_file" + "_" + item.description) as Table];
                try {
                    await streamingIngestClient.ingestFromFile(item.path, item.ingestionPropertiesCallback(table));
                } catch (err) {
                    assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                }
                await assertRowsCount(item, table as Table);
            });

            it.concurrent.each(
                testItems
                    .filter((i) => i.testOnStreamingIngestion)
                    .map((i) => {
                        return { item: i };
                    })
            )("ingestFromStream_$item.description", async ({ item }) => {
                let stream: ReadStream | StreamDescriptor = fs.createReadStream(item.path);
                if (item.path.endsWith("gz")) {
                    stream = new StreamDescriptor(stream, null, CompressionType.GZIP);
                }
                const table = tableNames[("streaming_stream" + "_" + item.description) as Table];
                try {
                    await streamingIngestClient.ingestFromStream(stream, item.ingestionPropertiesCallback(table));
                } catch (err) {
                    assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                }
                await assertRowsCount(item, table as Table);
            });
        });

        describe("ManagedStreamingIngestClient", () => {
            it.concurrent.each(
                testItems
                    .filter((i) => i.testOnStreamingIngestion)
                    .map((i) => {
                        return { item: i };
                    })
            )("ingestFromFile_$item.description", async ({ item }) => {
                const table = tableNames[("managed_file" + "_" + item.description) as Table];
                try {
                    await managedStreamingIngestClient.ingestFromFile(item.path, item.ingestionPropertiesCallback(table));
                } catch (err) {
                    assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                }
                await assertRowsCount(item, table as Table);
            });
            it.concurrent.each(
                testItems
                    .filter((i) => i.testOnStreamingIngestion)
                    .map((i) => {
                        return { item: i };
                    })
            )("ingestFromStream_$item.description", async ({ item }) => {
                let stream: ReadStream | StreamDescriptor = fs.createReadStream(item.path);
                if (item.path.endsWith("gz")) {
                    stream = new StreamDescriptor(stream, null, CompressionType.GZIP);
                }
                const table = tableNames[("managed_stream" + "_" + item.description) as Table];
                try {
                    await managedStreamingIngestClient.ingestFromStream(stream, item.ingestionPropertiesCallback(table));
                } catch (err) {
                    assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                }
                await assertRowsCount(item, table as Table);
            });
        });

        it.concurrent("KustoIngestStatusQueues", async () => {
            try {
                await cleanStatusQueues();
            } catch (err) {
                assert.fail(`Failed to Clean status queues - ${util.format(err)}`);
            }

            const checkSuccess = async () => {
                const item = testItems[0];
                const table = tableNames[("status_success" + "_" + item.description) as Table];
                const ingestionProperties = item.ingestionPropertiesCallback(table);
                ingestionProperties.reportLevel = ReportLevel.FailuresAndSuccesses;
                try {
                    await ingestClient.ingestFromFile(item.path, ingestionProperties);
                    const status = await waitForStatus();
                    assert.strictEqual(status.SuccessCount, 1);
                    assert.strictEqual(status.FailureCount, 0);
                } catch (err) {
                    assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                }
            };
            await checkSuccess();

            try {
                await cleanStatusQueues();
            } catch (err) {
                assert.fail(`Failed to Clean status queues - ${util.format(err)}`);
            }

            const checkFail = async () => {
                const item = testItems[0];
                const table = tableNames[("status_fail" + "_" + item.description) as Table];
                const ingestionProperties = item.ingestionPropertiesCallback(table);
                ingestionProperties.reportLevel = ReportLevel.FailuresAndSuccesses;
                ingestionProperties.database = "invalid";
                try {
                    await ingestClient.ingestFromFile(item.path, ingestionProperties);
                    const status = await waitForStatus();
                    assert.strictEqual(status.SuccessCount, 0);
                    assert.strictEqual(status.FailureCount, 1);
                } catch (err) {
                    assert.fail(`Failed to ingest ${item.description} - ${util.format(err)}`);
                }
            };
            await checkFail();
        });

        describe("QueryClient", () => {
            it.concurrent("General BadRequest", async () => {
                try {
                    await queryClient.executeQuery(databaseName, "invalidSyntax ");
                } catch (ex) {
                    const exTyped = ex as { request: unknown; config: { headers: { [k: string]: string } } };
                    assert.strictEqual(exTyped.request, undefined);
                    assert.strictEqual(exTyped.config.headers.Authorization, "<REDACTED>");
                    return;
                }
                assert.fail(`General BadRequest`);
            });

            it.concurrent("PartialQueryFailure", async () => {
                try {
                    await queryClient.executeQuery(databaseName, "invalidSyntax ");
                } catch (ex) {
                    return;
                }
                assert.fail(`Didn't throw PartialQueryFailure`);
            });

            it.concurrent("executionTimeout", async () => {
                try {
                    const properties: ClientRequestProperties = new ClientRequestProperties();
                    properties.setTimeout(10);
                    await queryClient.executeQuery(databaseName, tableNames.general_csv, properties);
                } catch (ex: unknown) {
                    assert.ok(ex instanceof Error);
                    assert.match(ex.message, /.*Query is expired.*/, `Fail to get "Query is expired". ex json: ${JSON.stringify(ex)}, ex: ${ex}`);
                    return;
                }
                assert.fail(`Didn't throw executionTimeout`);
            });
        });
    });

    describe("NoRedirects", () => {
        const redirectCodes = [301];
        kustoTrustedEndpoints.addTrustedHosts([new MatchRule("statusreturner.azurewebsites.net", false)], false);

        it.concurrent.each(redirectCodes.map((r) => ({ code: r })))("noRedirectsClientFail_%s", async ({ code }) => {
            const kcsb = `https://statusreturner.azurewebsites.net/${code}`;
            const client = new Client(kcsb);
            try {
                await client.execute(databaseName, tableNames.general_csv);
                assert.fail("Expected exception");
            } catch (ex) {
                assert.ok(ex instanceof Error);
                assert.match(ex.message, new RegExp(`.*${code}.*`), `Fail to get ${code} error code. ex json: ${JSON.stringify(ex)}, ex: ${ex}`);
                assert.doesNotMatch(ex.message, new RegExp(`.*cloud.*`), "Unexpected cloud in error.");
            } finally {
                client.close();
            }
        });

        it.concurrent.each(redirectCodes.map((r) => ({ code: r })))("noRedirectsCloudFail_%s", async ({ code }) => {
            const kcsb = ConnectionStringBuilder.withAadApplicationKeyAuthentication(
                `https://statusreturner.azurewebsites.net/nocloud/${code}`,
                "fake",
                "fake",
                "fake"
            );
            const client = new Client(kcsb);
            try {
                await client.execute(databaseName, tableNames.general_csv);
                assert.fail("Expected exception");
            } catch (ex) {
                assert.ok(ex instanceof Error);
                assert.match(ex.message, new RegExp(`.*cloud.*${code}.*`), `Fail to get ${code} error code. ex json: ${JSON.stringify(ex)}, ex: ${ex}`);
            } finally {
                client.close();
            }
        });
    });

    describe("Mgmt Parsing", () => {
        it.concurrent("Parse .show tables correctly", async () => {
            const result = await queryClient.execute(databaseName, ".show tables | project TableName, DatabaseName");
            expect(result.tables.length).toBeGreaterThan(0);
            expect(result.primaryResults.length).toBe(1);
            expect(result.primaryResults[0].columns.map((c) => c.name)).toEqual(["TableName", "DatabaseName"]);
        });

        it.concurrent("Parse .show database correctly", async () => {
            const result = await queryClient.execute(databaseName, `.show database ${databaseName}  policy retention | project ChildEntities, EntityType`);
            expect(result.tables.length).toBeGreaterThan(0);
            expect(result.primaryResults.length).toBe(1);
            expect(result.primaryResults[0].columns.map((c) => c.name)).toEqual(["ChildEntities", "EntityType"]);
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

    const assertRowsCount = async (testItem: TestDataItem, table: string) => {
        let count = 0;
        const expected = testItem.rows;
        // Timeout = 3 min
        for (let i = 0; i < 60; i++) {
            let results;
            try {
                results = await queryClient.execute(databaseName!, `${table} | count `);
            } catch (ex) {
                continue;
            }

            const row = results.primaryResults[0].toJSON<{ Count: number }>().data[0];

            count = row.Count;
            if (count >= expected) {
                break;
            }
            await sleep(1000);
        }
        assert.strictEqual(count, expected, `Failed to ingest ${testItem.description} - '${count}' rows ingested, expected '${expected}'`);
        console.log(`${testItem.description} - '${count}' rows ingested, expected '${expected}'`);
    };
};

main();
