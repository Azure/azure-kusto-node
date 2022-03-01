// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IngestionProperties, IngestionPropertiesInput } from "./ingestionProperties";
import { FileDescriptor, StreamDescriptor } from "./descriptors";
import { Readable } from "stream";

export abstract class AbstractKustoClient {
    public defaultProps: IngestionProperties;

    protected constructor(defaultProps: IngestionPropertiesInput) {
        if (!defaultProps) {
            this.defaultProps = new IngestionProperties({});
        } else if (!(defaultProps instanceof IngestionProperties)) {
            this.defaultProps = new IngestionProperties(defaultProps);
        } else {
            this.defaultProps = defaultProps;
        }
    }

    _getMergedProps(newProperties?: IngestionPropertiesInput): IngestionProperties {
        const props = this.defaultProps.merge(newProperties);
        props.setDefaults();
        props.validate();
        return props;
    }

    abstract ingestFromStream(stream: StreamDescriptor | Readable, ingestionProperties: IngestionPropertiesInput): Promise<any>;

    abstract ingestFromFile(file: FileDescriptor | string, ingestionProperties: IngestionPropertiesInput): Promise<any>;
}
