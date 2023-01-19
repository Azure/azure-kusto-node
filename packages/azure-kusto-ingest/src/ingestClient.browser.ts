// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { KustoConnectionStringBuilder } from "azure-kusto-data";

import { BlobDescriptor, StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor.browser";
import { QueueSendMessageResponse } from "@azure/storage-queue";

import { IngestionPropertiesInput } from "./ingestionProperties";
import { KustoIngestClientBase } from "./ingestClientBase";

export class KustoIngestClient extends KustoIngestClientBase {
    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput) {
        super(kcsb, defaultProps, true);
    }

    /**
     * Use string for Node.js and Blob in browser
     */
    async ingestFromFile(file: Blob | FileDescriptor, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
        this.ensureOpen();
        const descriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        const extension = descriptor.extension || ingestionProperties?.format || "csv";
        const blob = descriptor.file as Blob;
        const props = this._getMergedProps(ingestionProperties);
        const name = descriptor.name ? `__${descriptor.name}` : "";
        const blobName = `${props.database}__${props.table}__${descriptor.sourceId}${name}.${extension}`;
        const blockBlobClient = await this.resourceManager.getBlockBlobClient(blobName);

        const fileToUpload = await descriptor.prepare();
        await blockBlobClient.uploadData(fileToUpload);
        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url, blob.size, descriptor.sourceId), props);
    }

    /**
     * Use Readable for Node.js and ArrayBuffer in browser
     */
    async ingestFromStream(stream: ArrayBuffer | StreamDescriptor, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
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
