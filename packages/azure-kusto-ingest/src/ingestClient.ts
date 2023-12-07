// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { KustoConnectionStringBuilder } from "azure-kusto-data";

import { BlobDescriptor, generateBlobName, StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor";

import { IngestionPropertiesInput } from "./ingestionProperties";
import { KustoIngestClientBase } from "./ingestClientBase";
import { Readable } from "stream";
import { IngestionResult } from "./ingestionResult";

export class KustoIngestClient extends KustoIngestClientBase {
    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput) {
        super(kcsb, defaultProps);
    }

    /**
     * Use string in Node.JS and Blob in browser
     */
    async ingestFromFile(file: FileDescriptor | string | Blob, ingestionProperties?: IngestionPropertiesInput): Promise<IngestionResult> {
        this.ensureOpen();
        const props = this._getMergedProps(ingestionProperties);

        const descriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        try {
            const blobName = generateBlobName(descriptor, props);
            const [fileToUpload, blockBlobClient] = await Promise.all([descriptor.prepare(), this.resourceManager.getBlockBlobClient(blobName)]);
            await blockBlobClient.uploadFile(fileToUpload);
            return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url, descriptor.size, descriptor.sourceId), props);
        } finally {
            await descriptor.cleanup();
        }
    }

    /**
     * Use Readable in Node.JS and ArrayBuffer in browser
     */
    async ingestFromStream(
        stream: StreamDescriptor | Readable | ArrayBuffer,
        ingestionProperties?: IngestionPropertiesInput
    ): Promise<IngestionResult> {
        this.ensureOpen();
        const props = this._getMergedProps(ingestionProperties);
        const descriptor: StreamDescriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);

        const blobName = generateBlobName(descriptor, props);

        const blockBlobClient = await this.resourceManager.getBlockBlobClient(blobName);
        if (descriptor.stream instanceof Buffer) {
            await blockBlobClient.uploadData(descriptor.stream as Buffer);
        } else {
            await blockBlobClient.uploadStream(descriptor.stream as Readable);
        }

        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url), props); // descriptor.size?
    }
}

export default KustoIngestClient;
