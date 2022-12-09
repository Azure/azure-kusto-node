// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";

import { BlobDescriptor, CompressionType } from "./descriptors";

import ResourceManager from "./resourceManager";

import IngestionBlobInfo from "./ingestionBlobInfo";

import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";

import { ContainerClient } from "@azure/storage-blob";
import { IngestionPropertiesInput } from "./ingestionProperties";
import { AbstractKustoClient } from "./abstractKustoClient";

export abstract class KustoIngestClientBase extends AbstractKustoClient {
    resourceManager: ResourceManager;

    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput, isBrowser?: boolean) {
        super(defaultProps);
        const kustoClient = new KustoClient(kcsb);
        this.resourceManager = new ResourceManager(kustoClient, isBrowser);
        this.defaultDatabase = kustoClient.defaultDatabase;
    }

    _getBlobNameSuffix(format: string | null, compressionType: CompressionType) {
        const formatSuffix = format ? `.${format}` : "";
        return `${formatSuffix}${compressionType}`;
    }

    async _getBlockBlobClient(blobName: string) {
        const containers = await this.resourceManager.getContainers();
        if (containers == null) {
            throw new Error("Failed to get containers");
        }
        const container = containers[Math.floor(Math.random() * containers.length)];
        const containerClient = new ContainerClient(container.uri);
        return containerClient.getBlockBlobClient(blobName);
    }

    async ingestFromBlob(blob: string | BlobDescriptor, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
        this.ensureOpen();

        const props = this._getMergedProps(ingestionProperties);

        const descriptor = blob instanceof BlobDescriptor ? blob : new BlobDescriptor(blob);
        const queues = await this.resourceManager.getIngestionQueues();
        if (queues == null) {
            throw new Error("Failed to get queues");
        }

        const authorizationContext = await this.resourceManager.getAuthorizationContext();

        const queueDetails = queues[Math.floor(Math.random() * queues.length)];

        const queueClient = new QueueClient(queueDetails.uri);

        const ingestionBlobInfo = new IngestionBlobInfo(descriptor, props, authorizationContext);
        const ingestionBlobInfoJson = JSON.stringify(ingestionBlobInfo);
        const encoded = Buffer.from(ingestionBlobInfoJson).toString("base64");

        return queueClient.sendMessage(encoded);
    }

    close() {
        if (!this._isClosed) {
            this.resourceManager.close();
        }
        super.close();
    }
}

export default KustoIngestClientBase;
