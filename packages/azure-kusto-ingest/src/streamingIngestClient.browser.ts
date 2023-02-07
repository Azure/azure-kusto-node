// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IngestionPropertiesInput } from "./ingestionProperties";

import { StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor.browser";
import { AbstractKustoClient } from "./abstractKustoClient";
import { Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";
import { KustoResponseDataSet } from "azure-kusto-data/src/response";
import { tryFileToBuffer } from "./streamUtils.browser";

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
    async ingestFromStream(stream: StreamDescriptor | ArrayBuffer, ingestionProperties?: IngestionPropertiesInput, clientRequestId?: string): Promise<any> {
        this.ensureOpen();

        const props = this._getMergedProps(ingestionProperties);
        const descriptor: StreamDescriptor = stream instanceof StreamDescriptor ? stream : new StreamDescriptor(stream);
        return await this.kustoClient.executeStreamingIngest(
            props.database as string,
            props.table as string,
            descriptor.stream,
            props.format,
            props.ingestionMappingReference ?? null,
            clientRequestId
        );
    }

    /**
     * Use string for Node.js and Blob in browser
     */
    async ingestFromFile(file: FileDescriptor | Blob, ingestionProperties?: IngestionPropertiesInput): Promise<KustoResponseDataSet> {
        this.ensureOpen();

        const descriptor: FileDescriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);
        return this.ingestFromStream(await tryFileToBuffer(descriptor), ingestionProperties);
    }

    close() {
        if (!this._isClosed) {
            this.kustoClient.close();
        }
        super.close();
    }
}

export default KustoStreamingIngestClient;
