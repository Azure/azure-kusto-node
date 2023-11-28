// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";

import { BlobDescriptor } from "./descriptors";

import ResourceManager from "./resourceManager";

import IngestionBlobInfo from "./ingestionBlobInfo";

import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";

import { IngestionPropertiesInput, ReportLevel, ReportMethod } from "./ingestionProperties";
import { AbstractKustoClient } from "./abstractKustoClient";
import { OperationStatus, IngestionStatus } from "./ingestionResult";
import { TableClient, TableEntity } from "@azure/data-tables";

export abstract class KustoIngestClientBase extends AbstractKustoClient {
    resourceManager: ResourceManager;

    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput, isBrowser?: boolean) {
        super(defaultProps);
        const kustoClient = new KustoClient(kcsb);
        this.resourceManager = new ResourceManager(kustoClient, isBrowser);
        this.defaultDatabase = kustoClient.defaultDatabase;
    }

    async ingestFromBlob(blob: string | BlobDescriptor, ingestionProperties?: IngestionPropertiesInput): Promise<QueueSendMessageResponse> {
        this.ensureOpen();

        const props = this._getMergedProps(ingestionProperties);

        const descriptor = blob instanceof BlobDescriptor ? blob : new BlobDescriptor(blob);
        const queues = await this.resourceManager.getIngestionQueues();
        if (queues == null) {
            throw new Error("Failed to get queues");
        }

        const authorizationContext = await this.resourceManager.getAuthorizationContext();

        const queueDetails = queues[Math.floor(Math.random() * queues.length)];

        const queueClient = new QueueClient(queueDetails.uri);

        const ingestionBlobInfo = new IngestionBlobInfo(descriptor, props, authorizationContext);
        const ingestionBlobInfoJson = JSON.stringify(ingestionBlobInfo);
        const encoded = Buffer.from(ingestionBlobInfoJson).toString("base64");

        const reportToTable = props.reportLevel !== ReportLevel.DoNotReport &&
            props.reportMethod !== ReportMethod.Queue;
        if (reportToTable) {
            const statusTableClient: TableClient = await this.resourceManager.getStatusTableClient();
            const time = Date.now().toString()
            const status = {
                Status: "Pending",
                partitionKey: ingestionBlobInfo.Id,
                rowKey: ingestionBlobInfo.Id,
                Timestamp: time,
                IngestionSourceId: ingestionBlobInfo.Id,
                IngestionSourcePath: descriptor.path.split(/[?;]/)[0],
                Database: props.database,
                Table: props.table,
                UpdatedOn: time,
                Details: '',

            } as TableEntity<IngestionStatus>;
            await statusTableClient.createEntity(status);
            // ingestionBlobInfo.setIngestionStatusInTable(status);
            // IngestionStatusInTableDescription ingestionStatusInTable = new IngestionStatusInTableDescription();
            // ingestionStatusInTable.setTableClient(statusTable.getTable());
            // ingestionStatusInTable.setTableConnectionString(statusTable.getUri());
            // ingestionStatusInTable.setPartitionKey(ingestionBlobInfo.getId().toString());
            // ingestionStatusInTable.setRowKey(ingestionBlobInfo.getId().toString());
            // ingestionBlobInfo.setIngestionStatusInTable(ingestionStatusInTable);
            // statusTableClient.azureTableInsertEntity(statusTable.getTable(), new TableEntity(id, id).setProperties(status.getEntityProperties()));
            // tableStatuses.add(ingestionBlobInfo.getIngestionStatusInTable());

        }
return queueClient.sendMessage(encoded);
    }

    close() {
        if (!this._isClosed) {
            this.resourceManager.close();
        }
        super.close();
    }
}

export default KustoIngestClientBase;
