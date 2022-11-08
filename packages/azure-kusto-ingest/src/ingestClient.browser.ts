// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { KustoConnectionStringBuilder } from "azure-kusto-data";

import { BlobDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor";
import { QueueSendMessageResponse } from "@azure/storage-queue";

import { IngestionPropertiesInput } from "./ingestionProperties";
import { KustoIngestClientBase } from "./ingestClientBase";
import { BlockBlobUploadOptions } from "@azure/storage-blob";

export class KustoIngestClient extends KustoIngestClientBase {
    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput) {
        super(kcsb, defaultProps, true);
    }

    // TODO: Should we create a new method called ingestFromBrowserFile?
    async ingestFromFile(file: string | FileDescriptor | Blob, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
        if (!(file instanceof Blob)) {
            throw new Error("Expected object of type Blob")
        }
        const descriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        const extension = descriptor.extension || ingestionProperties?.format || "csv";
        const blob = file as Blob;
        const props = this._getMergedProps(ingestionProperties);
        const name = descriptor.name ? `__${descriptor.name}` : "";
        const blobName = `${props.database}__${props.table}__${descriptor.sourceId}${name}__.${extension}`;

        const blockBlobClient = await this._getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(file, { blobHTTPHeaders: {blobContentEncoding: "application/gzip"}} as BlockBlobUploadOptions );
        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url, blob.size, descriptor.sourceId), props);
    }
}

export default KustoIngestClient;
