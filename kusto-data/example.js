const KustoClient = require("kusto-data").Client;
const KustoConnectionBuilder = require("kusto-data").KustoConnectionBuilder;
const Console = require("console");

const kcs = KustoConnectionBuilder.withAadUserPasswordAuthentication(`https://${clusterName}.kusto.windows.net`,'username','password');
const kustoClient = new KustoClient(kcs);

kustoClient.execute("db", "TableName | limit 1", false, null, false, (err, results) => {
    if (err) throw new Error(err);
    Console.log(JSON.stringify(results));
    Console.log(results.primaryResults[0].toString());
});