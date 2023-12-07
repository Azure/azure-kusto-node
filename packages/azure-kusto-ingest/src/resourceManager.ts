// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Client, KustoDataErrors, TimeUtils } from "azure-kusto-data";
import { ExponentialRetry } from "./retry";
import { ContainerClient } from "@azure/storage-blob";
import { TableClient } from "@azure/data-tables";
import { RankedStorageAccountSet } from "./rankedStorageAccountSet";
import { QueueClient } from "@azure/storage-queue";

const ATTEMPT_COUNT = 4;

export enum ResourceType {
    Queue,
    Container,
    Table,
}

export class ResourceURI {
    constructor(readonly uri: string, readonly accountName: string, readonly resourceType: ResourceType) {}
}

export class IngestClientResources {
    constructor(
        readonly securedReadyForAggregationQueues: ResourceURI[] | null = null,
        readonly failedIngestionsQueues: ResourceURI[] | null = null,
        readonly successfulIngestionsQueues: ResourceURI[] | null = null,
        readonly containers: ResourceURI[] | null = null,
        readonly statusTable: ResourceURI[] | null = null
    ) {}

    valid() {
        const resources = [this.securedReadyForAggregationQueues, this.failedIngestionsQueues, this.failedIngestionsQueues, this.containers, this.statusTable];
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
    private rankedStorageAccountSet: RankedStorageAccountSet;

    constructor(readonly kustoClient: Client, readonly isBrowser: boolean = false) {
        this.refreshPeriod = TimeUtils.toMilliseconds(1, 0, 0);
        this.refreshPeriodOnError = TimeUtils.toMilliseconds(0, 10, 0);

        this.ingestClientResources = null;
        this.ingestClientResourcesLastUpdate = null;

        this.authorizationContext = null;
        this.authorizationContextLastUpdate = null;

        this.rankedStorageAccountSet = new RankedStorageAccountSet();
    }

    async refreshIngestClientResources(): Promise<IngestClientResources> {
        const error = await this.tryRefresh(false);
        if (!this.ingestClientResources) {
            throw new Error(`Failed to fetch ingestion resources from service.  ${error?.message}.\n ${error?.stack}`);
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
                const resoures = new IngestClientResources(
                    this.getResourceByName(table, "SecuredReadyForAggregationQueue", ResourceType.Queue),
                    this.getResourceByName(table, "FailedIngestionsQueue", ResourceType.Queue),
                    this.getResourceByName(table, "SuccessfulIngestionsQueue", ResourceType.Queue),
                    this.getResourceByName(table, "TempStorage", ResourceType.Container),
                    this.getResourceByName(table, "IngestionsStatusTable", ResourceType.Table)
                );

                if (!resoures.valid()) {
                    throw new Error("Unexpected error occured - fetched data returned missing resource");
                }

                return resoures;
            } catch (error: unknown) {
                if (!(error instanceof KustoDataErrors.ThrottlingError)) {
                    throw error;
                }
                await retry.backoff();
            }
        }
        throw new Error(`Failed to get ingestion resources from server - the request was throttled ${ATTEMPT_COUNT} times.`);
    }

    getResourceByName(table: { rows: () => any }, resourceName: string, resourceType: ResourceType): ResourceURI[] {
        const result: ResourceURI[] = [];
        for (const row of table.rows()) {
            const typedRow = row as {
                ResourceTypeName: string;
                StorageRoot: string;
            };
            if (typedRow.ResourceTypeName === resourceName) {
                let accountName = "";
                if (resourceType === ResourceType.Queue) {
                    accountName = new QueueClient(typedRow.StorageRoot).accountName;
                } else if (resourceType === ResourceType.Container) {
                    accountName = new ContainerClient(typedRow.StorageRoot).accountName;
                }
                result.push(new ResourceURI(typedRow.StorageRoot, accountName, resourceType));
            }
        }
        return result;
    }

    pupulateStorageAccounts() {
        if (this.ingestClientResources == null) {
            return;
        }

        // containers
        const accounts = new Set<string>();
        if (this.ingestClientResources.containers != null) {
            for (const container of this.ingestClientResources.containers) {
                accounts.add(container.accountName);
            }
        }
        // queues
        if (this.ingestClientResources.securedReadyForAggregationQueues != null) {
            for (const queue of this.ingestClientResources.securedReadyForAggregationQueues) {
                accounts.add(queue.accountName);
            }
        }

        for (const account of accounts) {
            this.rankedStorageAccountSet.registerStorageAccount(account);
        }
    }

    groupResourcesByStorageAccount(resources: ResourceURI[]): Map<string, ResourceURI[]> {
        const result = new Map<string, ResourceURI[]>();
        for (const resource of resources) {
            if (!result.has(resource.accountName)) {
                result.set(resource.accountName, []);
            }
            result.get(resource.accountName)?.push(resource);
        }
        return result;
    }

    getRankedAndShuffledStorageAccounts(resources: ResourceURI[]): ResourceURI[][] {
        const resourcesByAccount = this.groupResourcesByStorageAccount(resources);
        const rankedStorageAccounts = this.rankedStorageAccountSet.getRankedShuffledAccounts();
        const result = new Array<ResourceURI[]>();
        for (const account of rankedStorageAccounts) {
            const accountName = account.getAccountName();
            if (resourcesByAccount.has(accountName)) {
                result.push(resourcesByAccount.get(accountName) as ResourceURI[]);
            }
        }
        return result;
    }

    getRoundRobinRankedAndShuffledResources(resources: ResourceURI[]): ResourceURI[] {
        const rankedAccounts = this.getRankedAndShuffledStorageAccounts(resources);
        const result = new Array<ResourceURI>();
        let index = 0;
        while (result.length < resources.length) {
            const account = rankedAccounts[index % rankedAccounts.length];
            if (account.length > 0) {
                result.push(account.shift() as ResourceURI);
            }
            index++;
        }
        return result;
    }

    async refreshAuthorizationContext(): Promise<string> {
        const error = await this.tryRefresh(true);

        if (this.authorizationContext == null) {
            throw new Error(`Failed to fetch Authorization context from service.  ${error?.message}.\n ${error?.stack}`);
        }

        return this.authorizationContext;
    }

    async tryRefresh(isAuthContextFetch: boolean): Promise<Error | null> {
        const resource = isAuthContextFetch ? this.authorizationContext?.trim() : this.ingestClientResources;
        const lastRefresh = isAuthContextFetch ? this.authorizationContextLastUpdate : this.ingestClientResourcesLastUpdate;
        const now = Date.now();
        let error: Error | null = null;
        if (!resource || !lastRefresh || lastRefresh + this.refreshPeriod <= now) {
            try {
                if (isAuthContextFetch) {
                    this.authorizationContext = await this.getAuthorizationContextFromService();
                    this.authorizationContextLastUpdate = now;
                } else {
                    this.ingestClientResources = await this.getIngestClientResourcesFromService();
                    this.ingestClientResourcesLastUpdate = now;
                    this.pupulateStorageAccounts();
                }
            } catch (e) {
                error = e as Error;
            }
        }

        return error;
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
        const queues = (await this.refreshIngestClientResources()).securedReadyForAggregationQueues;
        return queues ? this.getRoundRobinRankedAndShuffledResources(queues) : null;
    }

    async getFailedIngestionsQueues() {
        return (await this.refreshIngestClientResources()).failedIngestionsQueues;
    }

    async getSuccessfulIngestionsQueues() {
        return (await this.refreshIngestClientResources()).successfulIngestionsQueues;
    }

    async getContainers() {
        const containers = (await this.refreshIngestClientResources()).containers;
        return containers ? this.getRoundRobinRankedAndShuffledResources(containers) : null;
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

    async getStatusTable() {
        return (await this.refreshIngestClientResources()).statusTable;
    }

    close() {
        this.kustoClient.close();
    }

    reportResourceUsageResult(accountName: string, success: boolean) {
        this.rankedStorageAccountSet.logResultToAccount(accountName, success);
    }
}

export const createStatusTableClient = (uri: string): TableClient => {
    const tableUrl = new URL(uri);
    const origin = tableUrl.origin;
    const sasToken = tableUrl.search;
    const tableName = tableUrl.pathname.replace("/", "");
    return new TableClient(origin + sasToken, tableName);
};

export default ResourceManager;
