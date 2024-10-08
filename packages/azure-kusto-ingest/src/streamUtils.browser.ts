// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CompressionType, StreamDescriptor } from "./descriptors.js";
import { FileDescriptor } from "./fileDescriptor.browser.js";

export const fileToStream = async (file: FileDescriptor): Promise<StreamDescriptor> => {
    const streamFs = await (file.file as Blob).arrayBuffer();
    const compressionType = file.zipped ? CompressionType.GZIP : CompressionType.None;
    return new StreamDescriptor(streamFs, file.sourceId, compressionType);
};

export const tryFileToBuffer = async (file: FileDescriptor): Promise<StreamDescriptor> => {
    return await fileToStream(file);
};

// NOT USED
export const tryStreamToArray = async (stream: any): Promise<Buffer> => {
    return Promise.resolve(stream);
};

// NOT USED
export const readableToStream = (stream: ArrayBuffer): ArrayBuffer => {
    return stream;
};
