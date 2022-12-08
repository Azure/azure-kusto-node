// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { KustoConnectionStringBuilder } from "azure-kusto-data";

import { BlobDescriptor, StreamDescriptor } from "./descriptors";
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
        if (!(file instanceof Blob) && !((file as FileDescriptor).file instanceof Blob)) {
            throw new Error("Expected object of type Blob");
        }
        const descriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        const extension = descriptor.extension || ingestionProperties?.format || "csv";
        const blob = descriptor.file as Blob;
        const props = this._getMergedProps(ingestionProperties);
        const name = descriptor.name ? `__${descriptor.name}` : "";
        const blobName = `${props.database}__${props.table}__${descriptor.sourceId}${name}.${extension}`;

        const blockBlobClient = await this._getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(blob, { blobHTTPHeaders: { blobContentEncoding: "application/gzip" } } as BlockBlobUploadOptions);
        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url, blob.size, descriptor.sourceId), props);
    }

    async ingestFromStream(stream: StreamDescriptor, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
        const props = this._getMergedProps(ingestionProperties);
        const descriptor: StreamDescriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);
        const blobName =
            `${props.database}__${props.table}__${descriptor.sourceId}` + `${this._getBlobNameSuffix(props.format ?? "", descriptor.compressionType)}`;

        const blockBlobClient = await this._getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(descriptor.stream as ArrayBuffer);

        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url), props); // descriptor.size?
    }
}

export default KustoIngestClient;
