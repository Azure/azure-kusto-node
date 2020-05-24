const assert = require("assert");
const fs = require('fs');
const path = require('path')

const IngestClient = require("../../source/ingestClient");
const ConnectionStringBuilder = require("../../node_modules/azure-kusto-data").KustoConnectionStringBuilder;
const Client = require("../.././node_modules/azure-kusto-data").Client;
const StreamingIngestClient = require("../../source/streamingIngestClient");
const { FileDescriptor, StreamDescriptor, CompressionType } = require("../../source/descriptors");
const { IngestionProperties, DataFormat } = require("../../source/ingestionProperties");

const databaseName = process.env.TEST_DATABASE;
const appId = process.env.APP_ID;
const appKey = process.env.APP_KEY;
const tenantId = process.env.TENANT_ID;

const engineKcsb = ConnectionStringBuilder.withAadApplicationKeyAuthentication(process.env.ENGINE_CONNECTION_STRING, appId, appKey, tenantId);
const queryClient = new Client(engineKcsb);
const streamingIngestClient = new StreamingIngestClient(engineKcsb);
const dmKcsb = ConnectionStringBuilder.withAadApplicationKeyAuthentication(process.env.DM_CONNECTION_STRING, appId, appKey, tenantId);
const ingestClient = new IngestClient(dmKcsb);

class testDataItem {
    constructor(description, path, rows, ingestionProperties, testOnstreamingIngestion = true) {
        this.description = description;
        this.path = path;
        this.rows = rows;
        this.ingestionProperties = ingestionProperties;
        this.testOnstreamingIngestion = testOnstreamingIngestion;
    }
}

const tableName = "NodeTest" + Date.now();
const mappingName = "mappingRef";
const tableColumns = "(rownumber:int, rowguid:string, xdouble:real, xfloat:real, xbool:bool, xint16:int, xint32:int, xint64:long, xuint8:long, xuint16:long, xuint32:long, xuint64:long, xdate:datetime, xsmalltext:string, xtext:string, xnumberAsText:string, xtime:timespan, xtextWithNulls:string, xdynamicWithNulls:dynamic)";

const mapping = fs.readFileSync(getTestResourcePath("dataset_mapping.json"), { encoding: 'utf8' });
const columnmapping = JSON.parse(mapping);

const ingestionPropertiesWithoutMapping = new IngestionProperties({ database: databaseName, table: tableName, format: DataFormat.CSV, flushImmediately: true });
const ingestionPropertiesWithMappingReference = new IngestionProperties({ database: databaseName, table: tableName, format: DataFormat.JSON, ingestionMappingReference: mappingName, flushImmediately: true });
const ingestionPropertiesWithColumnMapping = new IngestionProperties({ database: databaseName, table: tableName, format: DataFormat.JSON, ingestionMapping: columnmapping, flushImmediately: true });

const testItems = [
    new testDataItem("csv", getTestResourcePath("dataset.csv"), 10, ingestionPropertiesWithoutMapping),
    new testDataItem("csv.gz", getTestResourcePath("dataset.csv.gz"), 10, ingestionPropertiesWithoutMapping),
    new testDataItem("json with mapping ref", getTestResourcePath("dataset.json"), 2, ingestionPropertiesWithMappingReference),
    new testDataItem("json.gz with mapping ref", getTestResourcePath("dataset.json.gz"), 2, ingestionPropertiesWithMappingReference),
    new testDataItem("json with mapping", getTestResourcePath("dataset.json"), 2, ingestionPropertiesWithColumnMapping, false),
    new testDataItem("json.gz with mapping", getTestResourcePath("dataset.json.gz"), 2, ingestionPropertiesWithColumnMapping, false)];

var currentCount = 0;

describe(`E2E Tests - ${tableName}` , function () {
    after(function() {         
        queryClient.execute(databaseName, `.drop table ${tableName} ifexists`, (err, results) => {});
    });

    describe('SetUp', function () {
        it('Create table', function (done) {
            queryClient.execute(databaseName, `.create table ${tableName} ${tableColumns}`, (err, results) => {
                if (err) assert.fail("Failed to create table");
                done();
            });
        });

        it('Create table ingestion mapping', function (done) {
            queryClient.execute(databaseName, `.create-or-alter table ${tableName} ingestion json mapping '${mappingName}' '${mapping}'`, (err, results) => {
                if (err) assert.fail("Failed to create table ingestion mapping");
                done();
            });
        });
    });

    describe('ingestClient', function () {
        it('ingestFromFile', async function () {
            for (let item of testItems) {
                await new Promise((resolve) => {
                    ingestClient.ingestFromFile(item.path, item.ingestionProperties, async (err, results) => {
                        if (err) assert.fail(`Failed to ingest ${item.description}`);
                        resolve();
                    });
                });
                await assertRowsCount(item);
            }
        });

        it('ingestFromStream', async function () {
            for (let item of testItems) {
                let stream = fs.createReadStream(item.path);
                if (item.path.endsWith('gz')) {
                    stream = new StreamDescriptor(stream, null, CompressionType.GZIP);
                }
                await new Promise((resolve) => {
                    ingestClient.ingestFromStream(stream, item.ingestionProperties, async (err, results) => {
                        if (err) assert.fail(`Failed to ingest ${item.description}`);
                        resolve();
                    });
                });
                await assertRowsCount(item);
            }
        });
    });

    describe('StreamingIngestClient', function () {
        it('ingestFromFile', async function () {
            for (let item of testItems.filter(item => item.testOnstreamingIngestion)) {
                await new Promise((resolve) => {
                    streamingIngestClient.ingestFromFile(item.path, item.ingestionProperties, async (err, results) => {
                        if (err) assert.fail(`Failed to ingest ${item.description}`);
                        resolve();
                    });
                });
                await assertRowsCount(item);
            }
        });

        it('ingestFromStream', async function () {
            for (let item of testItems.filter(item => item.testOnstreamingIngestion)) {
                let stream = fs.createReadStream(item.path);
                if (item.path.endsWith('gz')) {
                    stream = new StreamDescriptor(stream, null, CompressionType.GZIP);
                }
                await new Promise((resolve) => {
                    streamingIngestClient.ingestFromStream(stream, item.ingestionProperties, async (err, results) => {
                        if (err) assert.fail(`Failed to ingest ${item.description}`);
                        resolve();
                    });
                });
                await assertRowsCount(item);
            }
        });
    });
});

function sleep(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function getTestResourcePath(name) {
    return `/home/runner/work/azure-kusto-node/azure-kusto-nodet/azure-kusto-ingest/test/e2eTests/e2eData/${name}`;
}

async function assertRowsCount(testItem) {
    var count = 0;
    var expected = testItem.rows;
    // Timeout = 3 min
    for (var i = 0; i < 18; i++) {
        await sleep(10000);
        await new Promise((resolve) => {
            queryClient.execute(databaseName, `${tableName} | count `, (err, results) => {
                if (results) {
                    count = results.primaryResults[0][0].Count - currentCount;
                }
                resolve();
            });
        });

        if (count >= expected) {
            break;
        }
    }
    currentCount += count;
    assert.equal(count, expected, `Failed to ingest ${testItem.description}`);
}

