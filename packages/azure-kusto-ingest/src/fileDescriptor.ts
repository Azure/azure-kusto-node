// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import zlib from "zlib";
import pathlib from "path";
import fs from "fs";
import { file as tmpFile } from "tmp-promise";
import { promisify } from "util";
import { PassThrough } from "stream";
import { pipeline } from "stream/promises";
import { AbstractDescriptor, CompressionType, FileDescriptorBase, shouldCompressFileByExtension } from "./descriptors.js";
import { IngestionPropertiesInput, shouldCompressFileByFormat } from "./ingestionProperties.js";

/**
 * Describes a file to be ingested. Use string to describe a local path in Node.JS and Blob object in browsers
 */
export class FileDescriptor extends AbstractDescriptor implements FileDescriptorBase {
    zipped: boolean;
    compressionType: CompressionType;
    shouldNotCompress: boolean;
    cleanupTmp?: () => Promise<void>;

    constructor(
        /**
         * Use string in Node.JS and Blob in browser
         */
        readonly file: string | Blob,
        sourceId: string | null = null,
        size: number | null = null,
        compressionType: CompressionType = CompressionType.None,
        readonly extension?: string, // Extracted from file name by default
        readonly name?: string, // Extracted from file name by default
    ) {
        super(sourceId, size);
        this.compressionType = compressionType;
        this.name = name ? name : pathlib.basename(this.file as string);
        this.extension = extension ? extension : pathlib.extname(this.file as string).toLowerCase();

        this.zipped = compressionType !== CompressionType.None || this.extension === ".gz" || this.extension === ".zip";
        this.shouldNotCompress = !shouldCompressFileByExtension(this.extension);
    }

    async _gzip(): Promise<string> {
        return this._prepareFile(true);
    }

    private async _prepareFile(compress: boolean, fileSize = 0): Promise<string> {
        const file = await fs.promises.open(this.file as string, "r");
        try {
            // Some procfs values can only be read once, so probe with a full stream-sized chunk.
            const firstChunk = Buffer.alloc(64 * 1024);
            const { bytesRead } = await file.read(firstChunk);
            if (bytesRead === 0) {
                this._calculateSize(0, this.zipped);
            }
            if (!compress && fileSize > 0 && bytesRead === Math.min(fileSize, firstChunk.length)) {
                this._calculateSize(fileSize, this.zipped);
                return this.file as string;
            }

            const { path, cleanup } = await tmpFile({ postfix: compress ? ".gz" : this.extension, keep: false });
            this.cleanupTmp = cleanup;

            const input = file.createReadStream({ autoClose: false });
            const prefixed = new PassThrough();
            // Preserve the probe chunk without reopening a possibly non-seekable input.
            prefixed.write(firstChunk.subarray(0, bytesRead));
            const output = fs.createWriteStream(path);
            if (compress) {
                await pipeline(input, prefixed, zlib.createGzip(), output);
            } else {
                await pipeline(input, prefixed, output);
            }
            this._calculateSize(bytesRead + input.bytesRead, this.zipped);
            return path;
        } finally {
            await file.close();
        }
    }

    async prepare(ingestionProperties?: IngestionPropertiesInput): Promise<string> {
        const asyncStat = promisify(fs.stat);
        const fileSize = (await asyncStat(this.file as string)).size;
        const shouldNotCompressByFormat = !shouldCompressFileByFormat(ingestionProperties);
        const compress = !this.zipped && !this.shouldNotCompress && !shouldNotCompressByFormat;

        return compress ? this._gzip() : this._prepareFile(false, fileSize);
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
