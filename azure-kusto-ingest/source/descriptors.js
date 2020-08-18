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

    _gzip() {
        let gzip = zlib.createGzip();
        let input = fs.createReadStream(this.filePath, { autoClose: true });
        let output = fs.createWriteStream(this.filePath + ".gz");
        input.pipe(gzip).pipe(output);
        return this.filePath + ".gz";
    }

    prepare() {
        if (this.size != null && this.size > 0) {
            return !this.zipped ? this._gzip() : this.filePath;
        }

        const stats = fs.statSync(this.filePath);
        this.size = this.zipped ? stats.size * 11 : stats.size;
        return !this.zipped ? this._gzip() : this.filePath;
    }
}


class StreamDescriptor {
    constructor(stream, sourceId = null, compressionType = CompressionType.None) {
        this._stream = stream;

        this.stream = null;
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
