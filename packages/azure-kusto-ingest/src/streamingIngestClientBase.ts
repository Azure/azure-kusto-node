// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IngestionPropertiesInput } from "./ingestionProperties";

import { BlobDescriptor } from "./descriptors";
import { AbstractKustoClient } from "./abstractKustoClient";
import { Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";
import { BlobServiceClient } from "@azure/storage-blob";

export abstract class KustoStreamingIngestClientBase extends AbstractKustoClient {
    protected kustoClient: KustoClient;
    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput) {
        super(defaultProps);
        this.kustoClient = new KustoClient(kcsb);
        this.defaultDatabase = this.kustoClient.defaultDatabase;
    }

    async ingestFromBlob(blob: string | BlobDescriptor, ingestionProperties?: IngestionPropertiesInput, clientRequestId?: string): Promise<any> {
        const props = this._getMergedProps(ingestionProperties);
        const descriptor = blob instanceof BlobDescriptor ? blob : new BlobDescriptor(blob);
        // No need to check blob size if it was given to us that it's not empty
        if (descriptor.size === 0) {
            const blobClient = new BlobServiceClient(descriptor.path);
            const blobProps = await blobClient.getProperties();
            const length = parseInt(blobProps._response.headers.get("contentLength") || "0", 10);
            if (length === 0) {
                throw new Error("Empty blob.");
            }
        }

        return await this.kustoClient.executeStreamingIngestFromBlob(
            props.database as string,
            props.table as string,
            descriptor.path,
            props.format,
            props.ingestionMappingReference ?? null,
            clientRequestId
        );
    }

    close() {
        if (!this._isClosed) {
            this.kustoClient.close();
        }
        super.close();
    }
}
