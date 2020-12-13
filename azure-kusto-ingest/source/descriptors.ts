// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import uuid from "uuid";
import uuidValidate from "uuid-validate";
import zlib from "zlib";
import pathlib from "path";
import fs, {ReadStream} from "fs";

export enum CompressionType {
    ZIP= ".zip",
    GZIP= ".gz",
    None= "",
}

function getSourceId(sourceId: string | null): string {
    if (sourceId) {
        if (!uuidValidate(sourceId, 4)) {
            throw Error("sourceId is not a valid uuid/v4");
        }
        return sourceId;
    }
    return uuid.v4();
}

export class FileDescriptor {
    readonly name: string;
    readonly extension: string;
    size: number | null;
    sourceId: string;
    zipped: boolean;

    constructor(readonly filePath: string, sourceId: string | null = null, size: number | null = null) {
        this.name = pathlib.basename(this.filePath);
        this.extension = pathlib.extname(this.filePath).toLowerCase();
        this.size = size;
        this.zipped = this.extension === ".gz" || this.extension === ".zip";
        this.sourceId = getSourceId(sourceId);
    }

    async _gzip(): Promise<string> {
        const zipper = zlib.createGzip();
        const input = fs.createReadStream(this.filePath, {autoClose: true});
        const output = fs.createWriteStream(this.filePath + ".gz");

        await new Promise((resolve, reject) => {
            input.pipe(zipper).pipe(output)
                .on("error", (err) => {
                    reject(err);
                });
            output.once("close", function () {
                resolve(null);
            });
        });

        return this.filePath + ".gz";
    }

    async prepare(): Promise<string> {
        if (this.zipped) {
            if (this.size == null || this.size <= 0) {
                this.size = fs.statSync(this.filePath).size * 11;
            }
            return this.filePath;
        }

        await this._gzip();
        if (this.size == null || this.size <= 0) {
            this.size = fs.statSync(this.filePath).size;
        }
        return this.filePath + ".gz";

    }
}

export class StreamDescriptor {
    name: string;
    size: number | null;
    compressionType: CompressionType;
    sourceId: string;
    constructor(readonly stream: ReadStream, sourceId: string | null = null, compressionType: CompressionType = CompressionType.None) {
        this.name = "stream";
        this.size = null;
        this.compressionType = compressionType;
        this.sourceId = getSourceId(sourceId);
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
