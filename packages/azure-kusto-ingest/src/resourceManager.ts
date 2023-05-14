// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Client, KustoDataErrors, TimeUtils } from "azure-kusto-data";
import { ExponentialRetry } from "./retry";
import { ContainerClient } from "@azure/storage-blob";

const ATTEMPT_COUNT = 4;
export class ResourceURI {
    constructor(readonly uri: string) {}
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
    public readonly refreshPeriod: number;
    public refreshPeriodOnError: number;
    public ingestClientResources: IngestClientResources | null;
    public ingestClientResourcesLastUpdate: number | null;
    public authorizationContext: string | null;
    public authorizationContextLastUpdate: number | null;

    private baseSleepTimeSecs = 1;
    private baseJitterSecs = 1;
    private _isClosed: boolean = false;

    constructor(readonly kustoClient: Client, readonly isBrowser: boolean = false) {
        this.refreshPeriod = TimeUtils.toMilliseconds(1, 0, 0);
        this.refreshPeriodOnError = TimeUtils.toMilliseconds(0, 10, 0);

        this.ingestClientResources = null;
        this.ingestClientResourcesLastUpdate = null;

        this.authorizationContext = null;
        this.authorizationContextLastUpdate = null;
    }

    async refreshIngestClientResources(): Promise<IngestClientResources> {
        const now = Date.now();
        let error: Error | null = null;
        if (
            !this.ingestClientResources ||
            !this.ingestClientResourcesLastUpdate ||
            this.ingestClientResourcesLastUpdate + this.refreshPeriod <= now ||
            !this.ingestClientResources.valid()
        ) {
            try {
                this.ingestClientResources = await this.getIngestClientResourcesFromService();
                this.ingestClientResourcesLastUpdate = now;
            } catch (e) {
                error = e as Error;
                setTimeout(() => {
                    if (!this._isClosed) {
                        this.refreshIngestClientResources().catch(() => {});
                    }
                }, this.refreshPeriodOnError);
            }
        }

        if (!this.ingestClientResources) {
            throw new Error(`Failed to fetch ingestion resources from service.  ${error?.message}.\r\n ${error?.stack}`);
        }

        return this.ingestClientResources;
    }

    async getIngestClientResourcesFromService(): Promise<IngestClientResources> {
        const retry = new ExponentialRetry(ATTEMPT_COUNT, this.baseSleepTimeSecs, this.baseJitterSecs);
        while (retry.shouldTry()) {
            try {
                const cmd = `.get ingestion resources ${this.isBrowser ? `with (EnableBlobCors='true', EnableQueueCors='true', EnableTableCors='true')` : ""}`;
                const response = await this.kustoClient.execute("NetDefaultDB", cmd);
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
        const result: ResourceURI[] = [];
        for (const row of table.rows()) {
            const typedRow = row as {
                ResourceTypeName: string;
                StorageRoot: string;
            };
            if (typedRow.ResourceTypeName === resourceName) {
                result.push(new ResourceURI(typedRow.StorageRoot));
            }
        }
        return result;
    }

    async refreshAuthorizationContext(): Promise<string> {
        const now = Date.now();
        let error: Error | null = null;
        if (!this.authorizationContext?.trim() || !this.authorizationContextLastUpdate || this.authorizationContextLastUpdate + this.refreshPeriod <= now) {
            this.authorizationContext = await this.getAuthorizationContextFromService();
            this.authorizationContextLastUpdate = now;
            try {
                this.ingestClientResources = await this.getIngestClientResourcesFromService();
                this.ingestClientResourcesLastUpdate = now;
            } catch (e) {
                error = e as Error;
                setTimeout(() => {
                    if (!this._isClosed) {
                        this.refreshAuthorizationContext().catch(() => {});
                    }
                }, 1000 * 30);
            }
        }

        if (this.authorizationContext == null) {
            throw new Error(`Failed to fetch Authorization context from service.  ${error?.message}.\r\n ${error?.stack}`);
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

    async getBlockBlobClient(blobName: string) {
        const containers = await this.getContainers();
        if (containers == null) {
            throw new Error("Failed to get containers");
        }
        const container = containers[Math.floor(Math.random() * containers.length)];
        const containerClient = new ContainerClient(container.uri);
        return containerClient.getBlockBlobClient(blobName);
    }

    close() {
        this.kustoClient.close();
        this._isClosed = true;
    }
}

export default ResourceManager;
