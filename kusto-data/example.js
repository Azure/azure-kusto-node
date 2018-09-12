const KustoClient = require("./source/client");
const kustoConnectionStringBuilder = require("./source/connectionBuilder");
const Console = require("console");
// const username = "dadubovs@microsoft.com";
// const password = "Dd150589!";
const kcs = kustoConnectionStringBuilder.withAadUserPasswordAuthentication("https://toshetah.kusto.windows.net", "dadubovs@microsoft.com", "Dd150589!");
const kustoClient = new KustoClient(kcs);

kustoClient.execute("daniel", "GithubEvent | limit 1", false, null, false, (err, results) => {
    if (err) throw new Error(err);

    Console.log(results.PrimaryResult.toString());
});