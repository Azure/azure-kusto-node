// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IngestionPropertiesInput } from "./ingestionProperties";

import { AbstractDescriptor, BlobDescriptor, StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor";
import { AbstractKustoClient } from "./abstractKustoClient";
import { KustoConnectionStringBuilder } from "azure-kusto-data";
import { KustoResponseDataSet } from "azure-kusto-data/src/response";
import StreamingIngestClient from "./streamingIngestClient";
import { tryFileToBuffer, tryStreamToArray } from "./streamUtils";
import IngestClient from "./ingestClient";
import { QueueSendMessageResponse } from "@azure/storage-queue";
import streamify from "stream-array";
import { Readable } from "stream";
import { ExponentialRetry } from "./retry";
import { isNode } from "@azure/core-util";
import { BlobServiceClient } from "@azure/storage-blob";

const maxStreamSize = 1024 * 1024 * 4;
const attemptCount = 3;
const ingestPrefix = "https://ingest-";

class KustoManagedStreamingIngestClient extends AbstractKustoClient {
    private streamingIngestClient: StreamingIngestClient;
    private queuedIngestClient: IngestClient;
    private baseSleepTimeSecs = 1;
    private baseJitterSecs = 1;

    /**
     * Creates a KustoManagedStreamingIngestClient from a DM connection string.
     * This method infers the engine connection string.
     * For advanced usage, use the constructor that takes a DM connection string and an engine connection string.
     *
     * @param dmConnectionString The DM connection string.
     * @param defaultProps The default ingestion properties.
     */
    static fromDmConnectionString(
        dmConnectionString: KustoConnectionStringBuilder,
        defaultProps?: IngestionPropertiesInput
    ): KustoManagedStreamingIngestClient {
        if (dmConnectionString.dataSource == null || !dmConnectionString.dataSource.startsWith(ingestPrefix)) {
            throw new Error(`DM connection string must include the prefix '${ingestPrefix}'`);
        }

        const engineConnectionString = KustoConnectionStringBuilder.fromExisting(dmConnectionString);
        engineConnectionString.dataSource = engineConnectionString.dataSource?.replace(ingestPrefix, "https://");

        return new KustoManagedStreamingIngestClient(engineConnectionString, dmConnectionString, defaultProps);
    }

    /**
     * Creates a KustoManagedStreamingIngestClient from a engine connection string.
     * This method infers the engine connection string.
     * For advanced usage, use the constructor that takes an engine connection string and an engine connection string.
     *
     * @param engineConnectionString The engine connection string.
     * @param defaultProps The default ingestion properties.
     */
    static fromEngineConnectionString(
        engineConnectionString: KustoConnectionStringBuilder,
        defaultProps?: IngestionPropertiesInput
    ): KustoManagedStreamingIngestClient {
        if (engineConnectionString.dataSource == null || engineConnectionString.dataSource.startsWith(ingestPrefix)) {
            throw new Error(`Engine connection string must not include the prefix '${ingestPrefix}'`);
        }

        const dmConnectionString = KustoConnectionStringBuilder.fromExisting(engineConnectionString);
        dmConnectionString.dataSource = dmConnectionString.dataSource?.replace("https://", ingestPrefix);

        return new KustoManagedStreamingIngestClient(engineConnectionString, dmConnectionString, defaultProps);
    }

    constructor(engineKcsb: string | KustoConnectionStringBuilder, dmKcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput) {
        super(defaultProps);
        this.streamingIngestClient = new StreamingIngestClient(engineKcsb, defaultProps);
        this.queuedIngestClient = new IngestClient(dmKcsb, defaultProps);

        if (this.streamingIngestClient.defaultDatabase && this.streamingIngestClient.defaultDatabase !== this.queuedIngestClient.defaultDatabase) {
            throw new Error(
                `Default database for streaming ingest client (${this.streamingIngestClient.defaultDatabase}) must match default database for queued ingest client (${this.queuedIngestClient.defaultDatabase})`
            );
        }

        this.defaultDatabase = this.streamingIngestClient.defaultDatabase;
    }

    /**
     * Use Readable for Node.js and ArrayBuffer in browser
     */
    async ingestFromStream(
        stream: StreamDescriptor | Readable | ArrayBuffer,
        ingestionProperties?: IngestionPropertiesInput,
        clientRequestId?: string
    ): Promise<any> {
        this.ensureOpen();
        const props = this._getMergedProps(ingestionProperties);
        let descriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);
        const result = isNode ? await tryStreamToArray(descriptor.stream as Readable, maxStreamSize) : descriptor.stream;
        descriptor = new StreamDescriptor(result).merge(descriptor);
        let streamingResult: Promise<any> | null = null;
        if ((isNode && result instanceof Buffer) || !isNode) {
            streamingResult = await this.streamWithRetry(
                isNode ? descriptor.size ?? 0 : (descriptor.stream as ArrayBuffer).byteLength,
                descriptor,
                props,
                clientRequestId,
                result
            );
        }

        return streamingResult ?? this.queuedIngestClient.ingestFromStream(new StreamDescriptor(result).merge(descriptor), props);
    }

    /**
     * Use string for Node.js and Blob in browser
     */
    async ingestFromFile(
        file: FileDescriptor | string | Blob,
        ingestionProperties?: IngestionPropertiesInput
    ): Promise<KustoResponseDataSet | QueueSendMessageResponse> {
        this.ensureOpen();

        const stream = file instanceof FileDescriptor ? await tryFileToBuffer(file) : await tryFileToBuffer(new FileDescriptor(file));
        return await this.ingestFromStream(stream, ingestionProperties);
    }

    async ingestFromBlob(blob: string | BlobDescriptor, ingestionProperties?: IngestionPropertiesInput, clientRequestId?: string): Promise<any> {
        const props = this._getMergedProps(ingestionProperties);
        const descriptor = blob instanceof BlobDescriptor ? blob : new BlobDescriptor(blob);
        // No need to check blob size if it was given to us that it's not empty
        if (descriptor.size === 0) {
            const blobClient = new BlobServiceClient(descriptor.path);
            const blobProps = await blobClient.getProperties();
            const length = parseInt(blobProps._response.headers.get("contentLength") || "0", 10);
            if (length === 0) {
                throw new Error("Empty blob.");
            }
            descriptor.size = length;
        }

        const streamingResult = await this.streamWithRetry(length, descriptor, props, clientRequestId);
        return streamingResult ?? this.queuedIngestClient.ingestFromBlob(descriptor, props);
    }

    async streamWithRetry(
        length: number,
        descriptor: AbstractDescriptor,
        props?: IngestionPropertiesInput,
        clientRequestId?: string,
        stream?: Readable | ArrayBuffer
    ): Promise<any> {
        const isBlob = descriptor instanceof BlobDescriptor;
        if (length <= maxStreamSize) {
            // If we get buffer that means it was less than the max size, so we can do streamingIngestion
            const retry = new ExponentialRetry(attemptCount, this.baseSleepTimeSecs, this.baseJitterSecs);
            while (retry.shouldTry()) {
                try {
                    const sourceId =
                        clientRequestId ??
                        `KNC.executeManagedStreamingIngest${isBlob ? "FromBlob" : "FromStream"};${descriptor.sourceId};${retry.currentAttempt}`;
                    return isBlob
                        ? this.streamingIngestClient.ingestFromBlob(descriptor as BlobDescriptor, props, sourceId)
                        : isNode
                        ? await this.streamingIngestClient.ingestFromStream(
                              new StreamDescriptor(streamify([stream])).merge(descriptor as StreamDescriptor),
                              props,
                              sourceId
                          )
                        : await this.streamingIngestClient.ingestFromStream(descriptor as StreamDescriptor, props, sourceId);
                } catch (err: unknown) {
                    const oneApiError = err as { "@permanent"?: boolean };
                    if (oneApiError["@permanent"]) {
                        throw err;
                    }
                    await retry.backoff();
                }
            }

            stream = isBlob ? undefined : isNode ? streamify([stream]) : (descriptor as StreamDescriptor).stream;
        }

        return null;
    }

    close() {
        if (!this._isClosed) {
            this.streamingIngestClient.close();
            this.queuedIngestClient.close();
        }
        super.close();
    }
}

export default KustoManagedStreamingIngestClient;
