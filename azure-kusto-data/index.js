// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const Client = require("./source/client");
const ClientRequestProperties = require("./source/clientRequestProperties");
const KustoConnectionStringBuilder = require("./source/connectionBuilder");
module.exports = {
    Client,
    KustoConnectionStringBuilder,
    ClientRequestProperties
};
