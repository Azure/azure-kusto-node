// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import zlib from "zlib";
import pathlib from "path";
import fs from "fs";
import { file as tmpFile } from "tmp-promise";
import { promisify } from "util";
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

    async prepare(ingestionProperties?: IngestionPropertiesInput): Promise<string> {
        const asyncStat = promisify(fs.stat);
        this._calculateSize((await asyncStat(this.file as string)).size, this.zipped);

        const shouldNotCompressByFormat = !shouldCompressFileByFormat(ingestionProperties);
        if (this.zipped || this.shouldNotCompress || shouldNotCompressByFormat) {
            return this.file as string;
        }

        return this._gzip();
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
