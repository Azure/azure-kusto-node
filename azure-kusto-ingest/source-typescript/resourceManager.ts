// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import moment from "moment";

const URI_FORMAT = /https:\/\/(\w+).(queue|blob|table).core.windows.net\/([\w,-]+)\?(.*)/;

export class ResourceURI {
    constructor(readonly storageAccountName: string, readonly objectType: string, readonly objectName: string, readonly sas: string) {
    }

    static fromURI(uri: string) {
        const match = URI_FORMAT.exec(uri);
        if (match == null || match.length < 5) {
            throw Error("Failed to create ResourceManager from URI - invalid uri");
        }
        return new ResourceURI(match[1], match[2], match[3], match[4]);
    }

    getSASConnectionString(): string {
        if (this.objectType == "queue") {
            return `QueueEndpoint=https://${this.storageAccountName}.queue.core.windows.net/;SharedAccessSignature=${this.sas}`;
        }
        if (this.objectType == "blob") {
            return `BlobEndpoint=https://${this.storageAccountName}.blob.core.windows.net/;SharedAccessSignature=${this.sas}`;
        }

        throw new Error(`Can't make the current object type (${this.objectType}) to connection string`)
    }
}

export class IngestClientResources {
    constructor(
        readonly securedReadyForAggregationQueues: ResourceURI[] | null = null,
        readonly failedIngestionsQueues: ResourceURI[] | null = null,
        readonly successfulIngestionsQueues: ResourceURI[] | null = null,
        readonly containers: ResourceURI[] | null = null
    ) {
    }

    valid() {
        let resources = [
            this.securedReadyForAggregationQueues,
            this.failedIngestionsQueues,
            this.failedIngestionsQueues,
            this.containers
        ];
        return resources.reduce((prev, current) => !!(prev && current), true);
    }
}

export class ResourceManager {
    private readonly refreshPeriod: moment.Duration;
    private ingestClientResources: IngestClientResources | null;
    private ingestClientResourcesLastUpdate: moment.Moment | null;
    private authorizationContext: string | null;
    private authorizationContextLastUpdate: moment.Moment | null;

    constructor(readonly kustoClient: any) { //todo ts
        this.refreshPeriod = moment.duration(1, "h");

        this.ingestClientResources = null;
        this.ingestClientResourcesLastUpdate = null;

        this.authorizationContext = null;
        this.authorizationContextLastUpdate = null;
    }

    async refreshIngestClientResources(): Promise<IngestClientResources> {
        let now = moment();
        if (!this.ingestClientResources ||
            !this.ingestClientResourcesLastUpdate ||
            (this.ingestClientResourcesLastUpdate.add(this.refreshPeriod) <= now) ||
            !this.ingestClientResources.valid()) {
            this.ingestClientResources = await this.getIngestClientResourcesFromService();
            this.ingestClientResourcesLastUpdate = now;
        }

        return this.ingestClientResources;
    }

    async getIngestClientResourcesFromService(): Promise<IngestClientResources> {
        let response = await this.kustoClient.execute("NetDefaultDB", ".get ingestion resources");
        const table = response.primaryResults[0];

        return new IngestClientResources(
            this.getResourceByName(table, "SecuredReadyForAggregationQueue"),
            this.getResourceByName(table, "FailedIngestionsQueue"),
            this.getResourceByName(table, "SuccessfulIngestionsQueue"),
            this.getResourceByName(table, "TempStorage")
        );
    }

    getResourceByName(table: { rows: () => any; }, resourceName: string): ResourceURI[] { //todo ts
        let result = [];
        for (let row of table.rows()) {
            if (row.ResourceTypeName == resourceName) {
                result.push(ResourceURI.fromURI(row.StorageRoot));
            }
        }
        return result;
    }

    async refreshAuthorizationContext(): Promise<string> {
        let now = moment.utc();
        if (!this.authorizationContext?.trim() ||
            !this.authorizationContextLastUpdate ||
            (this.authorizationContextLastUpdate.add(this.refreshPeriod)) <= now) {
            this.authorizationContext = await this.getAuthorizationContextFromService();
            this.authorizationContextLastUpdate = now;

            if (this.authorizationContext == null) {
                throw new Error("Authorization context can't be null");
            }
        }

        return this.authorizationContext;
    }

    async getAuthorizationContextFromService() {
        let response = await this.kustoClient.execute("NetDefaultDB", ".get kusto identity token");
        return response.primaryResults[0].rows().next().value.AuthorizationContext;
    }

    async getIngestionQueues() {
        return (await this.refreshIngestClientResources()).securedReadyForAggregationQueues;
    }

    async getFailedIngestionsQueues() {
        return (await this.refreshIngestClientResources()).failedIngestionsQueues;
    }

    async getSuccessfulIngestionsQueues() {
        return (await this.refreshIngestClientResources()).successfulIngestionsQueues;
    }

    async getContainers() {
        return (await this.refreshIngestClientResources()).containers;
    }

    async getAuthorizationContext(): Promise<string> {
        return this.refreshAuthorizationContext();
    }
}

export default ResourceManager;
