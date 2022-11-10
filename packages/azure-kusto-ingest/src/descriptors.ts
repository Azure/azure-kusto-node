// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { v4 as uuidv4 } from "uuid";
import uuidValidate from "uuid-validate";
import { Readable } from "stream";

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

    constructor(readonly stream: Readable | Buffer | NodeJS.ReadableStream, sourceId: string | null = null, compressionType: CompressionType = CompressionType.None) {
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
}

export class BlobDescriptor {
    size: number | null;
    sourceId: string;

    constructor(readonly path: string, size: number | null = null, sourceId: string | null = null) {
        this.size = size;
        this.sourceId = getSourceId(sourceId);
    }
}
