import IngestionProperties from "./ingestionProperties";
import {FileDescriptor, StreamDescriptor} from "./descriptors";
import { Readable } from "stream";

export abstract class AbstractKustoClient {
    protected constructor(public defaultProps: IngestionProperties | null = null) {
    }

    _mergeProps(newProperties?: IngestionProperties | null): IngestionProperties {
        // no default props
        if (!newProperties || Object.keys(newProperties).length === 0) {
            return this.defaultProps || new IngestionProperties({});
        }

        // no new props
        if (this.defaultProps == null || Object.keys(this.defaultProps).length === 0) {
            return newProperties || new IngestionProperties({});
        }
        // both exist - merge
        return this.defaultProps.merge(newProperties) || new IngestionProperties({});
    }

    abstract ingestFromStream(stream: StreamDescriptor | Readable, ingestionProperties: IngestionProperties): Promise<any>;

    abstract ingestFromFile(file: FileDescriptor | string, ingestionProperties: IngestionProperties): Promise<any>;
}