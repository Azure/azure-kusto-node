// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IngestionProperties from "./ingestionProperties";

import {FileDescriptor, StreamDescriptor} from "./descriptors";
import {AbstractKustoClient} from "./abstractKustoClient";
import {KustoConnectionStringBuilder} from "azure-kusto-data";
import {KustoResponseDataSet} from "azure-kusto-data/source/response";
import {fileToStream, getRandomSleep, sleep} from "./utils";
import StreamingIngestClient from "./streamingIngestClient";
import IngestClient from "./ingestClient";
import { QueueSendMessageResponse } from "@azure/storage-queue";
import streamify from "stream-array";
import toArray from "stream-to-array";
import { Readable } from "stream";

const maxSteamSize = 1024 * 1024 * 4;
const maxRetries = 3
class KustoManagedStreamingIngestClient extends AbstractKustoClient {
    private streamingIngestClient: StreamingIngestClient;
    private queuedIngestClient: IngestClient;
    private maxRetries: number;

    constructor(engineKcsb: string | KustoConnectionStringBuilder, dmKcsb: string | KustoConnectionStringBuilder, defaultProps: IngestionProperties | null = null) {
        super(defaultProps);
        this.streamingIngestClient = new StreamingIngestClient(engineKcsb);
        this.queuedIngestClient = new IngestClient(dmKcsb);
        this.maxRetries = maxRetries;
    }

    async ingestFromStream(stream: StreamDescriptor | Readable, ingestionProperties: IngestionProperties): Promise<any> {
        const props = this._mergeProps(ingestionProperties);
        props.validate();
        const descriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);

        const buffer: Buffer[] = await toArray(descriptor.stream);
        let sleepTime = 1000;
        const bufferSize = buffer.reduce((sum, b) => sum += b.length, 0);
        if (bufferSize <= maxSteamSize) {
            let i = 0;
            for (; i < this.maxRetries; i++) {
                try {
                    return await this.streamingIngestClient.ingestFromStream(new StreamDescriptor(streamify(buffer)).merge(descriptor), ingestionProperties);
                } catch (err: any) {
                    if (err['@permanent']) {
                        throw err;
                    }
                    await sleep(getRandomSleep(sleepTime));
                    sleepTime *= 2;
                }
            }
        }

        return await this.queuedIngestClient.ingestFromStream(new StreamDescriptor(streamify(buffer)).merge(descriptor), ingestionProperties);
    }

    async ingestFromFile(file: FileDescriptor | string, ingestionProperties: IngestionProperties): Promise<KustoResponseDataSet | QueueSendMessageResponse> {
        const props = this._mergeProps(ingestionProperties);
        props.validate();
        return await this.ingestFromStream(fileToStream(file), ingestionProperties);
    }
}

export default KustoManagedStreamingIngestClient;