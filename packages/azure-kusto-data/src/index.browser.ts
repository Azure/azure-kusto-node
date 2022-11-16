// // Copyright (c) Microsoft Corporation.
// // Licensed under the MIT License.

// import KustoClient from "./client";
// import ClientRequestProperties from "./clientRequestProperties";
// import KustoConnectionStringBuilder from "./connectionBuilder";
// import * as KustoDataErrors from "./errors";

// const kcsb = KustoConnectionStringBuilder.withUserPrompt("https://devdevon.westeurope.dev.kusto.windows.net");
// // const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication("https://devdevon.westeurope.dev.kusto.windows.net","a","b","C");
// const cli = new KustoClient(kcsb);
// cli.execute("fast","TestTable2").then(resp=>console.log(resp)).catch(e=>console.log(e))

// export { KustoClient as Client, ClientRequestProperties, KustoConnectionStringBuilder, KustoDataErrors };
