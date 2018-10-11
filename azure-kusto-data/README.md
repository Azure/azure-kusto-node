# Microsoft Azure Kusto Data Library for Node

# Quick Start

```javascript 
const KustoClient = require("azure-kusto-data").Client;
const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
const Console = require("console");

const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://${clusterName}.kusto.windows.net`,'username','password','tenant_id');
const client = new KustoClient(kcsb);

client.execute("db", "TableName | limit 1", (err, results) => {
    if (err) throw new Error(err);
    Console.log(JSON.stringify(results));
    Console.log(results.primaryResults[0].toString());
});

```