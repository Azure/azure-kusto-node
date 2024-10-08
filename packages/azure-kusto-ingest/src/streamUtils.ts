// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import fs from "fs";
import { PassThrough, Readable } from "stream";
import streamify from "stream-array";
import { CompressionType, StreamDescriptor } from "./descriptors.js";
import { FileDescriptor } from "./fileDescriptor.js";

// Returns fs.ReadStream for node and NodeJS.ReadableStream in browser
export const fileToStream = (fileDescriptor: FileDescriptor): Promise<StreamDescriptor> => {
    const streamFs = fs.createReadStream(fileDescriptor.file as string);
    const compressionType = fileDescriptor.zipped ? CompressionType.GZIP : CompressionType.None;
    return Promise.resolve(new StreamDescriptor(streamFs, fileDescriptor.sourceId, compressionType));
};

// Used in managed streaming where we buffer the file to memory for retries
export const tryFileToBuffer = async (fileDescriptor: FileDescriptor): Promise<StreamDescriptor> => {
    try {
        const buffer = fs.readFileSync(fileDescriptor.file as string);
        const compressionType = fileDescriptor.zipped ? CompressionType.GZIP : CompressionType.None;
        return new StreamDescriptor(buffer, fileDescriptor.sourceId, compressionType);
    } catch (error) {
        return await fileToStream(fileDescriptor);
    }
};

const mergeStreams = (...streams: Readable[]): Readable => {
    let pass = new PassThrough();
    let waiting = streams.length;
    for (const stream of streams) {
        pass = stream.pipe(pass, { end: false });
        stream.once("end", () => --waiting === 0 && pass.emit("end"));
    }
    return pass;
};

export const tryStreamToArray = async (stream: Readable, maxBufferSize: number): Promise<Buffer | Readable> => {
    if (stream instanceof Buffer) {
        return stream;
    }
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

export const readableToStream = (stream: Readable | ArrayBuffer): Readable => {
    return streamify([stream]);
};
