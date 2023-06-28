// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const IngestClient = require("azure-kusto-ingest").IngestClient;
const IngestStatusQueues = require("azure-kusto-ingest").IngestStatusQueues;
const IngestionProps = require("azure-kusto-ingest").IngestionProperties;
const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
const { DataFormat, JsonColumnMapping, IngestionMappingKind, CompressionType, ReportLevel, ReportMethod } = require("azure-kusto-ingest");
const { BlobDescriptor, StreamDescriptor } = require("azure-kusto-ingest").IngestionDescriptors;
const StreamingIngestClient = require("azure-kusto-ingest").StreamingIngestClient;
const fs = require("fs");

const clusterName = null;
const appId = null;
const appKey = null;
const authorityId = null;

const props = new IngestionProps({
    database: "Database",
    table: "Table",
    format: DataFormat.JSON,
    ingestionMapping: [
        JsonColumnMapping.withPath("TargetColumn1", "$.sourceProp1"),
        JsonColumnMapping.withPath("TargetColumn2", "$.sourceProp2"),
        JsonColumnMapping.withPath("TargetColumn3", "$.sourceProp3"),
    ],
    ingestionMappingType: IngestionMappingKind.JSON,
    reportLevel: ReportLevel.FailuresAndSuccesses,
    reportMethod: ReportMethod.Queue,
});

// After using the client, you should use `close()` to free up resources
const ingestClient = new IngestClient(
    KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://ingest-${clusterName}.kusto.windows.net`, appId, appKey, authorityId),
    props
);

const statusQueues = new IngestStatusQueues(ingestClient);

startIngestion();

// Streaming ingest client
const props2 = new IngestionProps({
    database: "Database",
    table: "Table",
    format: DataFormat.JSON,
    ingestionMappingReference: "Pre-defined mapping name",
});

// Init with engine endpoint
const streamingIngestClient = new StreamingIngestClient(
    KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://${clusterName}.kusto.windows.net`, appId, appKey, authorityId),
    props2
);

startStreamingIngestion();

async function startIngestion() {
    console.log("Ingest from file");
    try {
        await ingestClient.ingestFromFile("file.json");
        console.log("Ingestion done?");

        await waitForStatus();
    } catch (err) {
        console.log(err);
    }

    try {
        await ingestClient.ingestFromBlob(new BlobDescriptor("https://<account>.blob.core.windows.net/<container>/file.json.gz", 1024 * 50 /* 50MB file */));
        console.log("Ingestion done?");

        await waitForStatus();
    } catch (err) {
        console.log(err);
    }
}

async function waitForStatus(numberOFIngestions = 1) {
    while ((await statusQueues.failure.isEmpty()) && (await statusQueues.success.isEmpty())) {
        console.log("Waiting for status...");
        await sleep(1000);
    }

    const failures = await statusQueues.failure.pop(numberOFIngestions);
    for (let failure of failures) {
        console.log(`Failed: ${JSON.stringify(failure)}`);
    }
    const successes = await statusQueues.success.pop(numberOFIngestions);
    for (let success of successes) {
        console.log(`Succeeded: ${JSON.stringify(success)}`);
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function startStreamingIngestion() {
    // Ingest from file with either file path or FileDescriptor
    try {
        await streamingIngestClient.ingestFromFile("file.json", props2);
        console.log("Ingestion done");
    } catch (err) {
        console.log(err);
    }

    // Ingest from stream with either ReadStream or StreamDescriptor
    let stream = fs.createReadStream("file.json");
    try {
        await streamingIngestClient.ingestFromStream(stream, props2);
        console.log("Ingestion done");
    } catch (err) {
        console.log(err);
    }

    // For gzip data set StreamDescriptor.compressionType to CompressionType.GZIP
    stream = fs.createReadStream("file.json.gz");
    const streamDescriptor = new StreamDescriptor(stream, "id", CompressionType.GZIP);
    try {
        await streamingIngestClient.ingestFromStream(streamDescriptor, props2);
        console.log("Ingestion done");
    } catch (err) {
        console.log(err);
    }
}
