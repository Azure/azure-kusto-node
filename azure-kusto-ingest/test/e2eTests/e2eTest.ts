// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import fs, {ReadStream} from 'fs';
import IngestClient from "../../source/ingestClient";
import KustoIngestStatusQueues from "../../source/status";
import {
    Client,
    KustoConnectionStringBuilder as ConnectionStringBuilder,
    ClientRequestProperties,
    // @ts-ignore
} from "../.././node_modules/azure-kusto-data";
import StreamingIngestClient from "../../source/streamingIngestClient";
import {CompressionType, StreamDescriptor} from "../../source/descriptors";
import {DataFormat, IngestionProperties, ReportLevel} from "../../source/ingestionProperties";
import { CloudSettings } from "../.././node_modules/azure-kusto-data/source/cloudSettings";

const databaseName = process.env.TEST_DATABASE;
const appId = process.env.APP_ID;
const appKey = process.env.APP_KEY;
const tenantId = process.env.TENANT_ID;

function main(): void {

    CloudSettings.getInstance().getCloudInfoForCluster("https://www.microsoft.com");

    
    if (!databaseName || !appId || !appKey || !tenantId) {
        process.stdout.write("Skip E2E test - Missing env variables");
        return;
    }

    const engineKcsb = ConnectionStringBuilder.withAadApplicationKeyAuthentication(process.env.ENGINE_CONNECTION_STRING ?? "", appId, appKey, tenantId);
    const queryClient = new Client(engineKcsb);
    const streamingIngestClient = new StreamingIngestClient(engineKcsb);
    const dmKcsb = ConnectionStringBuilder.withAadApplicationKeyAuthentication(process.env.DM_CONNECTION_STRING ?? "", appId, appKey, tenantId);
    const ingestClient = new IngestClient(dmKcsb);
    const statusQueues = new KustoIngestStatusQueues(ingestClient);

    class testDataItem {
        constructor(public description: string, public path: string, public rows: number, public ingestionProperties: IngestionProperties, public testOnstreamingIngestion = true) {
        }
    }

    const tableName = "NodeTest" + Date.now();
    const mappingName = "mappingRef";
    const tableColumns = "(rownumber:int, rowguid:string, xdouble:real, xfloat:real, xbool:bool, xint16:int, xint32:int, xint64:long, xuint8:long, xuint16:long, xuint32:long, xuint64:long, xdate:datetime, xsmalltext:string, xtext:string, xnumberAsText:string, xtime:timespan, xtextWithNulls:string, xdynamicWithNulls:dynamic)";

    const mapping = fs.readFileSync(getTestResourcePath("dataset_mapping.json"), {encoding: 'utf8'});
    const columnmapping = JSON.parse(mapping);

    const ingestionPropertiesWithoutMapping = new IngestionProperties({
        database: databaseName,
        table: tableName,
        format: DataFormat.CSV,
        flushImmediately: true
    });
    const ingestionPropertiesWithMappingReference = new IngestionProperties({
        database: databaseName,
        table: tableName,
        format: DataFormat.JSON,
        ingestionMappingReference: mappingName,
        flushImmediately: true
    });
    const ingestionPropertiesWithColumnMapping = new IngestionProperties({
        database: databaseName,
        table: tableName,
        format: DataFormat.JSON,
        ingestionMapping: columnmapping,
        flushImmediately: true
    });

    const testItems = [
        new testDataItem("csv", getTestResourcePath("dataset.csv"), 10, ingestionPropertiesWithoutMapping),
        new testDataItem("csv.gz", getTestResourcePath("dataset_gzip.csv.gz"), 10, ingestionPropertiesWithoutMapping),
        new testDataItem("json with mapping ref", getTestResourcePath("dataset.json"), 2, ingestionPropertiesWithMappingReference),
        new testDataItem("json.gz with mapping ref", getTestResourcePath("dataset_gzip.json.gz"), 2, ingestionPropertiesWithMappingReference),
        new testDataItem("json with mapping", getTestResourcePath("dataset.json"), 2, ingestionPropertiesWithColumnMapping, false),
        new testDataItem("json.gz with mapping", getTestResourcePath("dataset_gzip.json.gz"), 2, ingestionPropertiesWithColumnMapping, false)
    ];

    let currentCount = 0;

    describe(`E2E Tests - ${tableName}`, function () {
        after(async function () {
            try {
                await queryClient.execute(databaseName, `.drop table ${tableName} ifexists`);
            } catch (err) {
                assert.fail("Failed to drop table");
            }
        });

        describe('SetUp', function () {
            it('Create table', async function () {
                try {
                    await queryClient.execute(databaseName, `.create table ${tableName} ${tableColumns}`);
                } catch (err) {
                    assert.fail("Failed to create table");
                }
            });

            it('Create table ingestion mapping', async function () {
                try {
                    await queryClient.execute(databaseName, `.create-or-alter table ${tableName} ingestion json mapping '${mappingName}' '${mapping}'`);
                } catch (err) {
                    assert.fail("Failed to create table ingestion mapping" + err);
                }
            });
        });
        
        describe('cloud info', function () {
            it('Cached cloud info', async function () {
                const cloudInfo = CloudSettings.getInstance().cloudCache[process.env.ENGINE_CONNECTION_STRING as string]; // it should be already in the cache at this point
                assert.strictEqual(cloudInfo.KustoClientAppId, CloudSettings.getInstance().defaultCloudInfo.KustoClientAppId);
            })

            it('cloud info 404', async function () {
                const cloudInfo = CloudSettings.getInstance().getCloudInfoForCluster("https://www.microsoft.com");
                assert.strictEqual(cloudInfo, CloudSettings.getInstance().defaultCloudInfo);
            })
        });

        describe('ingestClient', function () {
            it('ingestFromFile', async function () {
                for (const item of testItems) {
                    try {
                        await ingestClient.ingestFromFile(item.path, item.ingestionProperties);
                    } catch (err) {
                        console.error(err);
                        assert.fail(`Failed to ingest ${item.description}`);
                    }
                    await assertRowsCount(item);
                }
            }).timeout(240000);

            it('ingestFromStream', async function () {
                for (const item of testItems) {
                    let stream: ReadStream | StreamDescriptor = fs.createReadStream(item.path);
                    if (item.path.endsWith('gz')) {
                        stream = new StreamDescriptor(stream, null, CompressionType.GZIP);
                    }
                    try {
                        await ingestClient.ingestFromStream(stream, item.ingestionProperties);
                    } catch (err) {
                        assert.fail(`Failed to ingest ${item.description}`);
                    }
                    await assertRowsCount(item);
                }
            }).timeout(240000);
        });

        describe('StreamingIngestClient', function () {
            it('ingestFromFile', async function () {
                for (const item of testItems.filter(item => item.testOnstreamingIngestion)) {
                    try {
                        await streamingIngestClient.ingestFromFile(item.path, item.ingestionProperties);
                    } catch (err) {
                        console.error(err);
                        assert.fail(`Failed to ingest ${item.description}`);
                    }
                    await assertRowsCount(item);
                }
            }).timeout(240000);

            it('ingestFromStream', async function () {
                for (const item of testItems.filter(item => item.testOnstreamingIngestion)) {
                    let stream: ReadStream | StreamDescriptor = fs.createReadStream(item.path);
                    if (item.path.endsWith('gz')) {
                        stream = new StreamDescriptor(stream, null, CompressionType.GZIP);
                    }
                    try {
                        await streamingIngestClient.ingestFromStream(stream, item.ingestionProperties);
                    } catch (err) {
                        assert.fail(`Failed to ingest ${item.description}`);
                    }
                    await assertRowsCount(item);
                }
            }).timeout(240000);
        });

        describe('KustoIngestStatusQueues', function () {
            it('CleanStatusQueues', async function () {
                try {
                    await cleanStatusQueues();
                } catch (err) {
                    console.error(err);
                    assert.fail(`Failed to Clean status queues`);
                }
            }).timeout(240000);

            it('CheckSucceededIngestion', async function () {
                const item = testItems[0];
                item.ingestionProperties.reportLevel = ReportLevel.FailuresAndSuccesses;
                try {
                    await ingestClient.ingestFromFile(item.path, item.ingestionProperties);
                    const status = await waitForStatus();
                    assert.equal(status.SuccessCount, 1);
                    assert.equal(status.FailureCount, 0);
                } catch (err) {
                    console.error(err);
                    assert.fail(`Failed to ingest ${item.description}`);
                }
            }).timeout(240000);

            it('CheckFailedIngestion', async function () {
                const item = testItems[0];
                item.ingestionProperties.reportLevel = ReportLevel.FailuresAndSuccesses;
                item.ingestionProperties.database = "invalid";
                try {
                    await ingestClient.ingestFromFile(item.path, item.ingestionProperties);
                    const status = await waitForStatus();
                    assert.equal(status.SuccessCount, 0);
                    assert.equal(status.FailureCount, 1);
                } catch (err) {
                    console.error(err);
                    assert.fail(`Failed to ingest ${item.description}`);
                }
            }).timeout(240000);
        });

        describe('QueryClient', function () {
            it('General BadRequest', async function () {
                try {
                    await queryClient.executeQuery(databaseName, "invalidSyntax ");
                } catch (ex) {
                    return;
                }
                assert.fail(`General BadRequest`);
            });

            it('PartialQueryFailure', async function () {
                try {
                    await queryClient.executeQuery(databaseName, "invalidSyntax ");

                } catch (ex) {
                    return;
                }
                assert.fail(`Didn't throw PartialQueryFailure`);
            });

            it('executionTimeout', async function () {
                try {
                    var properties = new ClientRequestProperties();
                    properties.setTimeout(10);
                    await queryClient.executeQuery(databaseName, `${tableName}`, properties);

                } catch (ex) {
                    assert.equal(ex.code, 'Request execution timeout');
                    return;
                }
                assert.fail(`Didn't throw executionTimeout`);
            });
        });
    });

    async function cleanStatusQueues() {
        while (!await statusQueues.failure.isEmpty()) {
            await statusQueues.failure.pop();
        }

        while (!await statusQueues.success.isEmpty()) {
            await statusQueues.success.pop();
        }
    }

    async function waitForStatus() {
        while (await statusQueues.failure.isEmpty() && await statusQueues.success.isEmpty()) {
            await sleep(1000);
        }

        const failures = await statusQueues.failure.pop();
        const successes = await statusQueues.success.pop();

        return {"SuccessCount": successes.length, "FailureCount": failures.length}
    }

    function sleep(ms: number) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    function getTestResourcePath(name: string) {
        return __dirname + `/e2eData/${name}`;
    }

    async function assertRowsCount(testItem: testDataItem) {
        let count = 0;
        const expected = testItem.rows;
        // Timeout = 3 min
        for (let i = 0; i < 18; i++) {
            await sleep(10000);
            let results;
            try {
                results = await queryClient.execute(databaseName ?? "", `${tableName} | count `);
            } catch (ex) {
                continue;
            }

            count = results.primaryResults[0][0].Count - currentCount;
            if (count >= expected) {
                break;
            }
        }
        currentCount += count;
        assert.equal(count, expected, `Failed to ingest ${testItem.description}`);
    }
}

main();