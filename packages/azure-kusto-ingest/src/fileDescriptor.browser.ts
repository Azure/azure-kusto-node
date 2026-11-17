// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import pako from "pako";
import { AbstractDescriptor, CompressionType, FileDescriptorBase, shouldCompressFileByExtension } from "./descriptors.js";
import { IngestionPropertiesInput, shouldCompressFileByFormat } from "./ingestionProperties.js";

export class FileDescriptor extends AbstractDescriptor implements FileDescriptorBase {
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
        readonly name?: string,
    ) {
        super(sourceId, size);
        this.compressionType = compressionType;
        this.zipped = compressionType !== CompressionType.None || this.extension === ".gz" || this.extension === ".zip";
        this.shouldNotCompress = !shouldCompressFileByExtension(this.extension);
    }

    async prepare(ingestionProperties?: IngestionPropertiesInput): Promise<Blob> {
        this._calculateSize(this.file.size, this.zipped);

        const shouldNotCompressByFormat = !shouldCompressFileByFormat(ingestionProperties);
        if (this.zipped || this.shouldNotCompress || shouldNotCompressByFormat) {
            return this.file;
        }

        const gzipped = pako.gzip(await this.file.arrayBuffer());
        return new Blob([gzipped]);
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
