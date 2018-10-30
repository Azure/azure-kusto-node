# Microsoft Azure Kusto Data Library for Node

## Installation

`npm install azure-kusto-data`

## Quick Start

```javascript 
const KustoClient = require("azure-kusto-data").Client;
const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;

const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://${clusterName}.kusto.windows.net`,'appid','appkey','authorityId');
const client = new KustoClient(kcsb);

client.execute("db", "TableName | limit 1", (err, results) => {
    if (err) throw new Error(err);
    console.log(JSON.stringify(results));
    console.log(results.primaryResults[0].toString());
});

```

## Authentication
There are several authentication methods

### AAD appliction
There are two ways to authenticate using AAD application:
Option 1: Authenticating using AAD application id and corresponding key.
```javascript
const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://${clusterName}.kusto.windows.net`,'appid','appkey','authorityId');
```

Option 2: Authenticating using AAD application id and corresponding certificate.

```javascript
const kcsb = KustoConnectionStringBuilder.withAadApplicationCertificateAuthentication(`https://${clusterName}.kusto.windows.net`, 'appid', 'certificate', 'thumbprint', 'authorityId');
```


### Username/Password
```javascript
KustoConnectionStringBuilder.withAadUserPasswordAuthentication(`https://${clusterName}.kusto.windows.net`,'username','password');
```

Authority is optional *when it can inferred from the domain* ('user@microsoft.com' would make the authority 'microsoft.com'). 
In any case it is possible to pass the authority id
```javascript
KustoConnectionStringBuilder.withAadUserPasswordAuthentication(`https://${clusterName}.kusto.windows.net`,'username','password','authorityId');
```

### Device
Using this method will write a token to the console, which can be used to authenticate at https://login.microsoftonline.com/common/oauth2/deviceauth and will allow temporary access. 

**<!>It is not meant for production purposes<!>**

```javascript
KustoConnectionStringBuilder.withAadDeviceAuthentication(`https://${clusterName}.kusto.windows.net`, (tokenResponse) => {
    console.log("Open " + tokenResponse.verificationUrl + " and use " + tokenResponse.userCode + " code to authorize.");
});
```

## Usage
Query language docs can be found at https://docs.microsoft.com/en-us/azure/data-explorer/write-queries#overview-of-the-query-language

