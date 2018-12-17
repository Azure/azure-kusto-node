const KustoClient = require("azure-kusto-data").Client;
const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
const ClientRequestProperties = require("azure-kusto-data").ClientRequestProperties;

let clusterName = "";
let username = "username";
let password = "password";

const kcs = KustoConnectionStringBuilder.withAadUserPasswordAuthentication(`https://${clusterName}.kusto.windows.net`, username, password);
const kustoClient = new KustoClient(kcs);

kustoClient.execute("db", "TableName | limit 1", (err, results) => {
    if (err) throw new Error(err);
    console.log(JSON.stringify(results));
    console.log(results.primaryResults[0].toString());
});

// providing ClientRequestProperties
// for a complete list of ClientRequestProperties
// go to https://docs.microsoft.com/en-us/azure/kusto/api/netfx/request-properties#list-of-clientrequestproperties
let clientRequestProps = new ClientRequestProperties();
const ONE_MINUTE = 1000 * 60;
clientRequestProps.setOption("servertimeout", ONE_MINUTE);

kustoClient.execute(
    "db", 
    "TableName | limit 1", 
    (err, results) => {
        if (err) throw new Error(err);
        console.log(JSON.stringify(results));
        console.log(results.primaryResults[0].toString());
    }, 
    clientRequestProps
);
