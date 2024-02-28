// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IngestionProperties, IngestionPropertiesInput } from "./ingestionProperties";
import { StreamDescriptor, FileDescriptorBase, BlobDescriptor } from "./descriptors";
import net from "node:net";

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
        const authority = parsedUrl.hostname
        if (!authority) {
            return true;
        }
        const is_ip = net.isIP(authority) === 4 || net.isIP(authority) === 6;
        const is_localhost = authority.includes("localhost");
        return is_localhost || is_ip || authority.toLowerCase() === "onebox.dev.kusto.windows.net";
    }
}
