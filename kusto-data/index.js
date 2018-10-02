const client = require("./source/client");
const KustoConnectionStringBuilder = require("./source/connectionBuilder");
module.exports = {
    Client: client,
    KustoConnectionStringBuilder: KustoConnectionStringBuilder
};
