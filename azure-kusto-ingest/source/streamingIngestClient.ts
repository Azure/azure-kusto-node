// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IngestionProperties, {DataFormat} from "./ingestionProperties";

// @ts-ignore todo ts
import {Client as KustoClient} from "azure-kusto-data";
import {CompressionType, FileDescriptor, StreamDescriptor} from "./descriptors";
import zlib from "zlib";
import fs from "fs";
import {AbstractStreamingClient} from "./abstractStreamingClient";

class KustoStreamingIngestClient extends AbstractStreamingClient {
    private kustoClient: any;
    private _mapping_required_formats: readonly any[];

    constructor(kcsb: string, defaultProps: IngestionProperties | null = null) {
        super(defaultProps);
        this.kustoClient = new KustoClient(kcsb);
        this._mapping_required_formats = Object.freeze([DataFormat.JSON, DataFormat.SINGLEJSON, DataFormat.AVRO, DataFormat.ORC]);
    }
    async ingestFromStream(stream: StreamDescriptor | fs.ReadStream, ingestionProperties: IngestionProperties) {
        const props = this._mergeProps(ingestionProperties);
        props.validate();
        const descriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);
        const compressedStream =
            descriptor.compressionType == CompressionType.None ? descriptor.stream.pipe(zlib.createGzip()) : descriptor.stream;
        if (props.ingestionMappingReference == null && this._mapping_required_formats.includes(props.format)) {
            throw new Error(`Mapping reference required for format ${props.foramt}.`);
        }
        return this.kustoClient.executeStreamingIngest(
            props.database,
            props.table,
            compressedStream,
            props.format,
            props.ingestionMappingReference);
    }
    async ingestFromFile(file: FileDescriptor | string, ingestionProperties: IngestionProperties) {
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