// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { KustoConnectionStringBuilder } from "azure-kusto-data";

import { BlobDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor";

import { QueueSendMessageResponse } from "@azure/storage-queue";

import { IngestionPropertiesInput } from "./ingestionProperties";
import { KustoIngestClientBase } from "./ingestClientBase";
import pathlib from "path";

export class KustoIngestClient extends KustoIngestClientBase {
    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput) {
        super(kcsb, defaultProps);
    }

    async ingestFromFile(file: string | FileDescriptor, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
        const props = this._getMergedProps(ingestionProperties);

        const descriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        try {
            const fileToUpload = await descriptor.prepare();
            const blobName = `${props.database}__${props.table}__${descriptor.sourceId}__${descriptor.name}__.${pathlib.extname(fileToUpload)}`;

            const blockBlobClient = await this._getBlockBlobClient(blobName);
            await blockBlobClient.uploadFile(fileToUpload);
            return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url, descriptor.size, descriptor.sourceId), props);
        } finally {
            await descriptor.cleanup();
        }
    }
}

export default KustoIngestClient;
