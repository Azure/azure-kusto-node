// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import pako from "pako";
import { AbstractDescriptor, CompressionType, FileDescriptorBase, shouldCompressFileByExtension } from "./descriptors";
import { IngestionPropertiesInput, shouldCompressFileByFormat } from "./ingestionProperties";

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
        this.size = size;

        this.zipped = compressionType !== CompressionType.None || this.extension === ".gz" || this.extension === ".zip";
        this.shouldNotCompress = !shouldCompressFileByExtension(this.extension);
    }

    async prepare(ingestionProperties?: IngestionPropertiesInput): Promise<Blob> {
        const shouldNotCompressByFormat = !shouldCompressFileByFormat(ingestionProperties);
        if (this.zipped || this.shouldNotCompress || shouldNotCompressByFormat) {
            const estimatedCompressionModifier = 11;
            this._calculateSize(estimatedCompressionModifier);
            return this.file;
        }

        const gzipped = pako.gzip(await this.file.arrayBuffer());
        try {
            this._calculateSize();
            return new Blob([gzipped]);
        } catch (e) {
            // Ignore - return the file itself
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

    private _calculateSize(modifier: number = 1): void {
        if (this.size == null || this.size <= 0) {
            const fileSize = this.file.size;
            if (fileSize <= 0) {
                throw Error("Empty file.");
            }
            this.size = fileSize * modifier;
        }
    }
}
