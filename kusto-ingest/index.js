const client = require("./src/ingestClient");
const IngestStatusQueue = require("./src/statusQ");
module.exports = {
    IngestClient: client,
    IngestStatusQueue: IngestStatusQueue
};
