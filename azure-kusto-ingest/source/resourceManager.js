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

    toURI(options) {
        if (options) {
            let baseURI = `https://${this.storageAccountName}.${this.objectType}.core.windows.net/`;

            if (options.withObjectName !== false) {
                baseURI += this.objectName;
            }
            if (options.withSas !== false) {
                baseURI += this.sas;
            }

            return baseURI;
        } else {
            return `https://${this.storageAccountName}.${this.objectType}.core.windows.net/${this.objectName}?${this.sas}`;
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

    refreshIngestClientResources(callback) {
        let now = moment.now();
        if (!this.ingestClientResources ||
            (this.ingestClientResourcesLastUpdate + this.refreshPeriod) <= now || !this.ingestClientResources.valid()
        ) {
            this.getIngestClientResourcesFromService((err, data) => {
                this.ingestClientResources = data;
                this.ingestClientResourcesLastUpdate = now;

                callback(err);
            });
        } else {
            callback();
        }
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

    getIngestClientResourcesFromService(callback) {
        return this.kustoClient.execute("NetDefaultDB", ".get ingestion resources", (err, resp) => {
            if (err) return callback(err);

            const table = resp.primaryResults[0];

            const resources = new IngestClientResources(
                this.getResourceByName(table, "SecuredReadyForAggregationQueue"),
                this.getResourceByName(table, "FailedIngestionsQueue"),
                this.getResourceByName(table, "SuccessfulIngestionsQueue"),
                this.getResourceByName(table, "TempStorage")
            );

            return callback(null, resources);
        });
    }

    refreshAuthorizationContext(callback) {
        let now = moment.utc();
        if (!this.authorizationContext || this.authorizationContext.trim() ||
            (this.authorizationContextLastUpdate + this.refreshPeriod) <= now) {
            return this.getAuthorizationContextFromService((err, data) => {
                this.authorizationContext = data;
                this.authorizationContextLastUpdate = now;

                return callback(err);
            });
        }

        return callback();

    }

    getAuthorizationContextFromService(callback) {
        return this.kustoClient.execute("NetDefaultDB", ".get kusto identity token", (err, resp) => {
            if (err) return callback(err);

            const authContext = resp.primaryResults[0].rows().next().value.AuthorizationContext;

            return callback(err, authContext);
        });
    }

    getIngestionQueues(callback) {
        return this.refreshIngestClientResources((err) => {
            if (err) return callback(err);

            return callback(null, this.ingestClientResources.securedReadyForAggregationQueues);
        });
    }

    getFailedIngestionsQueues(callback) {
        return this.refreshIngestClientResources((err) => {
            if (err) return callback(err);

            return callback(null, this.ingestClientResources.failedIngestionsQueues);
        });
    }
    getSuccessfulIngestionsQueues(callback) {
        return this.refreshIngestClientResources((err) => {
            if (err) return callback(err);

            return callback(null, this.ingestClientResources.successfulIngestionsQueues);
        });
    }
    getContainers(callback) {
        return this.refreshIngestClientResources((err) => {
            if (err) return callback(err);

            return callback(null, this.ingestClientResources.containers);
        });
    }

    getAuthorizationContext(callback) {
        return this.refreshAuthorizationContext((err) => {
            if (err) return callback(err);

            return callback(null, this.authorizationContext);
        });
    }
};
