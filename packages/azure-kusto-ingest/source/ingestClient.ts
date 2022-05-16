// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";

import { BlobDescriptor, CompressionType, FileDescriptor, StreamDescriptor } from "./descriptors";

import ResourceManager from "./resourceManager";

import IngestionBlobInfo from "./ingestionBlobInfo";

import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";

import { ContainerClient } from "@azure/storage-blob";
import { IngestionPropertiesInput } from "./ingestionProperties";
import { AbstractKustoClient } from "./abstractKustoClient";
import { Readable } from "stream";
import pathlib from "path";

export class KustoIngestClient extends AbstractKustoClient {
    resourceManager: ResourceManager;

    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput) {
        super(defaultProps);
        const kustoClient = new KustoClient(kcsb);
        this.resourceManager = new ResourceManager(kustoClient);
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
        const containerClient = new ContainerClient(container.getSASConnectionString(), container.objectName);
        return containerClient.getBlockBlobClient(blobName);
    }

    async ingestFromStream(stream: StreamDescriptor | Readable, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
        const props = this._getMergedProps(ingestionProperties);
        const descriptor: StreamDescriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);

        const blobName =
            `${props.database}__${props.table}__${descriptor.sourceId}` + `${this._getBlobNameSuffix(props.format ?? "", descriptor.compressionType)}`;

        const blockBlobClient = await this._getBlockBlobClient(blobName);
        await blockBlobClient.uploadStream(descriptor.stream);

        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url), props); // descriptor.size?
    }

    async ingestFromFile(file: string | FileDescriptor, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
        const props = this._getMergedProps(ingestionProperties);

        const descriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        try {
            const fileToUpload = await descriptor.prepare();
            const blobName = `${props.database}__${props.table}__${descriptor.sourceId}__${descriptor.name}__.${pathlib.extname(fileToUpload)}`;

            const blockBlobClient = await this._getBlockBlobClient(blobName);
            // eslint-disable-next-line no-console
            console.log("a");
            await blockBlobClient.uploadFile(fileToUpload);
            // eslint-disable-next-line no-console
            console.log("b");
            return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url, descriptor.size, descriptor.sourceId), props);
        } finally {
            // eslint-disable-next-line no-console
            console.log("c");
            await descriptor.cleanup();
            // eslint-disable-next-line no-console
            console.log("d");
        }
    }

    async ingestFromBlob(blob: string | BlobDescriptor, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
        // eslint-disable-next-line no-console
        console.log("e");
        const props = this._getMergedProps(ingestionProperties);
        // eslint-disable-next-line no-console
        console.log("f");
        const descriptor = blob instanceof BlobDescriptor ? blob : new BlobDescriptor(blob);
        // eslint-disable-next-line no-console
        console.log("g");
        const queues = await this.resourceManager.getIngestionQueues();
        // eslint-disable-next-line no-console
        console.log("h");
        if (queues == null) {
            throw new Error("Failed to get queues");
        }
        // eslint-disable-next-line no-console
        console.log("i");

        const authorizationContext = await this.resourceManager.getAuthorizationContext();
        // eslint-disable-next-line no-console
        console.log("j");
        const queueDetails = queues[Math.floor(Math.random() * queues.length)];
        // eslint-disable-next-line no-console
        console.log("k");
        const queueClient = new QueueClient(queueDetails.getSASConnectionString(), queueDetails.objectName);
        // eslint-disable-next-line no-console
        console.log("l");
        const ingestionBlobInfo = new IngestionBlobInfo(descriptor, props, authorizationContext);
        // eslint-disable-next-line no-console
        console.log("m");
        const ingestionBlobInfoJson = JSON.stringify(ingestionBlobInfo);
        // eslint-disable-next-line no-console
        console.log("n");
        const encoded = Buffer.from(ingestionBlobInfoJson).toString("base64");
        // eslint-disable-next-line no-console
        console.log("p");

        return queueClient.sendMessage(encoded);
    }
}

export default KustoIngestClient;
