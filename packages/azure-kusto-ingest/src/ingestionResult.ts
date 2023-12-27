// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { TableClient, TableEntity } from "@azure/data-tables";
import { ExponentialRetry } from "./retry";
import { createStatusTableClient } from "./resourceManager";
export interface IngestionResult {
    /// <summary>
    /// Retrieves the detailed ingestion status of
    /// all data ingestion operations into Kusto associated with this IKustoIngestionResult instance.
    /// </summary>
    getIngestionStatusCollection(): Promise<IngestionStatus>;
}

export const putRecordInTable = async (tableClient: TableClient, entity: TableEntity<IngestionStatus>): Promise<void> => {
    const retry = new ExponentialRetry(3, 1, 1);
    while (retry.shouldTry()) {
        try {
            await tableClient.createEntity(entity);
        } catch (ex) {
            await retry.backoff();
        }
    }
};

export enum OperationStatus {
    Pending = "Pending",
    Succeede = "Succeeded",
    Failed = "Failed",
    Queued = "Queued",
    Skipped = "Skipped",
    PartiallySucceeded = "PartiallySucceeded",
}

export class TableReportIngestionResult implements IngestionResult {
    public constructor(private ingestionStatusInTableDescription: IngestionStatusInTableDescription, public tableClient: TableClient | null = null) {}

    public async getIngestionStatusCollection(): Promise<IngestionStatus> {
        if (!this.tableClient) {
            this.tableClient = createStatusTableClient(this.ingestionStatusInTableDescription.tableConnectionString);
        }

        return await this.tableClient.getEntity<IngestionStatus>(
            this.ingestionStatusInTableDescription.partitionKey,
            this.ingestionStatusInTableDescription.rowKey
        );
    }
}

export class IngestionStatusResult implements IngestionResult {
    constructor(private ingestionStatus: IngestionStatus) {
        this.ingestionStatus = ingestionStatus;
    }

    public getIngestionStatusCollection(): Promise<IngestionStatus> {
        return Promise.resolve(this.ingestionStatus);
    }
}

export class IngestionStatusInTableDescription {
    constructor(public tableConnectionString: string, public partitionKey: string, public rowKey: string) {}
}

export interface IngestionStatus {
    Timestamp: string;
    Status: OperationStatus;
    IngestionSourceId: string;
    IngestionSourcePath: string;
    Database: string;
    Table: string;
    UpdatedOn: string;
    Details: string;
}
