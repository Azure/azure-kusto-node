# Microsoft Azure Kusto Data Library for JavaScript

## Installation

`npm install azure-kusto-data`

## Quick Start

```javascript
const KustoClient = require("azure-kusto-data").Client;
const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;

const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://${clusterName}.kusto.windows.net`, "appid", "appkey", "authorityId");
const client = new KustoClient(kcsb);
// When no longer needed, close the client with the `close` method.

// `execute()` infers the type of command from the query, although you can also specify the type explicitly using the methods `excuteQuery()`,`executeQueryV1()` or `executeMgmt()`
const results = await client.execute("db", "TableName | limit 1");
console.log(JSON.stringify(results));
console.log(results.primaryResults[0].toString());
```

## Authentication

There are several authentication methods

### AAD application

There are three ways to authenticate using AAD application:

Option 1: Authenticating using AAD application id and corresponding key.

```javascript
const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://${clusterName}.kusto.windows.net`, "appid", "appkey", "authorityId");
```

Option 2.1: Authenticating using AAD application id and corresponding certificate.

```javascript
const kcsb = KustoConnectionStringBuilder.withAadApplicationCertificateAuthentication(
    `https://${clusterName}.kusto.windows.net`,
    "appid",
    "certificate",
    "authorityId"
);

Option 2.2: Authenticating using AAD application id and corresponding certificate with SNI public key.
Concat the private and publiccertificates
```javascript
const kcsb = KustoConnectionStringBuilder.withAadApplicationCertificateAuthentication(
    `https://${clusterName}.kusto.windows.net`,
    "appid",
    "-----BEGIN CERTIFICATE-----
... <cert1> ...
-----END CERTIFICATE-----
-----BEGIN PRIVATE KEY-----
... <cert2> ...
-----END PRIVATE KEY-----",
    "authorityId",
    true
);
```

Option 3: Authenticating using [AAD Managed Identities](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview).

```javascript
const kcsb = KustoConnectionStringBuilder.withSystemManagedIdentity(`https://${clusterName}.kusto.windows.net`);
const kcsb = KustoConnectionStringBuilder.withUserManagedIdentity(`https://${clusterName}.kusto.windows.net`, clientId);
```

### Username/Password

```javascript
KustoConnectionStringBuilder.withAadUserPasswordAuthentication(`https://${clusterName}.kusto.windows.net`, "username", "password");
```

Authority is optional _when it can inferred from the domain_ ('user@microsoft.com' would make the authority 'microsoft.com').
In any case it is possible to pass the authority id

```javascript
KustoConnectionStringBuilder.withAadUserPasswordAuthentication(`https://${clusterName}.kusto.windows.net`, "username", "password", "authorityId");
```

### Device

Using this method will write a token to the console, which can be used to authenticate at https://login.microsoftonline.com/common/oauth2/deviceauth and will allow temporary access.

**<!>It is not meant for production purposes<!>**

```javascript
// will log the DEVICE token and url to use
KustoConnectionStringBuilder.withAadDeviceAuthentication(`https://${clusterName}.kusto.windows.net`, authId);

// in case you want to do your own thing with the response, you can pass a callback
// NOTICE: code will still block until device is authenticated
KustoConnectionStringBuilder.withAadDeviceAuthentication(`https://${clusterName}.kusto.windows.net`, authId, (tokenResponse) => {
    // your code, for example copy to clipboard or open url in browser
    console.log("Open " + tokenResponse.verificationUrl + " and use " + tokenResponse.userCode + " code to authorize.");
});
```

### Az Login

You will need to [install the azure-cli](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) and run the following command:

```bash
az login
```

This method uses the token stored in azure cli for authentication.

**<!>This is not recommeneded for unattended authentication<!>**

```javascript
const kcsb = KustoConnectionStringBuilder.withAzLoginIdentity(`https://${clusterName}.kusto.windows.net`); // optionally also pass authorityId
```

## Usage

Query language docs can be found at https://docs.microsoft.com/en-us/azure/data-explorer/write-queries#overview-of-the-query-language

## Advanced Usage

### ClientRequestProperties

For more fine grained control, we expose `ClientRequestProperties`.

```javascript
const ClientRequestProperties = require("azure-kusto-data").ClientRequestProperties;
const Client = require("azure-kusto-data").Client;

const client = new Client("http://cluster.region.kusto.windows.net");
const query = `
declare query_parameters(amount:long);
T | where amountColumn == amount
`;
const clientRequestProps = new ClientRequestProperties();
clientRequestProps.setOption("servertimeout", 1000 * 60);
clientRequestProps.setParameter("amount", 100);
const results = await client.executeQuery("db", query, clientRequestProps);
```

A full list of those properties can be found at https://docs.microsoft.com/en-us/azure/kusto/api/netfx/request-properties
