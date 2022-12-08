// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CompressionType, getSourceId } from "./descriptors";

export class FileDescriptor {
    size: number | null;
    zipped: boolean;
    compressionType: CompressionType;
    cleanupTmp?: () => Promise<void>;

    constructor(
        readonly file: Blob,
        readonly sourceId: string | null = null,
        size: number | null = null,
        compressionType: CompressionType = CompressionType.None,
        readonly extension?: string,
        readonly name?: string
    ) {
        this.sourceId = getSourceId(sourceId)
        this.compressionType = compressionType;
        this.size = size || file.size;
        this.zipped = compressionType !== CompressionType.None || this.extension === ".gz" || this.extension === ".zip";
    }

    async _gzip(): Promise<string> {
       return await Promise.resolve("");
    }

    async prepare(): Promise<Blob> {
       return await Promise.resolve(this.file);
    }

    async cleanup(): Promise<void> {
        if (this.cleanupTmp) {
            await this.cleanupTmp();
        }
    }
}
