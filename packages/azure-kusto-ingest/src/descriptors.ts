// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { v4 as uuidv4 } from "uuid";
import uuidValidate from "uuid-validate";
import { Readable } from "stream";
import IngestionProperties from "./ingestionProperties";
import { BlobClient } from "@azure/storage-blob";

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

export abstract class AbstractDescriptor {
    constructor(public sourceId: string | null = null, public size: number | null = null) {
        this.sourceId = getSourceId(sourceId);
    }
}

export class StreamDescriptor extends AbstractDescriptor {
    /**
     * Use Readable for Node.js and ArrayBuffer in browser
     */
    constructor(
        readonly stream: Readable | ArrayBuffer,
        sourceId: string | null = null,
        public compressionType: CompressionType = CompressionType.None,
        size: number | null = null
    ) {
        super(sourceId, size);
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

export class BlobDescriptor extends AbstractDescriptor {
    constructor(readonly path: string, size: number | null = null, sourceId: string | null = null) {
        super(sourceId, size);
    }

    async fillSize(): Promise<void> {
        if (!this.size) {
            const blobClient = new BlobClient(this.path);
            const blobProps = await blobClient.getProperties();
            const length = blobProps.contentLength;
            if (length !== undefined) {
                if (length === 0) {
                    throw new Error("Empty blob.");
                }
                this.size = length;
            }
        }
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
    const extension = desc instanceof StreamDescriptor ? null : `${desc.name ? "__" + desc.name : `${desc.extension ? "." + desc.extension : ""}`}`;

    const formatSuffix = props.format ? `.${props.format}` : ".csv";
    const compressionString = desc.getCompressionSuffix();
    return `${props.database}__${props.table}__${desc.sourceId}${extension || formatSuffix}${compressionString}`;
};
