// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// @ts-ignore
import {Client as KustoClient, KustoConnectionStringBuilder} from "azure-kusto-data";

import {BlobDescriptor, CompressionType, FileDescriptor, StreamDescriptor} from "./descriptors";

import ResourceManager from "./resourceManager";

import IngestionBlobInfo from "./ingestionBlobInfo";

import {QueueClient, QueueSendMessageResponse} from "@azure/storage-queue";

import {ContainerClient} from "@azure/storage-blob";
import IngestionProperties from "./ingestionProperties";
import {AbstractKustoClient} from "./abstractKustoClient";
import { Readable } from "stream";


export class KustoIngestClient extends AbstractKustoClient{
    resourceManager: ResourceManager;

    constructor(kcsb: string | KustoConnectionStringBuilder, public defaultProps: IngestionProperties | null = null) {
        super(defaultProps);
        this.resourceManager = new ResourceManager(new KustoClient(kcsb));
    }

    _getBlobNameSuffix(format : string | null, compressionType: CompressionType) {
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

    async ingestFromStream(stream: StreamDescriptor | Readable, ingestionProperties: IngestionProperties): Promise<QueueSendMessageResponse> {
        const props = this._mergeProps(ingestionProperties);
        props.validate();
        const descriptor: StreamDescriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);

        const blobName = `${props.database}__${props.table}__${descriptor.sourceId}` +
            `${this._getBlobNameSuffix(props.format ?? "", descriptor.compressionType)}`;

        const blockBlobClient = await this._getBlockBlobClient(blobName);
        await blockBlobClient.uploadStream(descriptor.stream);

        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url), props); // descriptor.size?
    }

    async ingestFromFile(file: string | FileDescriptor, ingestionProperties: IngestionProperties | null = null): Promise<QueueSendMessageResponse> {
        const props = this._mergeProps(ingestionProperties);
        props.validate();

        const descriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        const fileToUpload = await descriptor.prepare();
        const blobName = `${props.database}__${props.table}__${descriptor.sourceId}__${fileToUpload}`;

        const blockBlobClient = await this._getBlockBlobClient(blobName);
        await blockBlobClient.uploadFile(fileToUpload);

        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url, descriptor.size, descriptor.sourceId), props);
    }

    async ingestFromBlob(blob: string | BlobDescriptor, ingestionProperties: IngestionProperties | null = null) : Promise<QueueSendMessageResponse> {
        const props = this._mergeProps(ingestionProperties);
        props.validate();

        const descriptor = blob instanceof BlobDescriptor ? blob : new BlobDescriptor(blob);
        const queues = await this.resourceManager.getIngestionQueues();
        if (queues == null)
        {
            throw new Error("Failed to get queues");
        }

        const authorizationContext = await this.resourceManager.getAuthorizationContext();

        const queueDetails = queues[Math.floor(Math.random() * queues.length)];

        const queueClient = new QueueClient(queueDetails.getSASConnectionString(), queueDetails.objectName);

        const ingestionBlobInfo = new IngestionBlobInfo(descriptor, props, authorizationContext);
        const ingestionBlobInfoJson = JSON.stringify(ingestionBlobInfo);
        const encoded = Buffer.from(ingestionBlobInfoJson).toString("base64");

        return queueClient.sendMessage(encoded);
    }
}

export default KustoIngestClient;
