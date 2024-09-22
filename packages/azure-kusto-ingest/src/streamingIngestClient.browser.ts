// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IngestionPropertiesInput } from "./ingestionProperties.js";

import { KustoConnectionStringBuilder, KustoResponseDataSet } from "azure-kusto-data";
import { StreamDescriptor } from "./descriptors.js";
import { FileDescriptor } from "./fileDescriptor.browser.js";
import { tryFileToBuffer } from "./streamUtils.browser.js";
import { KustoStreamingIngestClientBase } from "./streamingIngestClientBase.js";

class KustoStreamingIngestClient extends KustoStreamingIngestClientBase {
    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput, autoCorrectEndpoint?: boolean) {
        super(kcsb, defaultProps, autoCorrectEndpoint);
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
            clientRequestId,
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
}

export default KustoStreamingIngestClient;
