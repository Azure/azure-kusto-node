# Microsoft Azure Kusto Data Library for Node

## Installation

`npm install azure-kusto-data`

## Quick Start

```javascript 
const KustoClient = require("azure-kusto-data").Client;
const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;

const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://${clusterName}.kusto.windows.net`,'appid','appkey','authority_id');
const client = new KustoClient(kcsb);

client.execute("db", "TableName | limit 1", (err, results) => {
    if (err) throw new Error(err);
    console.log(JSON.stringify(results));
    console.log(results.primaryResults[0].toString());
});

```

## Authentication
There are several authentication methods

### App
There are two ways to authenticate using AAD application:

```javascript
const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://${clusterName}.kusto.windows.net`,'appid','appkey','authorityId');
```

It is also possible to use a certificate:

```javascript
const kcsb = KustoConnectionStringBuilder.withAadApplicationCertificateAuthentication(`https://${clusterName}.kusto.windows.net`, 'appid', 'certificate', 'thumbprint', 'authorityId');
```


### Username/Password
```javascript
KustoConnectionStringBuilder.withAadUserPasswordAuthentication(`https://${clusterName}.kusto.windows.net`,'username','password');
```

Authority is optional, as it is inferd from the domain ('user@microsoft.com' would make the authority 'microsoft.com'). 
In any case it is possible to pass the authority id
```javascript
KustoConnectionStringBuilder.withAadUserPasswordAuthentication(`https://${clusterName}.kusto.windows.net`,'username','password','authority_id');
```

### Device
Using this method will write a token to the console, which can be used to authenticate at https://login.microsoftonline.com/common/oauth2/deviceauth and will allow temporary access. 

**<!>It is not ment for production purposes<!>**

```javascript
KustoConnectionStringBuilder.withAadUserPasswordAuthentication(`https://${clusterName}.kusto.windows.net`,'username','password');
```

## Usage
Query language docs can be found at https://docs.microsoft.com/en-us/azure/data-explorer/write-queries#overview-of-the-query-language

