// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { KustoConnectionStringBuilder } from "azure-kusto-data";

import { BlobDescriptor, generateBlobName, StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor.browser";

import { IngestionPropertiesInput } from "./ingestionProperties";
import { KustoIngestClientBase } from "./ingestClientBase";
import { IngestionResult } from "./ingestionResult";

export class KustoIngestClient extends KustoIngestClientBase {
    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput, autoCorrectEndpoint?: boolean) {
        super(kcsb, defaultProps, autoCorrectEndpoint, true);
    }

    /**
     * Use string for Node.js and Blob in browser
     */
    async ingestFromFile(file: Blob | FileDescriptor, ingestionProperties?: IngestionPropertiesInput): Promise<IngestionResult> {
        this.ensureOpen();
        const descriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        const blob = descriptor.file as Blob;
        const props = this._getMergedProps(ingestionProperties);

        const fileToUpload = await descriptor.prepare(ingestionProperties);
        const blobName = generateBlobName(descriptor, props);

        const blobUri = await this.uploadToBlobWithRetry(fileToUpload, blobName);

        return this.ingestFromBlob(new BlobDescriptor(blobUri, blob.size, descriptor.sourceId), props);
    }

    /**
     * Use Readable for Node.js and ArrayBuffer in browser
     */
    async ingestFromStream(stream: ArrayBuffer | StreamDescriptor, ingestionProperties?: IngestionPropertiesInput): Promise<IngestionResult> {
        this.ensureOpen();
        const props = this._getMergedProps(ingestionProperties);
        const descriptor: StreamDescriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);
        const blobName = generateBlobName(descriptor, props);
        const blobUri = await this.uploadToBlobWithRetry(descriptor.stream as ArrayBuffer, blobName);
        return this.ingestFromBlob(new BlobDescriptor(blobUri, descriptor.size, descriptor.sourceId), props);
    }
}

export default KustoIngestClient;
