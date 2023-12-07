// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { TableClient, TableEntity } from "@azure/data-tables";
import { ExponentialRetry } from "./retry";
import { createStatusTableClient } from "./resourceManager";
export interface IngestionResult
{
    /// <summary>
    /// Retrieves the detailed ingestion status of
    /// all data ingestion operations into Kusto associated with this IKustoIngestionResult instance.
    /// </summary>
    getIngestionStatusCollection() : Promise<IngestionStatus>;
}

export const putRecordInTable = async (
    tableClient: TableClient,
    database: string,
    blobPath: string,
    table: string,
    partitionKey: string,
    rowKey: string,
    error?: string
): Promise<void> => {
    const status = error !== undefined ? 'Failed' : 'Pending';
    const blobBasePath = blobPath.split(/[?;]/)[0];
    const timestamp = Date.now();
    const entity: TableEntity<IngestionStatus> = {
        partitionKey,
        rowKey,
        Timestamp: timestamp.toString(),
        Status: status,
        IngestionSourceId: rowKey,
        IngestionSourcePath: blobBasePath,
        Database: database,
        Table: table,
        UpdatedOn: timestamp.toString(),
        Details: error || '',
    };
    const retry = new ExponentialRetry(3, 1, 1);
    while (retry.shouldTry()) {
        try {
            await tableClient.createEntity(entity);
        } catch (ex) {
            await retry.backoff();
        }
    }

}
export type OperationStatus = "Pending" | "Succeeded" | "Failed" | "Queued" | "Skipped" |"PartiallySucceeded"

export class TableReportIngestionResult implements IngestionResult {
    public constructor(private ingestionStatusInTableDescription: IngestionStatusInTableDescription,
                       public tableClient: TableClient | null = null) {
    }

    public async getIngestionStatusCollection(): Promise<IngestionStatus> {
        if(!this.tableClient){
            this.tableClient = createStatusTableClient(this.ingestionStatusInTableDescription.tableConnectionString)
        }

        const t =  await this.tableClient.getEntity(this.ingestionStatusInTableDescription.partitionKey,this.ingestionStatusInTableDescription.rowKey);
        return t as unknown as IngestionStatus;
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
	constructor(public tableConnectionString: string, public partitionKey: string, public rowKey: string){

    }
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
