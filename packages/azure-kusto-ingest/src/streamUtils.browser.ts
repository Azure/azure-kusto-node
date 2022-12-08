// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CompressionType, StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor";
import { PassThrough, Readable } from "stream";
import streamify from "stream-array";

export const fileToStream = async (file: Blob): Promise<StreamDescriptor> => {
    const fileDescriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);
    const streamFs = await file.arrayBuffer();
    const compressionType = fileDescriptor.zipped ? CompressionType.GZIP : CompressionType.None;
    return new StreamDescriptor(streamFs, fileDescriptor.sourceId, compressionType);
};

export const tryFileToBuffer = async (file: Blob): Promise<StreamDescriptor> => {
    try {
        const fileDescriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);
        const buffer = await streamToBuffer(file.stream());
        const compressionType = fileDescriptor.zipped ? CompressionType.GZIP : CompressionType.None;
        return new StreamDescriptor(buffer, fileDescriptor.sourceId, compressionType);
    } catch(error) {
        return await fileToStream(file);
    }
}

// A helper method used to read a Node.js readable stream into a Buffer
async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      readableStream.on("data", (data: Buffer | string) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on("error", reject);
    });
  }

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
