// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { KustoConnectionStringBuilder } from "azure-kusto-data";

import { BlobDescriptor, generateBlobName, StreamDescriptor } from "./descriptors.js";
import { FileDescriptor } from "./fileDescriptor.js";

import type { IngestionPropertiesInput } from "./ingestionProperties.js";
import { KustoIngestClientBase } from "./ingestClientBase.js";
import type { Readable } from "stream";
import type { IngestionResult } from "./ingestionResult.js";

export class KustoIngestClient extends KustoIngestClientBase {
    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput, autoCorrectEndpoint?: boolean) {
        super(kcsb, defaultProps, autoCorrectEndpoint);
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
            const fileToUpload = await descriptor.prepare(ingestionProperties);
            const blobUri = await this.uploadToBlobWithRetry(fileToUpload, blobName);
            return this.ingestFromBlob(new BlobDescriptor(blobUri, descriptor.size, descriptor.sourceId), props);
        } finally {
            await descriptor.cleanup();
        }
    }

    /**
     * Use Readable in Node.JS and ArrayBuffer in browser
     */
    async ingestFromStream(stream: StreamDescriptor | Readable | ArrayBuffer, ingestionProperties?: IngestionPropertiesInput): Promise<IngestionResult> {
        this.ensureOpen();
        const props = this._getMergedProps(ingestionProperties);
        const descriptor: StreamDescriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);
        // TODO we don't gzip on stream here, just ont streamingIngestClient
        const blobName = generateBlobName(descriptor, props);

        const blobUri = await this.uploadToBlobWithRetry(descriptor, blobName);

        return this.ingestFromBlob(new BlobDescriptor(blobUri), props); // descriptor.size?
    }
}

export default KustoIngestClient;
