// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { v4 as uuidv4 } from "uuid";
import uuidValidate from "uuid-validate";
import { Readable } from "stream";
import IngestionProperties from "./ingestionProperties";

export enum CompressionType {
    ZIP = ".zip",
    GZIP = ".gz",
    None = "",
}

export const getSourceId = (sourceId: string | null): string => {
    if (sourceId) {
        if (!uuidValidate(sourceId, 4)) {
            throw Error("sourceId is not a valid uuid/v4");
        }
        return sourceId;
    }
    return uuidv4();
};

export class StreamDescriptor {
    size: number | null;
    compressionType: CompressionType;
    sourceId: string;

    /**
     * Use Readable for Node.js and ArrayBuffer in browser
     */
    constructor(readonly stream: Readable | ArrayBuffer, sourceId: string | null = null, compressionType: CompressionType = CompressionType.None) {
        this.size = null;
        this.compressionType = compressionType;
        this.sourceId = getSourceId(sourceId);
    }

    merge(other: StreamDescriptor) {
        this.size = other.size;
        this.compressionType = other.compressionType;
        this.sourceId = other.sourceId;
        return this;
    }

    // Currently streams are not compressed by us
    getCompressionSuffix() {
        return this.compressionType ? `.${this.compressionType}` : "";
    }
}

export class BlobDescriptor {
    size: number | null;
    sourceId: string;

    constructor(readonly path: string, size: number | null = null, sourceId: string | null = null) {
        this.size = size;
        this.sourceId = getSourceId(sourceId);
    }
}

export interface FileDescriptorBase {
    size: number | null;
    zipped: boolean;
    compressionType: CompressionType;
    cleanupTmp?: () => Promise<void>;
    extension?: string;
    name?: string;
    sourceId: string | null;
    getCompressionSuffix: () => string;
}

export const generateBlobName = (desc: StreamDescriptor | FileDescriptorBase, props: IngestionProperties): string => {
    const extension = desc instanceof StreamDescriptor ? null : `${desc.name ? "__" + desc.name : ""}${desc.extension ? "." + desc.extension : ""}`;

    const formatSuffix = props.format ? `.${props.format}` : ".csv";
    const compressionString = desc.getCompressionSuffix();
    return `${props.database}__${props.table}__${desc.sourceId}${extension || formatSuffix}${compressionString}`;
};
