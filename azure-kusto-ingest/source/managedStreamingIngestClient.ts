// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IngestionProperties from "./ingestionProperties";

import {CompressionType, FileDescriptor, StreamDescriptor} from "./descriptors";
import fs from "fs";
import {AbstractKustoClient} from "./abstractKustoClient";
import {KustoConnectionStringBuilder} from "azure-kusto-data";
import {KustoResponseDataSet} from "azure-kusto-data/source/response";
import StreamingIngestClient from "./streamingIngestClient";
import IngestClient from "./ingestClient";
import { QueueSendMessageResponse } from "@azure/storage-queue";
import { PassThrough } from "stream";

const maxRetries = 3
class KustoManagedStreamingIngestClient extends AbstractKustoClient {
    private streamingIngestClient: StreamingIngestClient;
    private queuedIngestClient: IngestClient;

    constructor(engineKcsb: string | KustoConnectionStringBuilder, dmKcsb: string | KustoConnectionStringBuilder, defaultProps: IngestionProperties | null = null) {
        super(defaultProps);
        this.streamingIngestClient = new StreamingIngestClient(engineKcsb);
        this.queuedIngestClient = new IngestClient(dmKcsb);
    }

    async ingestFromStream(stream: StreamDescriptor | fs.ReadStream, ingestionProperties: IngestionProperties): Promise<KustoResponseDataSet | QueueSendMessageResponse> {
        const props = this._mergeProps(ingestionProperties);
        props.validate();
        const descriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);
        let buf = (stream as StreamDescriptor)?.stream || stream;

        let i = 0;
        for (; i < maxRetries; i++) {
            const copyBuffer = new PassThrough()
            try {
                buf.pipe(copyBuffer)
                return await this.streamingIngestClient.ingestFromStream(
                    {...descriptor, stream: buf}, ingestionProperties);
            } catch (err: any) {
                if (err['@permanent']) {
                    throw err;
                }
            }

            buf = copyBuffer
        }

        return await this.queuedIngestClient.ingestFromStream({...descriptor, stream: buf}, ingestionProperties);
    }

    async ingestFromFile(file: FileDescriptor | string, ingestionProperties: IngestionProperties): Promise<KustoResponseDataSet | QueueSendMessageResponse> {
        const props = this._mergeProps(ingestionProperties);
        props.validate();
        const fileDescriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);
        const streamFs = fs.createReadStream(fileDescriptor.filePath);
        const compressionType = fileDescriptor.zipped ? CompressionType.GZIP : CompressionType.None;
        const streamDescriptor = new StreamDescriptor(streamFs, fileDescriptor.sourceId, compressionType);
        return await this.ingestFromStream(streamDescriptor, ingestionProperties);
    }
}

export default KustoManagedStreamingIngestClient;