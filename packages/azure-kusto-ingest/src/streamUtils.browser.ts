// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CompressionType, StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor.browser";
import { PassThrough, Readable } from "stream";
import streamify from "stream-array";

export const fileToStream = async (file: FileDescriptor): Promise<StreamDescriptor> => {
    const streamFs = await (file.file as Blob).arrayBuffer();
    const compressionType = file.zipped ? CompressionType.GZIP : CompressionType.None;
    return new StreamDescriptor(streamFs, file.sourceId, compressionType);
};

export const tryFileToBuffer = async (file: FileDescriptor): Promise<StreamDescriptor> => {
    return await fileToStream(file);
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
