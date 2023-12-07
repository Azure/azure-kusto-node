// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";

import ResourceManager, { createStatusTableClient } from "./resourceManager";

import IngestionBlobInfo from "./ingestionBlobInfo";
import { ContainerClient } from "@azure/storage-blob";

import { QueueClient } from "@azure/storage-queue";

import { IngestionPropertiesInput, ReportLevel, ReportMethod } from "./ingestionProperties";
import { AbstractKustoClient } from "./abstractKustoClient";
import { IngestionStatus, TableReportIngestionResult, IngestionResult, IngestionStatusInTableDescription, IngestionStatusResult } from "./ingestionResult";
import { TableEntity } from "@azure/data-tables";
import { Readable } from "stream";

import { BlobDescriptor, StreamDescriptor } from "./descriptors";

export abstract class KustoIngestClientBase extends AbstractKustoClient {
    resourceManager: ResourceManager;

    static readonly MaxNumberOfRetryAttempts = 3;

    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput, isBrowser?: boolean) {
        super(defaultProps);
        const kustoClient = new KustoClient(kcsb);
        this.resourceManager = new ResourceManager(kustoClient, isBrowser);
        this.defaultDatabase = kustoClient.defaultDatabase;
    }

    async ingestFromBlob(
        blob: string | BlobDescriptor,
        ingestionProperties?: IngestionPropertiesInput,
        maxRetries: number = KustoIngestClientBase.MaxNumberOfRetryAttempts
    ): Promise<IngestionResult> {
        this.ensureOpen();

        const props = this._getMergedProps(ingestionProperties);

        const descriptor = blob instanceof BlobDescriptor ? blob : new BlobDescriptor(blob);

        const authorizationContext = await this.resourceManager.getAuthorizationContext();
        const ingestionBlobInfo = new IngestionBlobInfo(descriptor, props, authorizationContext);

        const reportToTable = props.reportLevel !== ReportLevel.DoNotReport && props.reportMethod !== ReportMethod.Queue;

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
                Details: "",
            } as TableEntity<IngestionStatus>;
            await statusTableClient.createEntity(status);
            const desc = new IngestionStatusInTableDescription(statusTableUri![0].uri, ingestionBlobInfo.Id, ingestionBlobInfo.Id);
            ingestionBlobInfo.IngestionStatusInTable = desc;
            await this.sendQueueMessage(maxRetries, ingestionBlobInfo);
            return new TableReportIngestionResult(desc, statusTableClient);
        }

        await this.sendQueueMessage(maxRetries, ingestionBlobInfo);
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
            Details: "",
        } as IngestionStatus);
    }

    private async sendQueueMessage(maxRetries: number, blobInfo: IngestionBlobInfo) {
        const queues = await this.resourceManager.getIngestionQueues();
        if (queues == null) {
            throw new Error("Failed to get queues");
        }
        const ingestionBlobInfoJson = JSON.stringify(blobInfo);
        const encoded = Buffer.from(ingestionBlobInfoJson).toString("base64");
        const retryCount = Math.min(maxRetries, queues.length);

        for (let i = 0; i < retryCount; i++) {
            const queueClient = new QueueClient(queues[i].uri);
            try {
                const queueResponse = await queueClient.sendMessage(encoded);
                this.resourceManager.reportResourceUsageResult(queueClient.accountName, true);
                return queueResponse;
            } catch (_) {
                this.resourceManager.reportResourceUsageResult(queueClient.accountName, false);
            }
        }

        throw new Error("Failed to send message to queue.");
    }

    async uploadToBlobWithRetry(
        descriptor: string | Blob | ArrayBuffer | StreamDescriptor,
        blobName: string,
        maxRetries: number = KustoIngestClientBase.MaxNumberOfRetryAttempts
    ): Promise<string> {
        const containers = await this.resourceManager.getContainers();

        if (containers == null || containers.length === 0) {
            throw new Error("Failed to get containers");
        }

        const retryCount = Math.min(maxRetries, containers.length);

        // Go over all containers and try to upload the file to the first one that succeeds
        for (let i = 0; i < retryCount; i++) {
            const containerClient = new ContainerClient(containers[i].uri);
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            try {
                if (typeof descriptor == "string") {
                    await blockBlobClient.uploadFile(descriptor);
                } else if (descriptor instanceof StreamDescriptor) {
                    if (descriptor.stream instanceof Buffer) {
                        await blockBlobClient.uploadData(descriptor.stream as Buffer);
                    } else {
                        await blockBlobClient.uploadStream(descriptor.stream as Readable);
                    }
                } else {
                    await blockBlobClient.uploadData(descriptor);
                }
                this.resourceManager.reportResourceUsageResult(containerClient.accountName, true);
                return blockBlobClient.url;
            } catch (ex) {
                this.resourceManager.reportResourceUsageResult(containerClient.accountName, false);
            }
        }

        throw new Error("Failed to upload to blob.");
    }

    close() {
        if (!this._isClosed) {
            this.resourceManager.close();
        }
        super.close();
    }
}

export default KustoIngestClientBase;
