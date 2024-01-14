// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import pako from "pako";
import { AbstractDescriptor, CompressionType, FileDescriptorBase } from "./descriptors";

export class FileDescriptor extends AbstractDescriptor implements FileDescriptorBase {
    size: number | null;
    zipped: boolean;
    compressionType: CompressionType;
    shouldNotCompress: boolean;
    cleanupTmp?: () => Promise<void>;

    constructor(
        readonly file: Blob,
        sourceId: string | null = null,
        size: number | null = null,
        compressionType: CompressionType = CompressionType.None,
        readonly extension?: string,
        readonly name?: string
    ) {
        super(sourceId);
        this.compressionType = compressionType;
        this.size = size || file.size;
        this.zipped = compressionType !== CompressionType.None || this.extension === ".gz" || this.extension === ".zip";
        this.shouldNotCompress =
            this.extension === ".avro" ||
            this.extension === ".apacheavro" ||
            this.extension === ".parquet" ||
            this.extension === ".sstream" ||
            this.extension === ".orc";
    }

    async prepare(): Promise<Blob> {
        if (!this.zipped && !this.shouldNotCompress) {
            try {
                const gzipped = pako.gzip(await this.file.arrayBuffer());
                return new Blob([gzipped]);
            } catch (e) {
                // Ignore - return the file itself
            }
        }

        return this.file;
    }

    async cleanup(): Promise<void> {
        if (this.cleanupTmp) {
            await this.cleanupTmp();
        }
    }

    getCompressionSuffix() {
        return this.compressionType ? `.${this.compressionType}` : ".gz";
    }
}
