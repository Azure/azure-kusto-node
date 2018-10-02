const KustoClient = require("azure-kusto-data").Client;
const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
const Console = require("console");

const kcs = KustoConnectionStringBuilder.withAadUserPasswordAuthentication(`https://${clusterName}.kusto.windows.net`,'username','password');
const kustoClient = new KustoClient(kcs);

kustoClient.execute("db", "TableName | limit 1", (err, results) => {
    if (err) throw new Error(err);
    Console.log(JSON.stringify(results));
    Console.log(results.primaryResults[0].toString());
});