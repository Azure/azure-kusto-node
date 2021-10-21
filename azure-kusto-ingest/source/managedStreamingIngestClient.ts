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

// const maxRetries = 3
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
        // let x = ""
        const copyBuffer = new PassThrough()
        // buf.pipe(copyBuffer)
        // let copyBuffer2: PassThrough 
        // let j = 0;
        // try{
        //     copyBuffer.pipe(copyBuffer2)
        //     copyBuffer.on('data', function(chunk) {
        //         x+=chunk
        //         j++;
        //         console.log("j: " + j)
        //         if(j>=6){
        //             try{
        //             throw new Error()           
        //         }catch(e){
        // console.log(e)            
        //         }}
        //     });

        // }catch(e){

        // }
        // let y = 0
        // copyBuffer2.on('data', function(chunk) {
        //     y++;
        //     console.log("y: " + y)
        //     x+=chunk
        // });
        
        // console.log(x)
        let i = 0;
        for (; i < 1; i++) {
            // const copyBuffer = new PassThrough()
            try {
                buf.pipe(copyBuffer);
                    await this.streamingIngestClient.ingestFromStream(new StreamDescriptor(buf).merge(descriptor), ingestionProperties);
            } catch (err: any) {
                if (err['@permanent']) {
                    throw err;
                }
            }

            buf = copyBuffer
        }

        return await this.queuedIngestClient.ingestFromStream(
            new StreamDescriptor(buf).merge(descriptor)
            , ingestionProperties);
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