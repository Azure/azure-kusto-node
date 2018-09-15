const KustoClient = require("kusto-data").Client;
const KustoConnectionBuilder = require("kusto-data").kustoConnectionBuilder;
const Console = require("console");

const kcs = KustoConnectionBuilder.withAadUserPasswordAuthentication("https://toshetah.kusto.windows.net");
const kustoClient = new KustoClient(kcs);

kustoClient.execute("daniel", "GithubEvent | limit 1", false, null, false, (err, results) => {
    if (err) throw new Error(err);

    Console.log(results.primaryResults[0].toString());
});