// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const Transform = require("stream").Transform;
const uuidValidate = require("uuid-validate");
const uuidv4 = require("uuid/v4");

const CompressionType = Object.freeze({
    ZIP : ".zip",
    GZIP : ".gz",
    None : ""
});

function getSourceId(sourceId){
    if(sourceId){
        if(!uuidValidate(sourceId, 4)){
            throw Error("sourceId is not a valid uuid/v4");
        }
        return sourceId;
    }
    return uuidv4();
}

class FileDescriptor {
    constructor(filePath, sourceId = null, size = null) {
        this.filePath = filePath;
        this.name = path.basename(this.filePath);
        this.extension = path.extname(this.filePath).toLowerCase();
        this.size = size;
        this.zipped = this.extension === ".gz" || this.extension === ".zip";
        this.sourceId = getSourceId(sourceId);
    }

    async _gzip() {
        let zipper = zlib.createGzip();
        let input = fs.createReadStream(this.filePath, { autoClose: true });
        let output = fs.createWriteStream(this.filePath + ".gz");

        await new Promise((resolve, reject) => {
            input.pipe(zipper).pipe(output)
            .on("error", (err) => {
                reject(err);
            });
            output.once("close", function() {
                resolve();
            });
        });
        
        return this.filePath + ".gz";
    }

    async prepare() {
        if(this.zipped){
            if (this.size == null || this.size <= 0) {
                this.size = fs.statSync(this.filePath).size * 11;
            } 
            return this.filePath;
        }
        else{
            await this._gzip();
            if (this.size == null || this.size <= 0) {
                this.size = fs.statSync(this.filePath).size;
            } 
            return this.filePath + ".gz";
        }
    }
}

class StreamDescriptor {
    constructor(stream, sourceId = null, compressionType = CompressionType.None) {
        this.stream = stream;
        this.name = "stream";
        this.size = null;
        this.compressionType = compressionType;
        this.sourceId = getSourceId(sourceId);
    }
}

class BlobDescriptor {
    constructor(path, size = null, sourceId = null) {
        this.path = path;
        this.size = size;
        this.sourceId = getSourceId(sourceId);
    }
}

module.exports.FileDescriptor = FileDescriptor;
module.exports.BlobDescriptor = BlobDescriptor;
module.exports.StreamDescriptor = StreamDescriptor;
module.exports.CompressionType = CompressionType;
