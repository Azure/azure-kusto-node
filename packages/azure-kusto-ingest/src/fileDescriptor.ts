// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import zlib from "zlib";
import pathlib from "path";
import fs from "fs";
import { file as tmpFile } from "tmp-promise";
import { PassThrough } from "stream";
import { pipeline } from "stream/promises";
import { AbstractDescriptor, CompressionType, FileDescriptorBase, shouldCompressFileByExtension } from "./descriptors.js";
import { IngestionPropertiesInput, shouldCompressFileByFormat } from "./ingestionProperties.js";

export interface PreparedFile {
    readonly path: string;
    readonly size: number | null;
    readonly cleanup: () => Promise<void>;
}

const onceCleanup = (cleanup: () => Promise<void>): (() => Promise<void>) => {
    let promise: Promise<void> | undefined;
    return () => (promise ??= cleanup());
};

/**
 * Describes a file to be ingested. Use string to describe a local path in Node.JS and Blob object in browsers
 */
export class FileDescriptor extends AbstractDescriptor implements FileDescriptorBase {
    zipped: boolean;
    compressionType: CompressionType;
    shouldNotCompress: boolean;
    cleanupTmp?: () => Promise<void>;
    private readonly _preparedFiles = new Map<string, PreparedFile>();
    private _sizeHint: number | null;
    private _currentSize: number | null;

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
        this._sizeHint = size;
        this._currentSize = size;
        Object.defineProperty(this, "size", {
            configurable: true,
            enumerable: true,
            get: () => this._currentSize,
            set: (value: number | null) => {
                this._currentSize = value;
                this._sizeHint = value;
            },
        });
        this.compressionType = compressionType;
        this.name = name ? name : pathlib.basename(this.file as string);
        this.extension = extension ? extension : pathlib.extname(this.file as string).toLowerCase();

        this.zipped = compressionType !== CompressionType.None || this.extension === ".gz" || this.extension === ".zip";
        this.shouldNotCompress = !shouldCompressFileByExtension(this.extension);
    }

    async _gzip(): Promise<string> {
        return this._rememberPreparedFile(await this._prepareFile(true));
    }

    private async _prepareFile(compress: boolean): Promise<PreparedFile> {
        const sizeHint = this._sizeHint;
        const zipped = this.zipped;
        let cleanup: (() => Promise<void>) | undefined;
        try {
            const file = await fs.promises.open(this.file as string, "r");
            try {
                // Some procfs values can only be read once, so probe with a full stream-sized chunk.
                const firstChunk = Buffer.alloc(64 * 1024);
                const { bytesRead } = await file.read(firstChunk);
                if (bytesRead === 0) {
                    this._getRawSize(0, zipped, sizeHint);
                }

                const temporary = await tmpFile({ postfix: compress ? ".gz" : this.extension, keep: false });
                cleanup = onceCleanup(temporary.cleanup);

                const input = file.createReadStream({ autoClose: false });
                const prefixed = new PassThrough();
                // Preserve the probe chunk without reopening a possibly non-seekable input.
                prefixed.write(firstChunk.subarray(0, bytesRead));
                const output = fs.createWriteStream(temporary.path);
                if (compress) {
                    await pipeline(input, prefixed, zlib.createGzip(), output);
                } else {
                    await pipeline(input, prefixed, output);
                }
                const size = this._getRawSize(bytesRead + input.bytesRead, zipped, sizeHint);
                this._currentSize = size;
                return { path: temporary.path, size, cleanup };
            } finally {
                await file.close();
            }
        } catch (error) {
            await cleanup?.();
            throw error;
        }
    }

    private _rememberPreparedFile(prepared: PreparedFile): string {
        this._preparedFiles.set(prepared.path, prepared);
        this.cleanupTmp = async () => {
            await Promise.all(
                [...this._preparedFiles.values()].map(async (file) => {
                    await file.cleanup();
                    this._preparedFiles.delete(file.path);
                }),
            );
        };
        return prepared.path;
    }

    async prepare(ingestionProperties?: IngestionPropertiesInput): Promise<string> {
        const shouldNotCompressByFormat = !shouldCompressFileByFormat(ingestionProperties);
        const compress = !this.zipped && !this.shouldNotCompress && !shouldNotCompressByFormat;

        return compress ? this._gzip() : this._rememberPreparedFile(await this._prepareFile(false));
    }

    /** Transfers cleanup ownership from the descriptor to the caller of this preparation. */
    async prepareForUpload(ingestionProperties?: IngestionPropertiesInput): Promise<PreparedFile> {
        const path = await this.prepare(ingestionProperties);
        const prepared = this._preparedFiles.get(path);
        if (prepared) {
            this._preparedFiles.delete(path);
            return prepared;
        }

        // Custom prepare() implementations retain their existing size and cleanup contract.
        return { path, size: this.size, cleanup: onceCleanup(this.cleanup.bind(this)) };
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
