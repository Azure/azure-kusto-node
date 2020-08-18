// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const KustoClient = require("azure-kusto-data").Client;
const { FileDescriptor, BlobDescriptor, StreamDescriptor } = require("./descriptors");
const { ResourceManager } = require("./resourceManager");
const IngestionBlobInfo = require("./ingestionBlobInfo");
const { QueueClient } = require("@azure/storage-queue");
const { ContainerClient } = require("@azure/storage-blob");

module.exports = class KustoIngestClient {
    constructor(kcsb, defaultProps) {
        this.resourceManager = new ResourceManager(new KustoClient(kcsb));
        this.defaultProps = defaultProps;
    }

    _mergeProps(newProperties) {
        // no default props
        if (newProperties == null || Object.keys(newProperties).length == 0) {
            return this.defaultProps;
        }

        // no new props
        if (this.defaultProps == null || Object.keys(this.defaultProps) == 0) {
            return newProperties;
        }
        // both exist - merge
        return this.defaultProps.merge(newProperties);
    }

    _getBlobNameSuffix(format, compressionType) {
        const formatSuffix = format ? `.${format}` : "";
        return `${formatSuffix}${compressionType}`;
    }

    async _getBlockBlobClient(blobName){
        const containers = await this.resourceManager.getRandomContainer();
        const container = containers[Math.floor(Math.random() * containers.length)];
        const containerClient = new ContainerClient(container.getSASConnectionString(), container.objectName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        return blockBlobClient;
    }

    async ingestFromStream(stream, ingestionProperties) {
        const props = this._mergeProps(ingestionProperties);
        props.validate();

        const descriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);

        const blobName = `${props.database}__${props.table}__${descriptor.sourceId}` +
            `${this._getBlobNameSuffix(props.format, descriptor.compressionType)}`;

        const blockBlobClient = await _getBlockBlobClient(blobName);
        await blockBlobClient.uploadStream(descriptor.stream);

        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url), props); // descriptor.size?
    }

    async ingestFromFile(file, ingestionProperties) {
        const props = this._mergeProps(ingestionProperties);
        props.validate();

        const descriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        const fileToUpload = descriptor.prepare();
        const blobName = `${props.database}__${props.table}__${descriptor.sourceId}__${fileToUpload}`;

        const blockBlobClient = await _getBlockBlobClient(blobName);
        await blockBlobClient.uploadFile(fileToUpload, descriptor.size);

        return this.ingestFromBlob(new BlobDescriptor(blockBlobClient.url, descriptor.size, descriptor.sourceId), props);
    }

    async ingestFromBlob(blob, ingestionProperties) {
        const props = this._mergeProps(ingestionProperties);
        props.validate();

        const descriptor = blob instanceof BlobDescriptor ? blob : new BlobDescriptor(blob);
        let queues = await this.resourceManager.getIngestionQueues();
        let authorizationContext = await this.resourceManager.getAuthorizationContext();

        const queueDetails = queues[Math.floor(Math.random() * queues.length)];

        const queueClient = new QueueClient(queueDetails.getSASConnectionString(), queueDetails.objectName);

        const ingestionBlobInfo = new IngestionBlobInfo(descriptor, props, authorizationContext);
        const ingestionBlobInfoJson = JSON.stringify(ingestionBlobInfo);
        const encoded = Buffer.from(ingestionBlobInfoJson).toString("base64");

        return queueClient.sendMessage(encoded);
    }
};
