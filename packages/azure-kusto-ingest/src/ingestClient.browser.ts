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

    /**
     * Use string for Node.js and Blob for browser
     */
    async ingestFromFile(file: FileDescriptor | Blob | string, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
        this.ensureOpen();
        if (!(file instanceof Blob) && !((file as FileDescriptor).file instanceof Blob)) {
            throw new Error("Expected object of type Blob");
        }
        const descriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        const extension = descriptor.extension || ingestionProperties?.format || "csv";
        const blob = descriptor.file as Blob;
        const props = this._getMergedProps(ingestionProperties);
        const name = descriptor.name ? `__${descriptor.name}` : "";
        const blobName = `${props.database}__${props.table}__${descriptor.sourceId}${name}.${extension}`;

        const blockBlobClient = await this.resourceManager.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(blob, { blobHTTPHeaders: { blobContentEncoding: "application/gzip" } } as BlockBlobUploadOptions);
        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url, blob.size, descriptor.sourceId), props);
    }

    /**
     * Use Readable for Node.js and ArrayBuffer for browser
     */
    async ingestFromStream(stream: StreamDescriptor | ArrayBuffer, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
        this.ensureOpen();
        const props = this._getMergedProps(ingestionProperties);
        const descriptor: StreamDescriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);
        const blobName =
            `${props.database}__${props.table}__${descriptor.sourceId}` + `${this._getBlobNameSuffix(props.format ?? "", descriptor.compressionType)}`;

        const blockBlobClient = await this.resourceManager.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(descriptor.stream as ArrayBuffer);

        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url), props); // descriptor.size?
    }
}

export default KustoIngestClient;
