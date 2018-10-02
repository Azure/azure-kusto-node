const IngestClient = require("./index").IngestClient;
const IngestStatusQueues = require("./index").IngestStatusQueues;
const IngestionProps = require("./index").IngestionProperties;
const { ReportLevel, ReportMethod } = require("./index").IngestionPropertiesEnums;
const KustoConnectionStringBuilder = require("../kusto-data").KustoConnectionStringBuilder;
const { DataFormat, JsonColumnMapping } = require("./index").IngestionPropertiesEnums;
const fs = require("fs");

const appId = "";
const appKey = "";
const authorityId = "";

const ingestClient = new IngestClient(
    KustoConnectionStringBuilder.withAadApplicationKeyAuthentication("https://ingest-toshetah.kusto.windows.net", appId, appKey, authorityId),
    new IngestionProps(
        "Database",
        "Table",
        DataFormat.json,
        [
            new JsonColumnMapping("TargetColumn1", "$.sourceProp1"),
            new JsonColumnMapping("TargetColumn2", "$.sourceProp2"),
            new JsonColumnMapping("TargetColumn3", "$.sourceProp3")
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

        statusQueues.failure.pop((err, failures) => {
            if (err) throw new Error(err);

            for (let failure of failures) {
                console.log(JSON.stringify(failure));
            }
        });
    });
}

function waitForSuccess() {
    statusQueues.success.isEmpty((err, empty) => {
        if (err) throw new Error(err);

        if (empty) {
            console.log("no successes...");
            return setTimeout(waitForSuccess, 1000);
        }

        statusQueues.success.pop((err, successes) => {
            if (err) throw new Error(err);

            for (let success of successes) {
                console.log(JSON.stringify(success));
            }
        })
    });
}
    
console.log("Ingest from file");

ingestClient.ingestFromFile("file.json", null, (err) => {
    if (err) {
        console.log(err);
    }

    console.log("Ingestion done?");


    setTimeout(waitForFailures, 0);
    setTimeout(waitForSuccess, 0);
});

