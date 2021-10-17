// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IngestionProperties, {DataFormat} from "./ingestionProperties";

import {CompressionType, FileDescriptor, StreamDescriptor} from "./descriptors";
import fs from "fs";
import {AbstractKustoClient} from "./abstractKustoClient";
import {KustoConnectionStringBuilder} from "azure-kusto-data";
import {KustoResponseDataSet, KustoResponseDataSetV1} from "azure-kusto-data/source/response";
import StreamingIngestClient from "./streamingIngestClient";
import IngestClient from "./ingestClient";
const PassThrough = require('stream').PassThrough;
const toArray = require('stream-to-array');
var streamify = require('stream-array');

const maxRetries = 3
class KustoManagedStreamingIngestClient extends AbstractKustoClient {
    private streamingIngestClient: StreamingIngestClient;
    private queuedIngestClient: IngestClient;
    // tslint:disable-next-line:variable-name
    private _mapping_required_formats: readonly any[];

    constructor(engineKcsb: string | KustoConnectionStringBuilder, dmKcsb: string | KustoConnectionStringBuilder, defaultProps: IngestionProperties | null = null) {
        super(defaultProps);
        this.streamingIngestClient = new StreamingIngestClient(engineKcsb);
        this.queuedIngestClient = new IngestClient(dmKcsb);
        this._mapping_required_formats = Object.freeze([DataFormat.JSON, DataFormat.SINGLEJSON, DataFormat.AVRO, DataFormat.ORC]);
    }
    async ingestFromStream(stream: StreamDescriptor | fs.ReadStream, ingestionProperties: IngestionProperties): Promise<KustoResponseDataSet> {
        const props = this._mergeProps(ingestionProperties);
        props.validate();
        const buf = (stream as StreamDescriptor)?.stream || stream;
        if (props.ingestionMappingReference == null && this._mapping_required_formats.includes(props.format)) {
            throw new Error(`Mapping reference required for format ${props.foramt}.`);
        }

        var tmp = new PassThrough();
        const buffer = await toArray(tmp.pipe(buf));

        for (let i = 0; i < maxRetries; i++) {
            try {
                 return await this.streamingIngestClient.ingestFromStream(streamify(buffer), ingestionProperties);
            } catch (err: any) {
                if (err['@permanent']) {
                    throw err;
                }
            }
        }
        await this.queuedIngestClient.ingestFromStream(streamify(buffer), ingestionProperties);
        return new KustoResponseDataSetV1({Tables:[{TableName: "Table_0",Columns:[],Rows:[]}]});
    }

    async ingestFromFile(file: FileDescriptor | string, ingestionProperties: IngestionProperties): Promise<KustoResponseDataSet> {
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