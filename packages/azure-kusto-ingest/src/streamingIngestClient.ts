// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IngestionPropertiesInput } from "./ingestionProperties";

import { CompressionType, StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor";
import zlib from "zlib";
import { AbstractKustoClient } from "./abstractKustoClient";
import { Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";
import { KustoResponseDataSet } from "azure-kusto-data/src/response";
import { fileToStream } from "./streamUtils";
import { Readable } from "stream";
import { isNode } from "@azure/core-util";
import { tryFileToBuffer } from "./streamUtils";

class KustoStreamingIngestClient extends AbstractKustoClient {
    private kustoClient: KustoClient;

    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput) {
        super(defaultProps);
        this.kustoClient = new KustoClient(kcsb);
        this.defaultDatabase = this.kustoClient.defaultDatabase;
    }

    async ingestFromStream(stream: StreamDescriptor | Readable, ingestionProperties?: IngestionPropertiesInput, clientRequestId?: string): Promise<any> {
        const props = this._getMergedProps(ingestionProperties);
        const descriptor: StreamDescriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);

        const compressedStream = descriptor.compressionType === CompressionType.None
            ? (!(descriptor.stream instanceof ArrayBuffer) ? descriptor.stream.pipe(zlib.createGzip()) : descriptor.stream)
            : descriptor.stream;
        return await this.kustoClient.executeStreamingIngest(
            props.database as string,
            props.table as string,
            compressedStream,
            props.format,
            props.ingestionMappingReference ?? null,
            clientRequestId
        );
    }

    async ingestFromFile(file: FileDescriptor | string, ingestionProperties?: IngestionPropertiesInput): Promise<KustoResponseDataSet> {
        const descriptor: FileDescriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);
        return this.ingestFromStream(isNode ? await fileToStream(descriptor) : await tryFileToBuffer(descriptor), ingestionProperties);
    }
}

export default KustoStreamingIngestClient;
