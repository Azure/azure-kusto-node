const IngestClient = require("azure-kusto-ingest").IngestClient;
const IngestStatusQueues = require("azure-kusto-ingest").IngestStatusQueues;
const IngestionProps = require("azure-kusto-ingest").IngestionProperties;
const { ReportLevel, ReportMethod } = require("azure-kusto-ingest").IngestionPropertiesEnums;
const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
const { DataFormat, JsonColumnMapping , IngestionMappingType} = require("azure-kusto-ingest").IngestionPropertiesEnums;
const { BlobDescriptor, StreamDescriptor } = require("azure-kusto-ingest").IngestionDescriptors;
const StreamingIngestClient = require("azure-kusto-ingest").StreamingIngestClient;
const fs = require('fs');

const clusterName = null;
const appId = null;
const appKey = null;
const authorityId = null;

const props = new IngestionProps({
    database: "Database",
    table: "Table",
    format: DataFormat.JSON,
    ingestionMapping : [
        new JsonColumnMapping("TargetColumn1", "$.sourceProp1"),
        new JsonColumnMapping("TargetColumn2", "$.sourceProp2"),
        new JsonColumnMapping("TargetColumn3", "$.sourceProp3")
    ],
    ingestionMappingType: IngestionMappingType.JSON,
    reportLevel: ReportLevel.FailuresAndSuccesses,
    reportMethod: ReportMethod.Queue

});

const ingestClient = new IngestClient(
    KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
        `https://ingest-${clusterName}.kusto.windows.net`, appId, appKey, authorityId
    ),
    props
);

const statusQueues = new IngestStatusQueues(ingestClient);

function waitForFailures() {
    statusQueues.failure.isEmpty((err, empty) => {
        if (err) throw new Error(err);

        if (empty) {
            console.log("no errors...");
            return setTimeout(waitForFailures, 1000);
        }
        else {
            statusQueues.failure.pop((err, failures) => {
                if (err) throw new Error(err);

                for (let failure of failures) {
                    console.log(JSON.stringify(failure));
                }

                return setTimeout(waitForFailures, 1000);
            });
        }
    });
}

function waitForSuccess() {
    statusQueues.success.isEmpty((err, empty) => {
        if (err) throw new Error(err);

        if (empty) {
            console.log("no successes...");
            return setTimeout(waitForSuccess, 1000);
        }
        else {
            statusQueues.success.pop((err, successes) => {
                if (err) throw new Error(err);

                for (let success of successes) {
                    console.log(JSON.stringify(success));
                }

                return setTimeout(waitForSuccess, 1000);
            })
        }
    });
}

console.log("Ingest from file");

ingestClient.ingestFromFile("file.json", null, (err) => {
    if (err) {
        console.log(err);
    }

    console.log("Ingestion done?");


    setTimeout(waitForFailures, 0);
    setTimeout(waitForSuccess, 0);
});

ingestClient.ingestFromBlob(
    new BlobDescriptor("https://<account>.blob.core.windows.net/<container>/file.json.gz", 1024 * 50 /* 50MB file */),
    null,
    (err) => {
        if (err) {
            console.log(err);
        }

        console.log("Ingestion done?");


        setTimeout(waitForFailures, 0);
        setTimeout(waitForSuccess, 0);
    }
);


// Streaming ingest client 

const props2 = new IngestionProps({
    database: "Database",
    table: "Table",
    format: DataFormat.JSON,
    ingestionMappingReference: "Pre-defiend mapping name" // For json format mapping is required
});

// Init with engine endpoint
const streamingIngestClient = new StreamingIngestClient(
    KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
        `https://${clusterName}.kusto.windows.net`, appId, appKey, authorityId
    ),
    props2
);

// Ingest from file with either file path or FileDescriptor
streamingIngestClient.ingestFromFile("file.json", null, (err) => {
    if (err) {
        console.log(err);
    }

    console.log("Ingestion done");
});

// Ingest from stream with either ReadStream or StreamDescriptor
const stream = fs.createReadStream("file.json");

streamingIngestClient.ingestFromStream(stream, null, (err) => {
    if (err) {
        console.log(err);
    }

    console.log("Ingestion done");
});

// For gzip data set StreamDescriptor.isCompressed to true
const stream = fs.createReadStream("file.json.gz");
const streamDescriptor = new StreamDescriptor(stream, "id", true);

streamingIngestClient.ingestFromStream(streamDescriptor, null, (err) => {
    if (err) {
        console.log(err);
    }

    console.log("Ingestion done");
});