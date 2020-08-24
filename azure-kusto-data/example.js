// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const KustoClient = require("azure-kusto-data").Client;
const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
const ClientRequestProperties = require("azure-kusto-data").ClientRequestProperties;
const uuidv4 = require("uuid/v4");

const clusterConectionString = "https://<name>.kusto.windows.net";
const database = "";
const table = "";

const kcs = KustoConnectionStringBuilder.withAadDeviceAuthentication(clusterConectionString);
const kustoClient = new KustoClient(kcs);
start();

async function start() {
    try {
        const results = await kustoClient.execute(database, `${table} | limit 1`);
        console.log(JSON.stringify(results));
        console.log(results.primaryResults[0].toString());
    }
    catch (error) {
        console.log(error);
    }

    // providing ClientRequestProperties
    // for a complete list of ClientRequestProperties
    // go to https://docs.microsoft.com/en-us/azure/kusto/api/netfx/request-properties#list-of-clientrequestproperties
    let clientRequestProps = new ClientRequestProperties();
    const ONE_MINUTE = 1000 * 60;
    clientRequestProps.setTimeout(ONE_MINUTE);

    // having client code provide its own clientRequestId is
    // highly recommended. It not only allows the caller to
    // cancel the query, but also makes it possible for the Kusto
    // team to investigate query failures end-to-end:
    clientRequestProps.clientRequestId = `MyApp.MyActivity;${uuidv4()}`;

    try {
        const results = await kustoClient.execute(database, `${table} | limit 1`, clientRequestProps);
        console.log(JSON.stringify(results));
        console.log(results.primaryResults[0].toString());
    }
    catch (error) {
        console.log(error);
    }
}
