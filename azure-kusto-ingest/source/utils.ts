import { CompressionType, FileDescriptor, StreamDescriptor } from "./descriptors";
import fs from "fs";

export const fileToStream = (file: FileDescriptor | string): StreamDescriptor => {
    const fileDescriptor = file instanceof FileDescriptor ? file : new FileDescriptor(file);
    const streamFs = fs.createReadStream(fileDescriptor.filePath);
    const compressionType = fileDescriptor.zipped ? CompressionType.GZIP : CompressionType.None;
    return new StreamDescriptor(streamFs, fileDescriptor.sourceId, compressionType);
}

export const sleep = (ms: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export const getRandomSleep = (baseMs: number) => {
    return baseMs + Math.floor(Math.random() * 1000);
  }
  