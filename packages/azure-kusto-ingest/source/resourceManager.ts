// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Client, KustoDataErrors } from "azure-kusto-data";
import { ExponentialRetry } from "./retry";
import moment from "moment";

const URI_FORMAT = /https:\/\/(\w+).(queue|blob|table).(?:[a-z]\.?)+\/([\w,-]+)\?(.*)/;
const ATTEMPT_COUNT = 4;
export class ResourceURI {
    constructor(readonly storageAccountName: string, readonly objectType: string, readonly objectName: string, readonly sas: string) {}

    static fromURI(uri: string) {
        const match = URI_FORMAT.exec(uri.trim().toLowerCase());
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

        throw new Error(`Can't make the current object type (${this.objectType}) to connection string`);
    }
}

export class IngestClientResources {
    constructor(
        readonly securedReadyForAggregationQueues: ResourceURI[] | null = null,
        readonly failedIngestionsQueues: ResourceURI[] | null = null,
        readonly successfulIngestionsQueues: ResourceURI[] | null = null,
        readonly containers: ResourceURI[] | null = null
    ) {}

    valid() {
        const resources = [this.securedReadyForAggregationQueues, this.failedIngestionsQueues, this.failedIngestionsQueues, this.containers];
        return resources.reduce((prev, current) => !!(prev && current), true);
    }
}

export class ResourceManager {
    public readonly refreshPeriod: moment.Duration;
    public ingestClientResources: IngestClientResources | null;
    public ingestClientResourcesLastUpdate: moment.Moment | null;
    public authorizationContext: string | null;
    public authorizationContextLastUpdate: moment.Moment | null;

    private baseSleepTimeSecs = 1;
    private baseJitterSecs = 1;

    constructor(readonly kustoClient: Client) {
        this.refreshPeriod = moment.duration(1, "h");

        this.ingestClientResources = null;
        this.ingestClientResourcesLastUpdate = null;

        this.authorizationContext = null;
        this.authorizationContextLastUpdate = null;
    }

    async refreshIngestClientResources(): Promise<IngestClientResources> {
        const now = moment();
        if (
            !this.ingestClientResources ||
            !this.ingestClientResourcesLastUpdate ||
            this.ingestClientResourcesLastUpdate.add(this.refreshPeriod) <= now ||
            !this.ingestClientResources.valid()
        ) {
            this.ingestClientResources = await this.getIngestClientResourcesFromService();
            this.ingestClientResourcesLastUpdate = now;
        }

        return this.ingestClientResources;
    }

    async getIngestClientResourcesFromService(): Promise<IngestClientResources> {
        const retry = new ExponentialRetry(ATTEMPT_COUNT, this.baseSleepTimeSecs, this.baseJitterSecs);
        while (retry.shouldTry()) {
            try {
                const response = await this.kustoClient.execute("NetDefaultDB", ".get ingestion resources");
                const table = response.primaryResults[0];
                return new IngestClientResources(
                    this.getResourceByName(table, "SecuredReadyForAggregationQueue"),
                    this.getResourceByName(table, "FailedIngestionsQueue"),
                    this.getResourceByName(table, "SuccessfulIngestionsQueue"),
                    this.getResourceByName(table, "TempStorage")
                );
            } catch (error: unknown) {
                if (!(error instanceof KustoDataErrors.ThrottlingError)) {
                    throw error;
                }
                await retry.backoff();
            }
        }
        throw new Error(`Failed to get ingestion resources from server - the request was throttled ${ATTEMPT_COUNT} times.`);
    }

    getResourceByName(table: { rows: () => any }, resourceName: string): ResourceURI[] {
        const result = [];
        for (const row of table.rows()) {
            const typedRow = row as {
                ResourceTypeName: string;
                StorageRoot: string;
            };
            if (typedRow.ResourceTypeName === resourceName) {
                result.push(ResourceURI.fromURI(typedRow.StorageRoot));
            }
        }
        return result;
    }

    async refreshAuthorizationContext(): Promise<string> {
        const now = moment.utc();
        if (!this.authorizationContext?.trim() || !this.authorizationContextLastUpdate || this.authorizationContextLastUpdate.add(this.refreshPeriod) <= now) {
            this.authorizationContext = await this.getAuthorizationContextFromService();
            this.authorizationContextLastUpdate = now;

            if (this.authorizationContext == null) {
                throw new Error("Authorization context can't be null");
            }
        }

        return this.authorizationContext;
    }

    async getAuthorizationContextFromService() {
        const retry = new ExponentialRetry(ATTEMPT_COUNT, this.baseSleepTimeSecs, this.baseJitterSecs);
        while (retry.shouldTry()) {
            try {
                const response = await this.kustoClient.execute("NetDefaultDB", ".get kusto identity token");
                const next = response.primaryResults[0].rows().next();
                if (next.done) {
                    throw new Error("Failed to get authorization context - got empty results");
                }
                return next.value.toJSON<{ AuthorizationContext: string }>().AuthorizationContext;
            } catch (error: unknown) {
                if (!(error instanceof KustoDataErrors.ThrottlingError)) {
                    throw error;
                }
                await retry.backoff();
            }
        }
        throw new Error(`Failed to get identity token from server - the request was throttled ${ATTEMPT_COUNT} times.`);
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
