// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const KustoClient = require("azure-kusto-data").Client;
const { FileDescriptor, StreamDescriptor, CompressionType } = require("./descriptors");
const DataFormat = require("./resourceManager"); 
const zlib = require("zlib");
const fs = require("fs");

module.exports = class KustoStreamingIngestClient {
    constructor(kcsb, defaultProps) {
        this.kustoClient = new KustoClient(kcsb);
        this.defaultProps = defaultProps;
        this._mapping_required_formats = Object.freeze([ DataFormat.JSON, DataFormat.SINGLEJSON, DataFormat.AVRO, DataFormat.ORC ]);
    }

    _mergeProps(newProperties) {
        // no default props
        if (newProperties == null || Object.keys(newProperties).length == 0) {
            return this.defaultProps;
        }

        // no new props
        if (this.defaultProps == null || Object.keys(this.defaultProps) == 0) {
            return newProperties;    
        }
        // both exist - merge
        return this.defaultProps.merge(newProperties);
    }
    
    async ingestFromStream(stream, ingestionProperties) {
        const props = this._mergeProps(ingestionProperties);
        props.validate();

        const descriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);
        const compressedStream  = 
            descriptor.compressionType == CompressionType.None ? descriptor.stream.pipe(zlib.createGzip()) : descriptor.stream;

        if (props.ingestionMappingReference == null && this._mapping_required_formats.includes(props.format)) {
            throw new Error(`Mapping referrence required for format ${props.foramt}.`);
        }

        return this.kustoClient.executeStreamingIngest(
            props.database, 
            props.table, 
            compressedStream, 
            props.format,
            props.ingestionMappingReference);
    }

    async ingestFromFile(file, ingestionProperties) {
        const props = this._mergeProps(ingestionProperties);
        props.validate();

        const fileDescriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);

        const stream = fs.createReadStream(fileDescriptor.filePath);

        const compressionType = fileDescriptor.zipped ? CompressionType.GZIP : CompressionType.None;
        const streamDescriptor = new StreamDescriptor(stream, fileDescriptor.sourceId, compressionType);

        return this.ingestFromStream(streamDescriptor, ingestionProperties);
    }
};
