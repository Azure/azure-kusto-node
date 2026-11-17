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
        const { path, cleanup } = await tmpFile({ postfix: ".gz", keep: false });
        this.cleanupTmp = cleanup;

        const zipper = zlib.createGzip();
        const input = fs.createReadStream(this.file as string, { autoClose: true });
        const output = fs.createWriteStream(path);

        await new Promise((resolve, reject) => {
            input
                .pipe(zipper)
                .pipe(output)
                .on("error", (err) => {
                    reject(err);
                });
            output.once("close", () => {
                resolve(null);
            });
        });

        return path;
    }

    private async _prepareUnknownSize(compress: boolean): Promise<string> {
        const file = await fs.promises.open(this.file as string, "r");
        try {
            const firstByte = Buffer.alloc(1);
            const { bytesRead } = await file.read(firstByte);
            if (bytesRead === 0) {
                this._calculateSize(0, this.zipped);
            }

            const { path, cleanup } = await tmpFile({ postfix: compress ? ".gz" : this.extension, keep: false });
            this.cleanupTmp = cleanup;

            const input = file.createReadStream({ autoClose: false });
            const prefixed = new PassThrough();
            // Preserve the probe byte without reopening a possibly non-seekable input.
            prefixed.write(firstByte);
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

        if (fileSize === 0) {
            return this._prepareUnknownSize(compress);
        }
        this._calculateSize(fileSize, this.zipped);

        return compress ? this._gzip() : (this.file as string);
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
