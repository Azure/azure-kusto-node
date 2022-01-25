// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const KustoClient = require("azure-kusto-data").Client;
const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
const ClientRequestProperties = require("azure-kusto-data").ClientRequestProperties;
const { v4: uuidv4 } = require('uuid');

const clusterConectionString = "https://<cluster>.<region>.kusto.windows.net";
const database = "<databaseName>";
const table = "<tableName>";

const kcs = KustoConnectionStringBuilder.withAadDeviceAuthentication(clusterConectionString);
const kustoClient = new KustoClient(kcs);
start();

async function start() {
    try {
        const results = await kustoClient.execute(database, `['${table}'] | limit 1`);
        console.log(JSON.stringify(results));
        console.log(results.primaryResults[0].toJsonString());
    }
    catch (error) {
        console.log(error);
    }

    // providing ClientRequestProperties
    // for a complete list of ClientRequestProperties
    // go to https://docs.microsoft.com/en-us/azure/kusto/api/netfx/request-properties#list-of-clientrequestproperties
    let clientRequestProps = new ClientRequestProperties();
    const oneMinute = 1000 * 60;
    clientRequestProps.setTimeout(oneMinute);

    // having client code provide its own clientRequestId is
    // highly recommended. It not only allows the caller to
    // cancel the query, but also makes it possible for the Kusto
    // team to investigate query failures end-to-end:
    clientRequestProps.clientRequestId = `MyApp.MyActivity;${uuidv4()}`;

    try {
        const results = await kustoClient.execute(database, `['${table}'] | limit 1`, clientRequestProps);
        console.log(JSON.stringify(results));
        console.log(results.primaryResults[0].toJsonString());
    }
    catch (error) {
        console.log(error);
    }
}
