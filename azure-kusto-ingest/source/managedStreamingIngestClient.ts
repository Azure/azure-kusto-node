// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IngestionProperties, {DataFormat, MappingRequiredFormats} from "./ingestionProperties";

import {CompressionType, FileDescriptor, StreamDescriptor} from "./descriptors";
import fs from "fs";
import {AbstractKustoClient} from "./abstractKustoClient";
import {KustoConnectionStringBuilder} from "azure-kusto-data";
import {KustoResponseDataSet} from "azure-kusto-data/source/response";
import StreamingIngestClient from "./streamingIngestClient";
import IngestClient from "./ingestClient";
import { QueueSendMessageResponse } from "@azure/storage-queue";
const toArray = require('stream-to-array');
const streamify = require('stream-array');

const maxRetries = 3
class KustoManagedStreamingIngestClient extends AbstractKustoClient {
    private streamingIngestClient: StreamingIngestClient;
    private queuedIngestClient: IngestClient;
    // tslint:disable-next-line:variable-name

    constructor(engineKcsb: string | KustoConnectionStringBuilder, dmKcsb: string | KustoConnectionStringBuilder, defaultProps: IngestionProperties | null = null) {
        super(defaultProps);
        this.streamingIngestClient = new StreamingIngestClient(engineKcsb);
        this.queuedIngestClient = new IngestClient(dmKcsb);
    }
    
    async ingestFromStream(stream: StreamDescriptor | fs.ReadStream, ingestionProperties: IngestionProperties): Promise<KustoResponseDataSet | QueueSendMessageResponse> {
        const props = this._mergeProps(ingestionProperties);
        props.validate();
        var descriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);
        const buf = (stream as StreamDescriptor)?.stream || stream;

        if (props.ingestionMappingReference == null && MappingRequiredFormats.includes(props.format as DataFormat)) {
            throw new Error(`Mapping reference required for format ${props.foramt}.`);
        }

        const buffer = await toArray(buf);

        for (let i = 0; i < maxRetries; i++) {
            try {
                 return await this.streamingIngestClient.ingestFromStream({...descriptor, stream: streamify(buffer)}, ingestionProperties);
            } catch (err: any) {
                if (err['@permanent']) {
                    throw err;
                }
            }
        }
        return await this.queuedIngestClient.ingestFromStream({...descriptor, stream: streamify(buffer)}, ingestionProperties);
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