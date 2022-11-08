// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import zlib from "zlib";
import pathlib from "path";
import fs from "fs";
import { file as tmpFile } from "tmp-promise";
import { promisify } from "util";
import { CompressionType, getSourceId } from "./descriptors";

export class FileDescriptor {
    size: number | null;
    zipped: boolean;
    compressionType: CompressionType;
    cleanupTmp?: () => Promise<void>;
    sourceId: string;

    constructor(
        readonly file: string | Blob,
        sourceId: string | null = null,
        size: number | null = null,
        compressionType: CompressionType = CompressionType.None,
        readonly extension?: string, // Extracted from file name by default
        readonly name?: string // Extracted from file name by default
    ) {
        this.sourceId = getSourceId(sourceId);
        this.compressionType = compressionType;
        this.name = name ? name : pathlib.basename(this.file as string);
        this.extension = extension ? extension : pathlib.extname(this.file as string).toLowerCase();

        this.size = size;
        this.zipped = compressionType !== CompressionType.None || this.extension === ".gz" || this.extension === ".zip";
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

    async prepare(): Promise<string> {
        if (this.zipped) {
            const estimatedCompressionModifier = 11;
            await this.calculateSize(estimatedCompressionModifier);
            return this.file as string;
        }

        const path = await this._gzip();
        await this.calculateSize();
        return path;
    }

    private async calculateSize(modifier: number = 1): Promise<void> {
        if (this.size == null || this.size <= 0) {
            const asyncStat = promisify(fs.stat);
            this.size = (await asyncStat(this.file as string)).size * modifier;
        }
    }

    async cleanup(): Promise<void> {
        if (this.cleanupTmp) {
            await this.cleanupTmp();
        }
    }
}
