// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IngestionProperties, IngestionPropertiesInput } from "./ingestionProperties";
import { StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor";

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

    abstract ingestFromFile(file: FileDescriptor, ingestionProperties: IngestionPropertiesInput): Promise<any>;

    public close(): void {
        this._isClosed = true;
    }

    protected ensureOpen() {
        if (this._isClosed) {
            throw new Error("Client is closed");
        }
    }
}
