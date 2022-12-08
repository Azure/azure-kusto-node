// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CompressionType, StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor";
import fs from "fs";
import { PassThrough, Readable } from "stream";
import streamify from "stream-array";

// Returns fs.ReadStream for node and NodeJS.ReadableStream for browser
export const fileToStream = (fileDescriptor: FileDescriptor): Promise<StreamDescriptor> => {
    const streamFs = fs.createReadStream(fileDescriptor.file as string);
    const compressionType = fileDescriptor.zipped ? CompressionType.GZIP : CompressionType.None;
    return Promise.resolve(new StreamDescriptor(streamFs, fileDescriptor.sourceId, compressionType));
};

// Used in managed streaming where we buffer the file to memory for retries
export const tryFileToBuffer = async (file: FileDescriptor | string): Promise<StreamDescriptor> => {
    const fileDescriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);
    try {
        const buffer = fs.readFileSync(fileDescriptor.file as string);
        const compressionType = fileDescriptor.zipped ? CompressionType.GZIP : CompressionType.None;
        return new StreamDescriptor(buffer, fileDescriptor.sourceId, compressionType);
    } catch (error) {
        return await fileToStream(fileDescriptor);
    }
};

export const mergeStreams = (...streams: Readable[]): Readable => {
    let pass = new PassThrough();
    let waiting = streams.length;
    for (const stream of streams) {
        pass = stream.pipe(pass, { end: false });
        stream.once("end", () => --waiting === 0 && pass.emit("end"));
    }
    return pass;
};

export const tryStreamToArray = async (stream: Readable, maxBufferSize: number): Promise<Buffer | Readable> => {
    return await new Promise<Buffer | Readable>((resolve, reject) => {
        const result: Buffer[] = [];
        const endListener = () => resolve(Buffer.concat(result));
        const dataHandler = (chunk: Buffer) => {
            try {
                result.push(chunk);
                if (result.reduce((sum, b) => sum + b.length, 0) > maxBufferSize) {
                    stream.removeListener("data", dataHandler);
                    stream.removeListener("end", endListener);
                    resolve(mergeStreams(streamify(result), stream));
                }
            } catch (e) {
                reject(e);
            }
        };
        stream.on("data", dataHandler);
        stream.on("end", endListener);
    });
};
