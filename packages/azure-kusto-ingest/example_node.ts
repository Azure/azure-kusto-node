// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {IngestClient,IngestStatusQueues,IngestionProperties, DataFormat, JsonColumnMapping, IngestionMappingKind, ReportLevel, ReportMethod, StreamingIngestClient,} from "azure-kusto-ingest";
import {KustoConnectionStringBuilder} from "azure-kusto-data";

import * as fs from "fs";
import { BlobDescriptor, CompressionType, StreamDescriptor } from "./types/src/descriptors";

const clusterName = "";
const appId = "";
const appKey ="";
const authorityId = "microsoft.com";

const props = new IngestionProperties({
    database: "Database",
    table: "Table",
    format: DataFormat.JSON,
    ingestionMapping: [
        new JsonColumnMapping("TargetColumn1", "$.sourceProp1"),
        new JsonColumnMapping("TargetColumn2", "$.sourceProp2"),
        new JsonColumnMapping("TargetColumn3", "$.sourceProp3"),
    ],
    ingestionMappingType: IngestionMappingKind.JSON,
    reportLevel: ReportLevel.FailuresAndSuccesses,
    reportMethod: ReportMethod.Queue,
});

const ingestClient = new IngestClient(
    KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://ingest-${clusterName}.kusto.windows.net`, appId, appKey, authorityId),
    props
);

const statusQueues = new IngestStatusQueues(ingestClient);

startIngestion();

// Streaming ingest client
const props2 = new IngestionProperties({
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

function sleep(ms: number) {
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
