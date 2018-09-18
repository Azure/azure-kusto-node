const KustoClient = require("kusto-data");
const { FileDescriptor, BlobDescriptor } = require("./descriptors");
const { ResourceManager } = require("./resourceManager");
const IngestionBlobInfo = require("./ingestionBlobInfo");
const uuidv4 = require("uuid/v4");
const azureStorage = require("azure-storage");
const zlib = require("zlib");
const fs = require("fs");

function gzipFile(file, callback) {
    let zipper = zlib.createGzip();
    let input = fs.createReadStream(file, {autoClose: true});
    let output = fs.createWriteStream(logfile + ".gz");

    input.pipe(zipper).pipe(output);

    // cleanup
    input.once('end', function() {
        zipper.removeAllListeners();
        zipper.close();
        zipper = null;
        input.removeAllListeners();
        input.close();
        input = null;
        output.removeAllListeners();
        output.close();
        output = null;
    });

    output.on("end", function() {
        // delete original file, it is no longer needed
        fs.unlink(file);

        // clear listeners
        zipper.removeAllListeners();
        input.removeAllListeners();
    });
}

module.exports = class KustoIngestClient {
    constructor(kcsb, defaultProps) {
        this.Resource_manager = new ResourceManager(KustoClient(kcsb));
        this.defaultProps = defaultProps;
    }

    ingestFromFile(file, ingestionProperties, callback) {
        let props = ingestionProperties ? this.defaultProps.merge(ingestionProperties) : this.defaultProps;

        props.validate();

        let descriptor = file;
        if (typeof (descriptor) === "string") {
            descriptor = new FileDescriptor(descriptor);
        }
        let blobName = `${props.database}__${props.table}__${uuidv4()}__${descriptor.name}`;

        // handle case when file isn't gzipped
        let containers = this.ResourceManager.getContainers();
        let containerDetails = containers[Math.floor(Math.random() * containers.length)];
        let blobService = azureStorage.createBlockBlobService(containerDetails.accountName, containerDetails.accountKey);

        blobService.createBlobFromFile(containerDetails.objectName, blobName, file, function (error) {
            this.ingestFromBlob(BlobDescriptor(url, descriptor.size), props, callback);
          });
        }
    }

    ingestFromBlob(blob, ingestionProperties, callback) {
        let props = ingestionProperties ? this.defaultProps.merge(ingestionProperties) : this.defaultProps;
        props.validate();

        let queues = this.ResourceManager.getIngestionQueues();
        let queueDetails = queues[Math.floor(Math.random() * queues.length)];
        let queueService = azureStorage.createQueueService(queueDetails.accountName, queueDetails.accountKey);
        let authorizationContext = this.ResourceManager.getAuthorizationContext();
        let ingestionBlobInfo = new IngestionBlobInfo(
            blob, props, authorizationContext
        );
        let ingestionBlobInfoJson = ingestionBlobInfo.toJson();
        let encoded = Buffer.from(ingestionBlobInfoJson).toString("base64");
        queueService.putMessage(queueDetails.objectName, encoded);
        callback(null);
    }
};