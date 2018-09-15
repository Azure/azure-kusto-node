const KustoClient = require("kusto-data");
const { FileDescriptor, BlobDescriptor } = require("./descriptors");
const { ResourceManager } = require("./resourceManager");
const IngestionBlobInfo = require("./ingestionBlobInfo");
const uuidv4 = require("uuid/v4");
const azureStorage = require("azure-storage");

module.exports = class KustoIngestClient {
    constructor(kcsb) {
        this.Resource_manager = new ResourceManager(KustoClient(kcsb));
    }

    ingestFromFile(file, ingestionProperties) {
        let fileDescriptors = [];
        let containers = this.ResourceManager.getContainers();

        let descriptor = null;

        if (typeof (file) == FileDescriptor) {
            descriptor = file;
        }
        else {
            descriptor = new FileDescriptor(file);
        }

        fileDescriptors.push(descriptor);
        let blobName = `${ingestionProperties.database}__${ingestionProperties.table}__${uuidv4()}__${descriptor.name}`;

        let containerDetails = containers[Math.floor(Math.random() * containers.length)];
        let blobService = azureStorage.createBlockBlobService(containerDetails.accountName, containerDetails.accountKey);

        blobService.createBlobFromStream(containerDetails.objectName,blobName,descriptor.zippedStream);
        let url = blobService.makeBlob_url(containerDetails.objectName, blobName, containerDetails.sas);

        this.ingestFromBlob(BlobDescriptor(url, descriptor.size), ingestionProperties);
    }

    ingestFromBlob(blob, ingestionProperties) {
        let queues = this.ResourceManager.getIngestionQueues();

        let queueDetails = queues[Math.floor(Math.random() * queues.length)];
        let queueService = azureStorage.createQueueService(queueDetails.accountName,queueDetails.accountKey);
        let authorizationContext = this.ResourceManager.getAuthorizationContext();
        let ingestionBlobInfo = new IngestionBlobInfo(
            blob, ingestionProperties, authorizationContext
        );
        let ingestionBlobInfoJson = ingestionBlobInfo.toJson();
        let encoded = Buffer.from(ingestionBlobInfoJson).toString("base64");
        queueService.putMessage(queueDetails.objectName, encoded);
    }
};