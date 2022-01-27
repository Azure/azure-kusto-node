// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// We want all the Resources related classes in this file
/* tslint:disable:max-classes-per-file */

import {Client} from "azure-kusto-data";
import moment from "moment";

const URI_FORMAT = /https:\/\/(\w+).(queue|blob|table).core.windows.net\/([\w,-]+)\?(.*)/;

export class ResourceURI {
    constructor(readonly storageAccountName: string, readonly objectType: string, readonly objectName: string, readonly sas: string) {
    }

    static fromURI(uri: string) {
        const match = URI_FORMAT.exec(uri);
        if (match == null || match.length < 5) {
            throw Error(`Failed to create ResourceManager from URI - invalid uri (${uri})`);
        }
        return new ResourceURI(match[1], match[2], match[3], match[4]);
    }

    getSASConnectionString(): string {
        if (this.objectType === "queue") {
            return `QueueEndpoint=https://${this.storageAccountName}.queue.core.windows.net/;SharedAccessSignature=${this.sas}`;
        }
        if (this.objectType === "blob") {
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
        const resources = [
            this.securedReadyForAggregationQueues,
            this.failedIngestionsQueues,
            this.failedIngestionsQueues,
            this.containers
        ];
        return resources.reduce((prev, current) => !!(prev && current), true);
    }
}

export class ResourceManager {
    public readonly refreshPeriod: moment.Duration;
    public ingestClientResources: IngestClientResources | null;
    public ingestClientResourcesLastUpdate: moment.Moment | null;
    public authorizationContext: string | null;
    public authorizationContextLastUpdate: moment.Moment | null;

    constructor(readonly kustoClient: Client) {
        this.refreshPeriod = moment.duration(1, "h");

        this.ingestClientResources = null;
        this.ingestClientResourcesLastUpdate = null;

        this.authorizationContext = null;
        this.authorizationContextLastUpdate = null;
    }

    async refreshIngestClientResources(): Promise<IngestClientResources> {
        const now = moment();
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
        const response = await this.kustoClient.execute("NetDefaultDB", ".get ingestion resources");
        const table = response.primaryResults[0];

        return new IngestClientResources(
            this.getResourceByName(table, "SecuredReadyForAggregationQueue"),
            this.getResourceByName(table, "FailedIngestionsQueue"),
            this.getResourceByName(table, "SuccessfulIngestionsQueue"),
            this.getResourceByName(table, "TempStorage")
        );
    }

    getResourceByName(table: { rows: () => any; }, resourceName: string): ResourceURI[] {
        const result = [];
        for (const row of table.rows()) {
            if (row.ResourceTypeName === resourceName) {
                result.push(ResourceURI.fromURI(row.StorageRoot));
            }
        }
        return result;
    }

    async refreshAuthorizationContext(): Promise<string> {
        const now = moment.utc();
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
        const response = await this.kustoClient.execute("NetDefaultDB", ".get kusto identity token");
        return (response.primaryResults[0].rows().next().value as any).AuthorizationContext;
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
