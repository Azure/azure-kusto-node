const KustoClient = require("azure-kusto-data").Client;
const { FileDescriptor, BlobDescriptor, StreamDescriptor } = require("./descriptors");
const { ResourceManager } = require("./resourceManager");
const IngestionBlobInfo = require("./ingestionBlobInfo");
const azureStorage = require("azure-storage");

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

    ingestFromStream(stream, ingestionProperties, callback) {
        const props = this._mergeProps(ingestionProperties);

        try {
            props.validate();
        } catch (e) {
            return callback(e);
        }

        const descriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);

        return this.resourceManager.getContainers((err, containers) => {
            if (err) return callback(err);

            const containerDetails = containers[Math.floor(Math.random() * containers.length)];
            const blobService = azureStorage.createBlobServiceWithSas(
                containerDetails.toURI({ withSas: false, withObjectName: false }),
                containerDetails.sas
            );

            const blobName = `${props.database}__${props.table}__${descriptor.sourceId}${this._getBlobNameSuffix(props.format, descriptor.compressionType)}`;

            const writeStream = blobService.createWriteStreamToBlockBlob(containerDetails.objectName, blobName, (err) => {
                if (err) return callback(err);

                const blobUri = `${containerDetails.toURI({ withSas: false })}/${blobName}?${containerDetails.sas}`;
                return this.ingestFromBlob(new BlobDescriptor(blobUri, descriptor.size), props, callback);
            });

            descriptor.pipe(writeStream);
        });
    }

    ingestFromFile(file, ingestionProperties, callback) {
        const props = this._mergeProps(ingestionProperties);

        try {
            props.validate();
        } catch (e) {
            return callback(e);
        }

        const descriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        return descriptor.prepare((err, fileToUpload) => {
            if (err) return callback(err);

            const blobName = `${props.database}__${props.table}__${descriptor.sourceId}__${fileToUpload}`;

            this.resourceManager.getContainers((err, containers) => {
                if (err) return callback(err);
                const containerDetails = containers[Math.floor(Math.random() * containers.length)];
                const blobService = azureStorage.createBlobServiceWithSas(containerDetails.toURI({
                    withObjectName: false,
                    withSas: false
                }), containerDetails.sas);

                blobService.createBlockBlobFromLocalFile(containerDetails.objectName, blobName, fileToUpload, (err) => {
                    if (err) return callback(err);
                    const blobUri = `${containerDetails.toURI({ withSas: false })}/${blobName}?${containerDetails.sas}`;
                    return this.ingestFromBlob(new BlobDescriptor(blobUri, descriptor.size, descriptor.sourceId), props, callback);
                });
            });

        });
    }

    ingestFromBlob(blob, ingestionProperties, callback) {
        const props = this._mergeProps(ingestionProperties);

        try {
            props.validate();
        } catch (e) {
            return callback(e);
        }

        const descriptor = blob instanceof BlobDescriptor ? blob : new BlobDescriptor(blob);

        return this.resourceManager.getIngestionQueues((err, queues) => {
            if (err) return callback(err);

            return this.resourceManager.getAuthorizationContext((err, authorizationContext) => {
                if (err) return callback(err);

                const queueDetails = queues[Math.floor(Math.random() * queues.length)];
                const queueService = azureStorage.createQueueServiceWithSas(queueDetails.toURI({
                    withSas: false,
                    withObjectName: false
                }), queueDetails.sas);
                const ingestionBlobInfo = new IngestionBlobInfo(descriptor, props, authorizationContext);
                const ingestionBlobInfoJson = JSON.stringify(ingestionBlobInfo);
                const encoded = Buffer.from(ingestionBlobInfoJson).toString("base64");

                queueService.createMessage(queueDetails.objectName, encoded, (err) => {
                    return callback(err);
                });
            });
        });
    }
};
