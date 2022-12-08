// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable no-console */

/* THIS SAMPLE IS FOR BROWSERS */
// Usage: import main into your code, or this package (azure-kusto-ingest) index.ts for example.
// This example uses the browser auth: 'withUserPrompt' which uses @azure/identity InteractiveBrowserCredential
// The authentication app id should have consent to Kusto and allow the redirectUri specified. See: https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/identity/identity/test/manual/interactive-browser-credential
// Other authentication methods for browsers are 'withTokenProvider', 'withAccessToken' where the user provides the token himself.
// Notice that ingestFromBlob refers to azure blob as opposed to ingest from file which accepts a JS Blob object.
// If you are using an existing table the table will be added two new columns: Name:string, Value: int

import { KustoConnectionStringBuilder, Client as KustoClient } from "azure-kusto-data";
import { DataFormat, IngestClient, IngestionDescriptors, IngestionProperties } from "azure-kusto-ingest";

const database = "<databaseName>";
const table = "<tableName>";
const clusterName = "<clusterName>.<region>";
const appId = "<aadAppId>"; // Read above regarding which app to use

const authorityId = undefined;
const redirectUri = undefined;

export const main = async (): Promise<void> => {
    const interactiveBrowserAuthOptions = {
        tenantId: authorityId ?? "72f988bf-86f1-41af-91ab-2d7cd011db47",
        clientId: appId,
        redirectUri: redirectUri ?? "http://localhost:3000",
    };
    const kcsb = KustoConnectionStringBuilder.withUserPrompt(`https://${clusterName}.dev.kusto.windows.net`, interactiveBrowserAuthOptions);
    const queryClient = new KustoClient(kcsb);
    const kcsbIng = KustoConnectionStringBuilder.withUserPrompt(`https://ingest-${clusterName}.dev.kusto.windows.net`, interactiveBrowserAuthOptions);

    const ingestClient = new IngestClient(kcsbIng);

    try {
        await queryClient.execute(database, `.create-merge table ${table}(Name:string, Value:int)`);
    } catch (e) {
        console.log(`Failed creating table: ${e}`);
        throw e;
    }

    try {
        // Stream can be either ArrayBuffer or ArrayBufferView
        const stream = await new Blob([`{"Name":"Ohad", "Value":1}`], { type: "application/json" }).arrayBuffer();
        const props = new IngestionProperties({ database, table, format: DataFormat.JSON });
        const desp = new IngestionDescriptors.StreamDescriptor(stream);
        await ingestClient.ingestFromStream(desp, props);
    } catch (e) {
        console.log(`Failed ingesting ArrayBuffer: ${e}`);
    }

    try {
        // File has to be a Blob object
        const file = new Blob([`{"Name":"Moshe", "Value":2}`], { type: "application/json" });
        const props = new IngestionProperties({ database, table, format: DataFormat.JSON });
        const desp = new IngestionDescriptors.FileDescriptor(file);
        await ingestClient.ingestFromFile(desp, props);
    } catch (e) {
        console.log(`Failed ingesting from a Blob object: ${e}`);
    }

    try {
        // File has to be a Blob object
        const blob = "https://<account>.blob.core.windows.net/<container>/file.json.gz";
        const props = new IngestionProperties({ database, table, format: DataFormat.JSON });
        const desp = new IngestionDescriptors.BlobDescriptor(blob, 1024 * 50 /* 50MB file */);
        await ingestClient.ingestFromBlob(desp, props);
    } catch (e) {
        console.log(`Failed ingesting from azure blob: ${e}`);
    }
};
