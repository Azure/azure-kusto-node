// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IngestionPropertiesInput } from "./ingestionProperties";

import { KustoConnectionStringBuilder, KustoResponseDataSet } from "~/../azure-kusto-data";
import { Readable } from "stream";
import zlib from "zlib";
import { CompressionType, StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor";
import { fileToStream } from "./streamUtils";
import { KustoStreamingIngestClientBase } from "./streamingIngestClientBase";

export class StreamingIngestClient extends KustoStreamingIngestClientBase {
    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput) {
        super(kcsb, defaultProps);
    }

    /**
     * Use Readable for Node.js and ArrayBuffer in browser
     */
    async ingestFromStream(
        stream: StreamDescriptor | Readable | ArrayBuffer,
        ingestionProperties?: IngestionPropertiesInput,
        clientRequestId?: string
    ): Promise<any> {
        this.ensureOpen();

        const props = this._getMergedProps(ingestionProperties);
        const descriptor: StreamDescriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);

        const compressedStream =
            descriptor.compressionType === CompressionType.None
                ? !(descriptor.stream instanceof ArrayBuffer)
                    ? descriptor.stream.pipe(zlib.createGzip())
                    : descriptor.stream
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

    /**
     * Use string for Node.js and Blob in browser
     */
    async ingestFromFile(file: FileDescriptor | string | Blob, ingestionProperties?: IngestionPropertiesInput): Promise<KustoResponseDataSet> {
        this.ensureOpen();

        const descriptor: FileDescriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);
        return this.ingestFromStream(await fileToStream(descriptor), ingestionProperties);
    }
}
