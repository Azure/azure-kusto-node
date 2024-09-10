// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable no-console */

import {
    Client,
    ClientRequestProperties,
    CloudSettings,
    KustoConnectionStringBuilder as ConnectionStringBuilder,
    KustoConnectionStringBuilder,
    kustoTrustedEndpoints,
    MatchRule,
} from "azure-kusto-data";
import {
    IngestClient,
    CompressionType,
    StreamDescriptor,
    DataFormat,
    IngestionProperties,
    JsonColumnMapping,
    ReportLevel,
    ReportMethod,
    ManagedStreamingIngestClient,
    StreamingIngestClient,
    IngestionStatus,
    IngestionResult,
} from "azure-kusto-ingest";

import { sleep } from "../../src/retry.js";

import { AzureCliCredential } from "@azure/identity";
import assert from "assert";
import fs, { ReadStream } from "fs";
import util from "util";
import { v4 as uuidv4 } from "uuid";
import { basename, dirname } from "path";
import sinon from "sinon";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ParsedJsonMapping {
    Properties: { Path: string };
    column: string;
    datatype: string;
}

const databaseName = process.env.TEST_DATABASE;
const appId = process.env.APP_ID || process.env.AZURE_CLIENT_ID;
const appKey = process.env.APP_KEY;
const tenantId = process.env.TENANT_ID || process.env.AZURE_TENANT_ID;

const main = (): void => {
    if (!databaseName || !process.env.ENGINE_CONNECTION_STRING) {
        process.stdout.write("Skip E2E test - Missing env variables");
        return;
    }

    const ecs = process.env.ENGINE_CONNECTION_STRING;
    const dcs = process.env.DM_CONNECTION_STRING ?? ecs;
    const cred = new AzureCliCredential({});

    const engineKcsb =
        appId && appKey && tenantId
            ? ConnectionStringBuilder.withAadApplicationKeyAuthentication(ecs, appId, appKey, tenantId)
            : ConnectionStringBuilder.withTokenCredential(ecs, cred);
    const dmKcsb =
        appId && appKey && tenantId
            ? ConnectionStringBuilder.withAadApplicationKeyAuthentication(dcs, appId, appKey, tenantId)
            : ConnectionStringBuilder.withTokenCredential(dcs, cred);

    engineKcsb.applicationNameForTracing = "NodeE2ETest_ø";

    const queryClient = new Client(engineKcsb);
    const streamingIngestClient = new StreamingIngestClient(engineKcsb);
    const ingestClient = new IngestClient(dmKcsb);
    const dmKustoClient = new Client(dmKcsb);

    const managedStreamingIngestClient = new ManagedStreamingIngestClient(engineKcsb, dmKcsb);
    const mockedStreamingIngestClient = new StreamingIngestClient(engineKcsb);
    const streamStub = sinon.stub(mockedStreamingIngestClient, "ingestFromStream");
    streamStub.throws({ "@permanent": false });
    const mockedManagedClient: ManagedStreamingIngestClient = Object.setPrototypeOf(
        {
            streamingIngestClient: mockedStreamingIngestClient,
            queuedIngestClient: ingestClient,
            baseSleepTimeSecs: 0,
            baseJitterSecs: 0,
            defaultProps: new IngestionProperties({}),
        },
        ManagedStreamingIngestClient.prototype
    );

    const tables = [
        "general",
        "queued_file",
        "queued_stream",
        "streaming_file",
        "streaming_stream",
        "streaming_blob",
        "managed_file",
        "managed_mocked_file",
        "managed_stream",
        "status_success",
        "status_fail",
        "status_table",
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
    const ingestionPropertiesWithIgnoreFirstRecord = (t: string) =>
        new IngestionProperties({
            database: databaseName,
            table: t,
            format: DataFormat.CSV,
            ignoreFirstRecord: true,
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
        new TestDataItem("csv_ignore_first_record", getTestResourcePath("dataset.csv"), 9, ingestionPropertiesWithIgnoreFirstRecord, false),
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
        const cmd = ".drop tables (" + Object.values(tableNames).toString() + ") ifexists";
        await queryClient.execute(databaseName, cmd);
        queryClient.close();
        ingestClient.close();
    });

    beforeAll(async () => {
        try {
            await Promise.all(
                Object.values(tableNames).map(async (tableName, i) => {
                    const tableCommands = async (database: string, table: string) => {
                        await queryClient.execute(database, `.create-merge table ${table} ${tableColumns}`);
                        await queryClient.execute(database, `.alter table ${table} policy streamingingestion enable`);
                        try {
                            await queryClient.execute(
                                database,
                                `.alter table ${table} policy ingestionbatching @'{"MaximumBatchingTimeSpan":"00:00:10", "MaximumNumberOfItems": 500, "MaximumRawDataSizeMB": 1024}'`
                            );
                            await dmKustoClient.execute(
                                KustoConnectionStringBuilder.DefaultDatabaseName,
                                `.refresh database '${database}' table '${table}' cache ingestionbatchingpolicy`
                            );
                        } catch (err) {
                            console.error("Failed refreshing policies from DM: " + util.format(err));
                        }

                        console.log("Create table ingestion mapping");
                        await queryClient.execute(database, `.create-or-alter table ${table} ingestion json mapping '${mappingName}' '${mapping}'`);
                    };
                    try {
                        await tableCommands(databaseName, tableName);
                    } catch (err) {
                        console.log(`Creating table ${tableName}, with columns ${tableColumns}`);
                        if ((err as Error)?.name.includes("Throttling")) {
                            await sleep(i * 100);
                            await tableCommands(databaseName, tableName);
                        }
                        assert.fail(`Failed to create table $,{tableName} ${err} ${databaseName}, error: ${util.format(err)}`);
                    }
                })
            );

            await queryClient.execute(databaseName, ".clear database cache streamingingestion schema");
        } catch (e) {
            assert.fail(util.format(e));
        }
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
            )("ingestFromFile_TableReporting_$item.description", async ({ item }) => {
                const table = tableNames[("status_table" + "_" + item.description) as Table];
                const props = item.ingestionPropertiesCallback(table);
                props.reportLevel = ReportLevel.FailuresAndSuccesses;
                props.reportMethod = ReportMethod.QueueAndTable;
                try {
                    const res: IngestionResult = await ingestClient.ingestFromFile(item.path, props);
                    assert.ok(res, "ingest result returned null or undefined");
                    assert.equal(res.constructor.name, "TableReportIngestionResult");
                    let status: IngestionStatus;
                    const endTime = Date.now() + 180000; // Timeout is 3 minutes
                    while (Date.now() < endTime) {
                        status = await res.getIngestionStatusCollection();
                        if (status.Status === "Pending") {
                            await sleep(1000);
                        }
                    }

                    assert.equal(status!.Status, "Succeeded");
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

            it.concurrent.each(
                testItems
                    .filter((i) => i.testOnStreamingIngestion)
                    .map((i) => {
                        return { item: i };
                    })
            )("ingestFromBlob_$item.description", async ({ item }) => {
                const blobName = uuidv4() + basename(item.path);
                const blobUri = await ingestClient.uploadToBlobWithRetry(item.path, blobName);

                const table = tableNames[("streaming_blob" + "_" + item.description) as Table];
                try {
                    await streamingIngestClient.ingestFromBlob(blobUri, item.ingestionPropertiesCallback(table));
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
                // Expect mocked client to retry stream after transient failure and succeed from queue with same stream
                const table = tableNames[("managed_mocked_file" + "_" + item.description) as Table];
                try {
                    await mockedManagedClient.ingestFromFile(item.path, item.ingestionPropertiesCallback(table));
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
                    assert.match(
                        ex.message,
                        /.*Request failed with status code 504.*/,
                        `Fail to get "Query is expired". ex json: ${JSON.stringify(ex)}, ex: ${ex}`
                    );
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
