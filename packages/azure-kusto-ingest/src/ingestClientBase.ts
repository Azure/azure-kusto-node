// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";

import { BlobDescriptor } from "./descriptors";

import ResourceManager, { createStatusTableClient } from "./resourceManager";

import IngestionBlobInfo from "./ingestionBlobInfo";

import { QueueClient } from "@azure/storage-queue";

import { IngestionPropertiesInput, ReportLevel, ReportMethod } from "./ingestionProperties";
import { AbstractKustoClient } from "./abstractKustoClient";
import { IngestionStatus, TableReportIngestionResult, IngestionResult, IngestionStatusInTableDescription, IngestionStatusResult } from "./ingestionResult";
import { TableEntity } from "@azure/data-tables";

export abstract class KustoIngestClientBase extends AbstractKustoClient {
    resourceManager: ResourceManager;

    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput, isBrowser?: boolean) {
        super(defaultProps);
        const kustoClient = new KustoClient(kcsb);
        this.resourceManager = new ResourceManager(kustoClient, isBrowser);
        this.defaultDatabase = kustoClient.defaultDatabase;
    }

    async ingestFromBlob(blob: string | BlobDescriptor, ingestionProperties?: IngestionPropertiesInput): Promise<IngestionResult> {
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

        const reportToTable = props.reportLevel !== ReportLevel.DoNotReport &&
            props.reportMethod !== ReportMethod.Queue;

        const time = Date.now().toString();
        if (reportToTable) {
            const statusTableUri = await this.resourceManager.getStatusTable();
            const statusTableClient = createStatusTableClient(statusTableUri![0].uri);

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
            const desc = new IngestionStatusInTableDescription(statusTableUri![0].uri, ingestionBlobInfo.Id, ingestionBlobInfo.Id)
            ingestionBlobInfo.IngestionStatusInTable = desc;
            await this.sendQueueMessage(queueClient, ingestionBlobInfo);
            return new TableReportIngestionResult(desc, statusTableClient);
        }

        await this.sendQueueMessage(queueClient, ingestionBlobInfo);
        return new IngestionStatusResult({
            Status: "Queued",
            partitionKey: ingestionBlobInfo.Id,
            rowKey: ingestionBlobInfo.Id,
            Timestamp: time,
            IngestionSourceId: ingestionBlobInfo.Id,
            IngestionSourcePath: descriptor.path.split(/[?;]/)[0],
            Database: props.database,
            Table: props.table,
            UpdatedOn: time,
            Details: '',
        } as IngestionStatus);
    }

    private sendQueueMessage(queueClient: QueueClient, blobInfo: IngestionBlobInfo) {
        const ingestionBlobInfoJson = JSON.stringify(blobInfo);
        const encoded = Buffer.from(ingestionBlobInfoJson).toString("base64");
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
