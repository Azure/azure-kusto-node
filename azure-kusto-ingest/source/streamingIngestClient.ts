// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IngestionProperties, {DataFormat, MappingRequiredFormats} from "./ingestionProperties";

import {CompressionType, FileDescriptor, StreamDescriptor} from "./descriptors";
import zlib from "zlib";
import fs from "fs";
import {AbstractKustoClient} from "./abstractKustoClient";
import {Client as KustoClient, KustoConnectionStringBuilder} from "azure-kusto-data";
import {KustoResponseDataSet} from "azure-kusto-data/source/response";

class KustoStreamingIngestClient extends AbstractKustoClient {
    private kustoClient: KustoClient;
    // tslint:disable-next-line:variable-name

    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps: IngestionProperties | null = null) {
        super(defaultProps);
        this.kustoClient = new KustoClient(kcsb);
    }
    async ingestFromStream(stream: StreamDescriptor | fs.ReadStream, ingestionProperties: IngestionProperties): Promise<KustoResponseDataSet> {
        const props = this._mergeProps(ingestionProperties);
        props.validate();
        const descriptor: StreamDescriptor = stream.hasOwnProperty('stream') ? stream as StreamDescriptor : new StreamDescriptor(stream as fs.ReadStream);
        const compressedStream =
            descriptor.compressionType == CompressionType.None ? descriptor.stream.pipe(zlib.createGzip()) : descriptor.stream;
        if (props.ingestionMappingReference == null && MappingRequiredFormats.includes(props.format as DataFormat)) {
            throw new Error(`Mapping reference required for format ${props.foramt}.`);
        }
        return this.kustoClient.executeStreamingIngest(
            props.database as string,
            props.table as string,
            compressedStream,
            props.format,
            props.ingestionMappingReference ?? null);
    }
    async ingestFromFile(file: FileDescriptor | string, ingestionProperties: IngestionProperties): Promise<KustoResponseDataSet> {
        const props = this._mergeProps(ingestionProperties);
        props.validate();
        const fileDescriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);
        const stream = fs.createReadStream(fileDescriptor.filePath);
        const compressionType = fileDescriptor.zipped ? CompressionType.GZIP : CompressionType.None;
        const streamDescriptor = new StreamDescriptor(stream, fileDescriptor.sourceId, compressionType);
        return this.ingestFromStream(streamDescriptor, ingestionProperties);
    }
}

export default KustoStreamingIngestClient;