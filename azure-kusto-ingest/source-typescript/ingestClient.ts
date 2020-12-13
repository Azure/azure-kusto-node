// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// @ts-ignore
import {Client as KustoClient} from "azure-kusto-data";

import {BlobDescriptor, CompressionType, FileDescriptor, StreamDescriptor} from "./descriptors";

import ResourceManager from "./resourceManager";

import IngestionBlobInfo from "./ingestionBlobInfo";

import {QueueClient} from "@azure/storage-queue";

import {ContainerClient} from "@azure/storage-blob";
import IngestionProperties from "./ingestionProperties";
import {ReadStream} from "fs";


export class KustoIngestClient {
    resourceManager: ResourceManager;

    constructor(kcsb: string, public defaultProps: IngestionProperties | null) {
        this.resourceManager = new ResourceManager(new KustoClient(kcsb));
        this.defaultProps = defaultProps;
    }

    _mergeProps(newProperties: IngestionProperties | null): IngestionProperties { //todo ts
        // no default props
        if (newProperties == null || Object.keys(newProperties).length == 0) {
            return <IngestionProperties>this.defaultProps;
        }

        // no new props
        if (this.defaultProps == null || Object.keys(this.defaultProps).length == 0) {
            return <IngestionProperties>newProperties;
        }
        // both exist - merge
        return this.defaultProps.merge(newProperties);
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

    async ingestFromStream(stream: ReadStream | StreamDescriptor, ingestionProperties: IngestionProperties) {
        const props = this._mergeProps(ingestionProperties);
        props.validate();

        const descriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);

        const blobName = `${props.database}__${props.table}__${descriptor.sourceId}` +
            `${this._getBlobNameSuffix(props.format, descriptor.compressionType)}`;

        const blockBlobClient = await this._getBlockBlobClient(blobName);
        await blockBlobClient.uploadStream(descriptor.stream);

        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url), props); // descriptor.size?
    }

    async ingestFromFile(file: string | FileDescriptor, ingestionProperties: IngestionProperties | null) {
        const props = this._mergeProps(ingestionProperties);
        props.validate();

        const descriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        const fileToUpload = await descriptor.prepare();
        const blobName = `${props.database}__${props.table}__${descriptor.sourceId}__${fileToUpload}`;

        const blockBlobClient = await this._getBlockBlobClient(blobName);
        await blockBlobClient.uploadFile(fileToUpload);

        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url, descriptor.size, descriptor.sourceId), props);
    }

    async ingestFromBlob(blob: string | BlobDescriptor, ingestionProperties: IngestionProperties | null) {
        const props = this._mergeProps(ingestionProperties);
        props.validate();

        const descriptor = blob instanceof BlobDescriptor ? blob : new BlobDescriptor(blob);
        let queues = await this.resourceManager.getIngestionQueues();
        let authorizationContext = await this.resourceManager.getAuthorizationContext();

        if (queues == null)
        {
            throw new Error("Failed to get queues");
        }

        const queueDetails = queues[Math.floor(Math.random() * queues.length)];

        const queueClient = new QueueClient(queueDetails.getSASConnectionString(), queueDetails.objectName);

        const ingestionBlobInfo = new IngestionBlobInfo(descriptor, props, authorizationContext);
        const ingestionBlobInfoJson = JSON.stringify(ingestionBlobInfo);
        const encoded = Buffer.from(ingestionBlobInfoJson).toString("base64");

        return queueClient.sendMessage(encoded);
    }
}

export default KustoIngestClient;
