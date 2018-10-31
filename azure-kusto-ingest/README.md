# Microsoft Azure Kusto Ingest Library for Node

## Installation

`npm install azure-kusto-ingest`

## Quick Start

```javascript 
const IngestClient = require("azure-kusto-ingest").IngestClient;
const IngestionProps = require("azure-kusto-ingest").IngestionProperties;
const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
const { DataFormat, JsonColumnMapping } = require("azure-kusto-ingest").IngestionPropertiesEnums;

const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://ingest-${cluster}.kusto.windows.net`, appId, appKey, authorityId);

const ingestionProps = new IngestionProps(
        "Database",
        "Table",
        DataFormat.json,
        [
            new JsonColumnMapping("TargetColumn1", "$.sourceProp1"),
            new JsonColumnMapping("TargetColumn2", "$.sourceProp2"),
            new JsonColumnMapping("TargetColumn3", "$.sourceProp3")
        ]
);

const ingestClient = new IngestClient(
    kcsb,
    ingestionProps
);
    
console.log("Ingest from file");

ingestClient.ingestFromFile("file.json", null, (err) => {
    if (err) {
        console.log(err);
    }

    console.log("Ingestion done");
});

```

## Authentication
There are several authentication methods

### AAD App
The are two ways to authenticate is to use app id and key

1. Using app key
```javascript
const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://ingest-${clusterName}.kusto.windows.net`,'appid','appkey','authorityId');
```

1. Using a certificate:

```javascript
const kcsb = KustoConnectionStringBuilder.withAadApplicationCertificateAuthentication(`https://ingest-${clusterName}.kusto.windows.net`, 'appid', 'certificate', 'thumbprint', 'authorityId');
```


### Username/Password
```javascript
KustoConnectionStringBuilder.withAadUserPasswordAuthentication(`https://${clusterName}.kusto.windows.net`,'username','password');
```

Authority is optional *when it can be inferred from the domain* ('user@microsoft.com' would make the authority 'microsoft.com'). 
In any case it is possible to pass the authority id
```javascript
KustoConnectionStringBuilder.withAadUserPasswordAuthentication(`https://ingest-${clusterName}.kusto.windows.net`,'username','password','authorityId');
```

### Device
Using this method will write a token to the console, which can be used to authenticate at https://login.microsoftonline.com/common/oauth2/deviceauth and will allow temporary access. 

**<!>It is not ment for production purposes<!>**

```javascript
// will log the DEVICE token and url to use
KustoConnectionStringBuilder.withAadDeviceAuthentication(`https://${clusterName}.kusto.windows.net`);

// in case you want to do your own thing with the response, you can pass a callback
// NOTICE: code will still block until device is authenticated
KustoConnectionStringBuilder.withAadDeviceAuthentication(`https://${clusterName}.kusto.windows.net`, (toeknResponse) => {
... // your code, for example copy to clipboard or open url in browser
});
    console.log("Open " + tokenResponse.verificationUrl + " and use " + tokenResponse.userCode + " code to authorize.");
});
```

## Usage

A Quick Overview is available at https://docs.microsoft.com/en-us/azure/data-explorer/ingest-data-overview

Notice ingestion is done against the ingestion endpoint, which usually include `ingest-` prefix on the cluster name.

### Ingestion Properties
Ingestion Props are instructions for Kusto on how to process the data.

The easiest way to provide ingestion properties is to set them on the ingestion client like in the sample above.
It is also possible to pass them on each ingestion (will merge them with default props).

Example props:

```javascript
const ingestionProps = new IngestionProps(
        "Database",
        "Table",
        DataFormat.json,
        [
            new JsonColumnMapping("TargetColumn1", "$.sourceProp1"),
            new JsonColumnMapping("TargetColumn2", "$.sourceProp2"),
            new JsonColumnMapping("TargetColumn3", "$.sourceProp3")
        ]
);
```

### Ingestion Sources
There are several methods of ingesting data into Kusto (Azure Data Explorer) using this library

#### From Stream

This is useful for cases you already have streams available (http respinse, file stream, etc..)

```javascript
ingestClient.ingestFromStream(readable, null, (err) => {
        if (err) console.log(err);
        else console.log("Ingestion from stream DONE");
});
```


#### From File

Ingesting a file first makes sure it's zipped (if not, it zips it locally) and then send it for ingestion

```javascript
ingestClient.ingestFromFile(filePath, null, (err) => {
        if (err) {
            console.log(err);
        }

        console.log("Ingestion from file DONE");


        setTimeout(waitForFailures, 0);
        setTimeout(waitForSuccess, 0);
    });
```

#### From Azure Storage Blob

Probably the easiest way would be to provide a uri (with [SAS](https://docs.microsoft.com/en-us/azure/storage/common/storage-dotnet-shared-access-signature-part-1)).

```javascript

let blob = new BlobDescriptor(blobUri, size);
ingestClient.ingestFromBlob(blob, null, (err) => {
        if (err) {
            console.log(err);
        }

        console.log("Ingestion from file DONE");


        setTimeout(waitForFailures, 0);
        setTimeout(waitForSuccess, 0);
    });
```

### Ingestion Status

It is possible to track the status of the ingestion using status queues.

Enabling is done simply but setting the `reportLevel` Ingestion Property to `ReportLevel.FailuresAndSuccesses`

For Example:

```javascript
const IngestClient = require("azure-kusto-ingest").IngestClient;
const IngestStatusQueues = require("azure-kusto-ingest").IngestStatusQueues;
const IngestionProps = require("azure-kusto-ingest").IngestionProperties;
const { ReportLevel, ReportMethod } = require("azure-kusto-ingest").IngestionPropertiesEnums;
const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
const { DataFormat, JsonColumnMapping } = require("azure-kusto-ingest").IngestionPropertiesEnums;
const fs = require("fs");


const ingestClient = new IngestClient(
    KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(`https://ingest-${clusterName}.kusto.windows.net`, appId, appKey, authorityId),
    new IngestionProps(
        "db",
        "table",
        DataFormat.json,
        [
            new JsonColumnMapping("Id", "$.id"),
            new JsonColumnMapping("Type", "$.type"),
            new JsonColumnMapping("Value", "$.type"),
        ],
        null,
        null,
        null,
        null,
        null,
        null,      
        ReportLevel.FailuresAndSuccesses,
        ReportMethod.Queue)
);

const statusQueues = new IngestStatusQueues(ingestClient);

function waitForFailures() {
    statusQueues.failure.isEmpty((err, empty) => {
        if (err) throw new Error(err);

        if (empty) {
            console.log("no errors...");
            return setTimeout(waitForFailures, 1000);
        }
        else {
            statusQueues.failure.pop((err, failures) => {
                if (err) throw new Error(err);

                for (let failure of failures) {
                    console.log(JSON.stringify(failure));
                }

                return setTimeout(waitForFailures, 1000);
            });
        }
    });
}

function waitForSuccess() {
    statusQueues.success.isEmpty((err, empty) => {
        if (err) throw new Error(err);

        if (empty) {
            console.log("no successes...");
            return setTimeout(waitForSuccess, 1000);
        }
        else {
            statusQueues.success.pop((err, successes) => {
                if (err) throw new Error(err);

                for (let success of successes) {
                    console.log(JSON.stringify(success));
                }

                return setTimeout(waitForSuccess, 1000);
            })
        }
    });
}

ingestClient.ingestFromFile("file.json", null, (err) => {
    if (err) {
        console.log(err);
    }

    console.log("Ingestion done?");


    setTimeout(waitForFailures, 0);
    setTimeout(waitForSuccess, 0);
});
```
