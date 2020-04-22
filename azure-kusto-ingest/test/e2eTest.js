const assert = require("assert");
const fs = require('fs');
const path = require('path')

const IngestClient = require("../source/ingestClient");
const ConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
const Client = require("azure-kusto-data").Client;
const StreamingIngestClient = require("../source/streamingIngestClient");
const { FileDescriptor, StreamDescriptor, CompressionType } = require("../source/descriptors");
const { IngestionProperties, DataFormat } = require("../source/ingestionProperties");

const tableName = "NodeTest"
const mappingName = "mappingRef"
const tableColumns = "(rownumber:int, rowguid:string, xdouble:real, xfloat:real, xbool:bool, xint16:int, xint32:int, xint64:long, xuint8:long, xuint16:long, xuint32:long, xuint64:long, xdate:datetime, xsmalltext:string, xtext:string, xnumberAsText:string, xtime:timespan, xtextWithNulls:string, xdynamicWithNulls:dynamic)";

var databaseName = process.env.TEST_DATABASE;
var appId = process.env.APP_ID;
var appKey = process.env.APP_KEY;
var tenantId = process.env.TENANT_ID;

var testDataItem = function (path, rows, ingestionProperties, testOnstreamingIngestion = false) {
    this.path = path;
    this.rows = rows;
    this.ingestionProperties = ingestionProperties;
    this.testOnstreamingIngestion = testOnstreamingIngestion;
}
var ingestionPropertiesWithoutMapping =  new IngestionProperties({database: databaseName, table: tableName, format: DataFormat.CSV, flushImmediately: true});
var ingestionPropertiesWithtMappingReference =  new IngestionProperties({database: databaseName, table: tableName, format: DataFormat.JSON, ingestionMappingReference: mappingName,flushImmediately: true});

var testItems = [
    new testDataItem(getTestResourcePath("dataset.csv"), 10, ingestionPropertiesWithoutMapping),
    new testDataItem(getTestResourcePath("dataset.csv.gz"), 10, ingestionPropertiesWithoutMapping),
    new testDataItem(getTestResourcePath("dataset.json"), 10, ingestionPropertiesWithtMappingReference),
    new testDataItem(getTestResourcePath("dataset.json.gz"), 10, ingestionPropertiesWithtMappingReference)];

var engineKcsb = ConnectionStringBuilder.withAadApplicationKeyAuthentication(process.env.ENGINE_CONECTION_STRING, appId, appKey, tenantId);
var queryClient = new Client(engineKcsb);
var streamingIngestClient = new StreamingIngestClient(engineKcsb);
var dmKcsb = ConnectionStringBuilder.withAadApplicationKeyAuthentication(process.env.DM_CONECTION_STRING, appId, appKey, tenantId);
var ingestClient = new IngestClient(dmKcsb);


queryClient.execute(databaseName, `.create table ${tableName} ${tableColumns}`, (err, results) => {if (err) throw new Error(err);});

var mapping = fs.readFileSync(getTestResourcePath("dataset_mapping.json"), { encoding: 'utf8' });

queryClient.execute(databaseName, `.create-or-alter table ${tableName} ingestion json mapping '${mappingName}' '${mapping}'`, (err, results) => {
    if (err) throw new Error(err);
});

for (let item of testItems) {
    streamingIngestClient.ingestFromFile(item.path, item.ingestionProperties, (err, results) => {
        if (err) assert.fail("Failed to Ingest");
        console.log(JSON.stringify(results));
    });
}
const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}
sleep(500).then(() => {
for (let item of testItems) { 
    let stream = fs.createReadStream(item.path);
    if(item.path.endsWith('gz')){
        stream = new StreamDescriptor(stream, null, CompressionType.GZIP);
    }
    ingestClient.ingestFromStream(stream, item.ingestionProperties, (err, results) => {
        if (err) assert.fail("Failed to Ingest");
        console.log(JSON.stringify(results));
    });
}
})


function getTestResourcePath(name){
    return path.relative(process.cwd(), `azure-kusto-ingest/test/data/${name}`);
}

// describe("e2e", function () {
//     describe("#constructor()", function () {}}

// KustoIngestClient ingestClient;
// KustoStreamingIngestClient streamingIngestClient;
// private static ClientImpl queryClient;
// private static String databaseName;
// private static String principalFqn;
// private static String resourcesPath;
// private static int currentCount = 0;
// private static List<TestDataItem> dataForTests;
// private static final String tableName = "JavaTest";
// private static final String mappingReference = "mappingRef";
// private static final String tableColumns = "(rownumber:int, rowguid:string, xdouble:real, xfloat:real, xbool:bool, xint16:int, xint32:int, xint64:long, xuint8:long, xuint16:long, xuint32:long, xuint64:long, xdate:datetime, xsmalltext:string, xtext:string, xnumberAsText:string, xtime:timespan, xtextWithNulls:string, xdynamicWithNulls:dynamic)";

// function setUp() {
//     ConnectionStringBuilder dmCsb = ConnectionStringBuilder
//             .createWithAadApplicationCredentials(System.getenv("ENGINE_CONECTION_STRING"), appId, appKey, tenantId);
//     try {
//         ingestClient = IngestClientFactory.createClient(dmCsb);
//     } catch (URISyntaxException ex) {
//         Assertions.fail("Failed to create ingest client", ex);
//     }

//     ConnectionStringBuilder engineCsb = ConnectionStringBuilder
//             .createWithAadApplicationCredentials(System.getenv("ENGINE_CONECTION_STRING"), appId, appKey, tenantId);
//     try {
//         streamingIngestClient = IngestClientFactory.createStreamingIngestClient(engineCsb);
//         queryClient = new ClientImpl(engineCsb);
//     } catch (URISyntaxException ex) {
//         Assertions.fail("Failed to create query and streamingIngest client", ex);
//     }

//     CreateTableAndMapping();
//     createTestData();
// }

// private static void CreateTableAndMapping() {
//     try {
//         queryClient.execute(databaseName, String.format(".drop table %s ifexists", tableName));
//         Thread.sleep(1000);
//         queryClient.execute(databaseName, String.format(".create table %s %s", tableName, tableColumns));
//     } catch (Exception ex) {
//         Assertions.fail("Failed to drop and create new table", ex);
//     }

//     resourcesPath = Paths.get(System.getProperty("user.dir"), "src","test", "resources").toString();
//     try {
//         String mappingAsString = new String(Files.readAllBytes(Paths.get(resourcesPath, "dataset_mapping.json")));
//         queryClient.execute(databaseName, String.format(".create table %s ingestion json mapping '%s' '%s'",
//                 tableName, mappingReference, mappingAsString));
//     } catch (Exception ex) {
//         Assertions.fail("Failed to create ingestion mapping", ex);
//     }
// }

// private static void createTestData() {
//     IngestionProperties ingestionPropertiesWithoutMapping = new IngestionProperties(databaseName, tableName);
//     ingestionPropertiesWithoutMapping.setFlushImmediately(true);

//     IngestionProperties ingestionPropertiesWithMappingReference = new IngestionProperties(databaseName, tableName);
//     ingestionPropertiesWithMappingReference.setFlushImmediately(true);
//     ingestionPropertiesWithMappingReference.setIngestionMapping(mappingReference, IngestionMappingKind.Json);
//     ingestionPropertiesWithMappingReference.setDataFormat(DATA_FORMAT.json);

//     IngestionProperties ingestionPropertiesWithColumnMapping = new IngestionProperties(databaseName, tableName);
//     ingestionPropertiesWithColumnMapping.setFlushImmediately(true);
//     ingestionPropertiesWithColumnMapping.setDataFormat(DATA_FORMAT.json);
//     ColumnMapping first = new ColumnMapping("rownumber", "int");
//     first.setPath("$.rownumber");
//     ColumnMapping second = new ColumnMapping("rowguid", "string");
//     second.setPath("$.rowguid");
//     ColumnMapping[] columnMapping = new ColumnMapping[] { first, second };
//     ingestionPropertiesWithColumnMapping.setIngestionMapping(columnMapping, IngestionMappingKind.Json);

//     dataForTests = Arrays.asList(new TestDataItem() {
//         {
//             file = new File(resourcesPath, "dataset.csv");
//             rows = 10;
//             ingestionProperties = ingestionPropertiesWithoutMapping;
//         }
//     }, new TestDataItem() {
//         {
//             file = new File(resourcesPath, "dataset.csv.gz");
//             rows = 10;
//             ingestionProperties = ingestionPropertiesWithoutMapping;
//         }
//     }, new TestDataItem() {
//         {
//             file = new File(resourcesPath, "dataset.json");
//             rows = 2;
//             ingestionProperties = ingestionPropertiesWithMappingReference;
//         }
//     }, new TestDataItem() {
//         {
//             file = new File(resourcesPath, "dataset.json.gz");
//             rows = 2;
//             ingestionProperties = ingestionPropertiesWithMappingReference;
//         }
//     }, new TestDataItem() {
//         {
//             file = new File(resourcesPath, "dataset.json");
//             rows = 2;
//             ingestionProperties = ingestionPropertiesWithColumnMapping;
//             testOnstreamingIngestion = false; // streaming ingestion doesn't support inline mapping
//         }
//     }, new TestDataItem() {
//         {
//             file = new File(resourcesPath, "dataset.json.gz");
//             rows = 2;
//             ingestionProperties = ingestionPropertiesWithColumnMapping;
//             testOnstreamingIngestion = false; // streaming ingestion doesn't support inline mapping
//         }
//     });
// }

// private void assertRowCount(int expectedRowsCount) {
//     KustoOperationResult result = null;
//     int timeoutInSec = 100;
//     int actualRowsCount = 0;

//     while (timeoutInSec > 0) {
//         try {
//             Thread.sleep(5000);
//             timeoutInSec -= 5;

//             result = queryClient.execute(databaseName, String.format("%s | count", tableName));
//         } catch (Exception ex) {
//             continue;
//         }
//         KustoResultSetTable mainTableResult = result.getPrimaryResults();
//         mainTableResult.next();
//         actualRowsCount = mainTableResult.getInt(0) - currentCount;
//         if (actualRowsCount >= expectedRowsCount) {
//             break;
//         }
//     }
//     currentCount += actualRowsCount;
//     assertEquals(expectedRowsCount, actualRowsCount);
// }

// @Test
// void testShowPrincipals() {
//     KustoOperationResult result = null;
//     boolean found = false;
//     try {
//         result = queryClient.execute(databaseName, String.format(".show database %s principals", databaseName));
//     } catch (Exception ex) {
//         Assertions.fail("Failed to execute show database principal command", ex);
//     }
//     KustoResultSetTable mainTableResultSet= result.getPrimaryResults();
//     while (mainTableResultSet.next()){
//         if (mainTableResultSet.getString("PrincipalFQN").equals(principalFqn)) {
//             found = true;
//         }
//     }

//     Assertions.assertTrue(found, "Faile to find authorized AppId in the database principals");
// }

// @Test
// void testIngestFromFile() {
//     for (TestDataItem item : dataForTests) {
//         FileSourceInfo fileSourceInfo = new FileSourceInfo(item.file.getPath(),item.file.length());
//         try {
//             ingestClient.ingestFromFile(fileSourceInfo, item.ingestionProperties);
//         } catch (Exception ex) {
//             Assertions.fail(ex);
//         }
//         assertRowCount(item.rows);
//     }
// }

// @Test
// void testIngestFromStream() throws FileNotFoundException {
//     for (TestDataItem item : dataForTests) {
//         InputStream stream = new FileInputStream(item.file);
//         StreamSourceInfo streamSourceInfo = new StreamSourceInfo(stream);
//         if (item.file.getPath().endsWith(".gz")) {
//             streamSourceInfo.setCompressionType(CompressionType.gz);
//         }
//         try {
//             ingestClient.ingestFromStream(streamSourceInfo, item.ingestionProperties);
//         } catch (Exception ex) {
//             Assertions.fail(ex);
//         }
//         assertRowCount(item.rows);
//     }
// }

// @Test
// void testStramingIngestFromFile() {
//     for (TestDataItem item : dataForTests) {
//         if (item.testOnstreamingIngestion) {
//             FileSourceInfo fileSourceInfo = new FileSourceInfo(item.file.getPath(),item.file.length());
//             try {
//                 streamingIngestClient.ingestFromFile(fileSourceInfo, item.ingestionProperties);
//             } catch (Exception ex) {
//                 Assertions.fail(ex);
//             }
//             assertRowCount(item.rows);
//         }
//     }
// }

// void testStramingIngestFromStream() throws FileNotFoundException {
//     for (TestDataItem item : dataForTests) {
//         if (item.testOnstreamingIngestion) {
//             InputStream stream = new FileInputStream(item.file);
//             StreamSourceInfo streamSourceInfo = new StreamSourceInfo(stream);
//             if (item.file.getPath().endsWith(".gz")) {
//                 streamSourceInfo.setCompressionType(CompressionType.gz);
//             }
//             try {
//                 streamingIngestClient.ingestFromStream(streamSourceInfo, item.ingestionProperties);
//             } catch (Exception ex) {
//                 Assertions.fail(ex);
//             }
//             assertRowCount(item.rows);
//         }
//     }
// }
