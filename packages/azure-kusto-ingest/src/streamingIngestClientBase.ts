// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IngestionPropertiesInput } from "./ingestionProperties.js";

import { BlobDescriptor } from "./descriptors.js";
import { AbstractKustoClient } from "./abstractKustoClient.js";
import { Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";

export abstract class KustoStreamingIngestClientBase extends AbstractKustoClient {
    protected kustoClient: KustoClient;
    constructor(kcsb: string | KustoConnectionStringBuilder, defaultProps?: IngestionPropertiesInput, autoCorrectEndpoint: boolean = true) {
        super(defaultProps);
        if (typeof kcsb === "string") {
            kcsb = new KustoConnectionStringBuilder(kcsb);
        }
        if (autoCorrectEndpoint) {
            kcsb.dataSource = this.getQueryEndpoint(kcsb.dataSource);
        }
        this.kustoClient = new KustoClient(kcsb);
        this.defaultDatabase = this.kustoClient.defaultDatabase;
    }

    async ingestFromBlob(blob: string | BlobDescriptor, ingestionProperties?: IngestionPropertiesInput, clientRequestId?: string): Promise<any> {
        const props = this._getMergedProps(ingestionProperties);
        const descriptor = blob instanceof BlobDescriptor ? blob : new BlobDescriptor(blob);
        // No need to check blob size if it was given to us that it's not empty
        await descriptor.fillSize();

        return await this.kustoClient.executeStreamingIngest(
            props.database as string,
            props.table as string,
            undefined,
            props.format,
            props.ingestionMappingReference ?? null,
            descriptor.path,
            clientRequestId,
        );
    }

    close() {
        if (!this._isClosed) {
            this.kustoClient.close();
        }
        super.close();
    }
}
