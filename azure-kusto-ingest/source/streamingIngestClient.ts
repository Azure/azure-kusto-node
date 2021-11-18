// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IngestionProperties from "./ingestionProperties";

import {CompressionType, FileDescriptor, StreamDescriptor} from "./descriptors";
import zlib from "zlib";
import {AbstractKustoClient} from "./abstractKustoClient";
import {Client as KustoClient, KustoConnectionStringBuilder} from "azure-kusto-data";
import {KustoResponseDataSet} from "azure-kusto-data/source/response";
import { fileToStream } from "./utils";
import { Readable } from "stream";

class KustoStreamingIngestClient extends AbstractKustoClient {
    private kustoClient: KustoClient;
    // tslint:disable-next-line:variable-name

    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps: IngestionProperties | null = null) {
        super(defaultProps);
        this.kustoClient = new KustoClient(kcsb);
    }

    async ingestFromStream(stream: StreamDescriptor | Readable, ingestionProperties: IngestionProperties): Promise<any> {
        const props = this._mergeProps(ingestionProperties);
        props.validate();
        const descriptor: StreamDescriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);

        const compressedStream =
            descriptor.compressionType == CompressionType.None ? descriptor.stream.pipe(zlib.createGzip()) : descriptor.stream;
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
        return this.ingestFromStream(fileToStream(file), ingestionProperties);
    }
}

export default KustoStreamingIngestClient;