// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { KustoConnectionStringBuilder } from "azure-kusto-data";

import { BlobDescriptor, StreamDescriptor } from "./descriptors";
import { FileDescriptor, IngestFromFileProps, IngestFromStreamProps } from "./fileDescriptor";

import { QueueSendMessageResponse } from "@azure/storage-queue";

import { IngestionPropertiesInput } from "./ingestionProperties";
import { KustoIngestClientBase } from "./ingestClientBase";
import pathlib from "path";
import { Readable } from "stream";

export class KustoIngestClient extends KustoIngestClientBase {
    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput) {
        super(kcsb, defaultProps);
    }

    async ingestFromFile(file: IngestFromFileProps, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
        this.ensureOpen();
        const props = this._getMergedProps(ingestionProperties);

        const descriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        try {
            const fileToUpload = await descriptor.prepare();
            const blobName = `${props.database}__${props.table}__${descriptor.sourceId}__${descriptor.name}__.${pathlib.extname(fileToUpload)}`;

            const blockBlobClient = await this.resourceManager.getBlockBlobClient(blobName);
            await blockBlobClient.uploadFile(fileToUpload);
            return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url, descriptor.size, descriptor.sourceId), props);
        } finally {
            await descriptor.cleanup();
        }
    }

    async ingestFromStream(stream: IngestFromStreamProps, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
        this.ensureOpen();
        const props = this._getMergedProps(ingestionProperties);
        const descriptor: StreamDescriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);

        const blobName =
            `${props.database}__${props.table}__${descriptor.sourceId}` + `${this._getBlobNameSuffix(props.format ?? "", descriptor.compressionType)}`;

        const blockBlobClient = await this.resourceManager.getBlockBlobClient(blobName);
        await blockBlobClient.uploadStream(descriptor.stream as Readable);

        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url), props); // descriptor.size?
    }
}

export default KustoIngestClient;
