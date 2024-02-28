// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IngestionProperties, IngestionPropertiesInput } from "./ingestionProperties";
import { StreamDescriptor, FileDescriptorBase, BlobDescriptor } from "./descriptors";
import { Address4, Address6 } from "ip-address";

const INGEST_PREFIX = "ingest-";
const PROTOCOL_SUFFIX = "://";

export abstract class AbstractKustoClient {
    public defaultProps: IngestionProperties;
    public defaultDatabase?: string;
    protected _isClosed: boolean = false;

    protected constructor(defaultProps: IngestionPropertiesInput) {
        if (!defaultProps) {
            this.defaultProps = new IngestionProperties({});
        } else if (!(defaultProps instanceof IngestionProperties)) {
            this.defaultProps = new IngestionProperties(defaultProps);
        } else {
            this.defaultProps = new IngestionProperties(defaultProps);
        }
    }

    _getMergedProps(newProperties?: IngestionPropertiesInput): IngestionProperties {
        const props = this.defaultProps.merge(newProperties);
        props.setDefaults();
        if (!props.database) {
            props.database = this.defaultDatabase;
        }

        props.validate();
        return props;
    }

    abstract ingestFromStream(stream: StreamDescriptor, ingestionProperties: IngestionPropertiesInput): Promise<any>;

    abstract ingestFromFile(file: FileDescriptorBase | string | Blob, ingestionProperties: IngestionPropertiesInput): Promise<any>;

    abstract ingestFromBlob(blob: string | BlobDescriptor, ingestionProperties?: IngestionPropertiesInput): Promise<any>;

    public close(): void {
        this._isClosed = true;
    }

    protected ensureOpen() {
        if (this._isClosed) {
            throw new Error("Client is closed");
        }
    }

    getIngestionEndpoint(clusterUrl?: string): string | undefined {
        if (!clusterUrl || clusterUrl.includes(INGEST_PREFIX) || this.isReservedHostname(clusterUrl)) {
            return clusterUrl;
        }
        return clusterUrl.replace(PROTOCOL_SUFFIX, PROTOCOL_SUFFIX + INGEST_PREFIX);
    }

    getQueryEndpoint(clusterUrl?: string): string | undefined {
        if (clusterUrl && clusterUrl.includes(INGEST_PREFIX)) {
            return clusterUrl.replace(INGEST_PREFIX, "");
        }
        return clusterUrl;
    }

    isReservedHostname(clusterUrl: string): boolean {
        const parsedUrl = new URL(clusterUrl);
        const authority = parsedUrl.hostname;
        if (!authority) {
            return true;
        }
        let is_ip;
        try {
            is_ip = new Address4(authority);
        } catch {
            try {
                is_ip = new Address6(authority);
            } catch {
                is_ip = false;
            }
        }
        if (is_ip instanceof Address4 || is_ip instanceof Address6) {
            is_ip = true;
        }
        const is_localhost = authority.includes("localhost");
        return is_localhost || is_ip || authority.toLowerCase() === "onebox.dev.kusto.windows.net";
    }
}
