const moment = require("moment");
const StorageUrl = require("storageUrl");

class IngestClientResources {
    constructor(
        securedReadyForAggregationQueues = null,
        failedIngestionsQueues = null,
        successfulIngestionsQueues = null,
        containers = null,
        statusTables = null
    ) {
        this.securedReadyForAggregationQueues = securedReadyForAggregationQueues;
        this.failedIngestionsQueues = failedIngestionsQueues;
        this.successfulIngestionsQueues = successfulIngestionsQueues;
        this.containers = containers;
        this.statusTables = statusTables;
    }

    isApplicable() {
        let resources = [
            this.securedReadyForAggregationQueues,
            this.failedIngestionsQueues,
            this.failedIngestionsQueues,
            this.containers,
            this.statusTables,
        ];
        return resources.reduce((prev, current) => prev && current, true);
    }
}

module.exports.IngestClientResources = IngestClientResources;

module.exports.ResourceManager = class resourceManager {
    constructor(kustoClient) {
        this.kustoClient = kustoClient;
        this.refreshPeriod = moment.duration(1, "h");

        this.ingestClientResources = null;
        this.ingestClientResourcesLastUpdate = null;

        this.authorizationContext = null;
        this.authorizationContextLastUpdate = null;

    }

    refreshIngestClientResources() {
        let now = moment.now();
        if (!this.ingestClientResources || (this.ingestClientResourcesLastUpdate + this.refreshPeriod) <= now || !this.ingestClientResources.isApplicable()
        ) {
            this.ingestClientResources = this.getIngestClientResourcesFromService();
            this.ingestClientResourcesLastUpdate = now;
        }
    }

    getResourceByBame(table, resourceName) {
        let result = [];
        for (let row of table.rows()) {
            if (row.ResourceTypeName == resourceName) {
                result.push(StorageUrl.fromUri(row.StorageRoot));
            }
        }
        return result;
    }

    getIngestClientResourcesFromService() {
        let table = this.kustoClient.execute("NetultDB", ".get ingestion resources").primaryResults[0];

        return new IngestClientResources(
            this.getResourceByBame(table, "SecuredReadyForAggregationQueue"),
            this.getResourceByBame(table, "FailedIngestionsQueue"),
            this.getResourceByBame(table, "SuccessfulIngestionsQueue"),
            this.getResourceByBame(table, "TempStorage"),
            this.getResourceByBame(table, "IngestionsStatusTable")
        );
    }

    refreshAuthorizationContext() {
        let now = moment.utc();
        if (!this.authorizationContext || this.authorizationContext.isspace() || (this.authorizationContextLastUpdate + this.refreshPeriod) <= now) {
            this.authorizationContext = this.getAuthorizationContextFromService();
            // TODO: this can get out of sync
            this.authorizationContextLastUpdate = now;
        }
    }

    getAuthorizationContextFromService() {
        // TODO: huh?
        return this.kustoClient.execute("NetultDB", ".get kusto identity token").primaryResults[0][0]["AuthorizationContext"];
    }

    getIngestionQueues() {
        this.refreshIngestClientResources();
        return this.ingestClientResources.securedReadyForAggregationQueues;
    }
    getFailedIngestionsQueues() {
        this.refreshIngestClientResources();
        return this.ingestClientResources.failedIngestionsQueues;
    }
    getSuccessfulIngestionsQueues() {
        this.refreshIngestClientResources();
        return this.ingestClientResources.successfulIngestionsQueues;
    }
    getContainers() {
        this.refreshIngestClientResources();
        return this.ingestClientResources.containers;
    }
    getIngestionsStatusTables() {
        this.refreshIngestClientResources();
        return this.ingestClientResources.statusTables;
    }
    getAuthorizationContext() {
        this.refreshAuthorizationContext();
        return this.authorizationContext;
    }
};