// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const moment = require("moment");

const URI_FORMAT = /https:\/\/(\w+).(queue|blob|table).core.windows.net\/([\w,-]+)\?(.*)/;


class ResourceURI {
    constructor(storageAccountName, objectType, objectName, sas) {
        this.storageAccountName = storageAccountName;
        this.objectType = objectType;
        this.objectName = objectName;
        this.sas = sas;
    }

    static fromURI(uri) {
        const match = URI_FORMAT.exec(uri);
        return new ResourceURI(match[1], match[2], match[3], match[4]);
    }

    getSASConnectionString() {
        if(this.objectType == "queue"){
            return `QueueEndpoint=https://${this.storageAccountName}.queue.core.windows.net/;SharedAccessSignature=${this.sas}`
        }
        if(this.objectType == "blob"){
            return `BlobEndpoint=https://${this.storageAccountName}.blob.core.windows.net/;SharedAccessSignature=${this.sas}`
        }
    }
}

module.exports.ResourceURI = ResourceURI;

class IngestClientResources {
    constructor(
        securedReadyForAggregationQueues = null,
        failedIngestionsQueues = null,
        successfulIngestionsQueues = null,
        containers = null
    ) {
        this.securedReadyForAggregationQueues = securedReadyForAggregationQueues;
        this.failedIngestionsQueues = failedIngestionsQueues;
        this.successfulIngestionsQueues = successfulIngestionsQueues;
        this.containers = containers;
    }

    valid() {
        let resources = [
            this.securedReadyForAggregationQueues,
            this.failedIngestionsQueues,
            this.failedIngestionsQueues,
            this.containers
        ];
        return resources.reduce((prev, current) => prev && current, true);
    }
}

module.exports.IngestClientResources = IngestClientResources;

module.exports.ResourceManager = class ResourceManager {
    constructor(kustoClient) {
        this.kustoClient = kustoClient;
        this.refreshPeriod = moment.duration(1, "h");

        this.ingestClientResources = null;
        this.ingestClientResourcesLastUpdate = null;

        this.authorizationContext = null;
        this.authorizationContextLastUpdate = null;

    }

    async refreshIngestClientResources() {
        let now = moment.now();
        if (!this.ingestClientResources ||
            (this.ingestClientResourcesLastUpdate + this.refreshPeriod) <= now || !this.ingestClientResources.valid()) {
            this.ingestClientResources = await this.getIngestClientResourcesFromService();
            this.ingestClientResourcesLastUpdate = now;
        }
    }

    async getIngestClientResourcesFromService() {
        let response = await this.kustoClient.execute("NetDefaultDB", ".get ingestion resources");
        const table = response.primaryResults[0];

        const resources = new IngestClientResources(
            this.getResourceByName(table, "SecuredReadyForAggregationQueue"),
            this.getResourceByName(table, "FailedIngestionsQueue"),
            this.getResourceByName(table, "SuccessfulIngestionsQueue"),
            this.getResourceByName(table, "TempStorage")
        );
        return resources;
    }

    getResourceByName(table, resourceName) {
        let result = [];
        for (let row of table.rows()) {
            if (row.ResourceTypeName == resourceName) {
                result.push(ResourceURI.fromURI(row.StorageRoot));
            }
        }
        return result;
    }

    async refreshAuthorizationContext() {
        let now = moment.utc();
        if (!this.authorizationContext || this.authorizationContext.trim() ||
            (this.authorizationContextLastUpdate + this.refreshPeriod) <= now) {
            this.authorizationContext = await this.getAuthorizationContextFromService();
            this.authorizationContextLastUpdate = now;
        }
    }

    async getAuthorizationContextFromService() {
        let response = await this.kustoClient.execute("NetDefaultDB", ".get kusto identity token");
        const authContext = response.primaryResults[0].rows().next().value.AuthorizationContext;
        return authContext;
    }

    async getIngestionQueues() {
        await this.refreshIngestClientResources();
        return this.ingestClientResources.securedReadyForAggregationQueues;
    }

    async getFailedIngestionsQueues() {
        await this.refreshIngestClientResources();
        return this.ingestClientResources.failedIngestionsQueues;
    }

    async getSuccessfulIngestionsQueues() {
        await this.refreshIngestClientResources();
        return this.ingestClientResources.successfulIngestionsQueues;
    }

    async getContainers() {
        await this.refreshIngestClientResources();
        return this.ingestClientResources.containers;
    }

    async getAuthorizationContext() {
        await this.refreshAuthorizationContext();
        return this.authorizationContext;
    }
};
