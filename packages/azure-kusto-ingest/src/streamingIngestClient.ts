// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IngestionPropertiesInput } from "./ingestionProperties";

import { CompressionType, StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor";
import zlib from "zlib";
import { AbstractKustoClient } from "./abstractKustoClient";
import { Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";
import { KustoResponseDataSet } from "azure-kusto-data/src/response";
import { fileToStream, tryFileToBuffer } from "./streamUtils";
import { isNode } from "@azure/core-util";
import { Readable } from "stream";

class KustoStreamingIngestClient extends AbstractKustoClient {
    private kustoClient: KustoClient;
    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput) {
        super(defaultProps);
        this.kustoClient = new KustoClient(kcsb);
        this.defaultDatabase = this.kustoClient.defaultDatabase;
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
        return this.ingestFromStream(isNode ? await fileToStream(descriptor) : await tryFileToBuffer(descriptor), ingestionProperties);
    }

    close() {
        if (!this._isClosed) {
            this.kustoClient.close();
        }
        super.close();
    }
}

export default KustoStreamingIngestClient;
