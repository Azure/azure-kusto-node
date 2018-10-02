# Microsoft Azure Kusto Data Library for Node

# Quick Start

```javascript 
const IngestClient = require("azure-kusto-ingest").IngestClient;
const IngestionProps = require("azure-kusto-ingest").IngestionProperties;
const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
const { DataFormat, JsonColumnMapping } = require("azure-kusto-ingest").IngestionPropertiesEnums;

const ingestClient = new IngestClient(
    KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://ingest-${cluster}.kusto.windows.net`, appId, appKey, tenantId),
    new IngestionProps(
        "Database",
        "Table",
        DataFormat.json,
        [
            new JsonColumnMapping("TargetColumn1", "$.sourceProp1"),
            new JsonColumnMapping("TargetColumn2", "$.sourceProp2"),
            new JsonColumnMapping("TargetColumn3", "$.sourceProp3")
        ])
);
    
console.log("Ingest from file");

ingestClient.ingestFromFile("file.json", null, (err) => {
    if (err) {
        console.log(err);
    }

    console.log("Ingestion done");
});

```