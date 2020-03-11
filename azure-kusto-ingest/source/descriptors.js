const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const Transform = require("stream").Transform;
const uuidValidate = require("uuid-validate");

function assertUuid4(maybeUuid, errorMessage) {
    if (!!maybeUuid && !uuidValidate(maybeUuid, 4)) {
        throw Error(errorMessage);
    }
}

class BytesCounter extends Transform {
    constructor() {
        super();
        this.bytes = 0;
    }

    _transform(chunk, encoding, cb) {
        this.bytes += chunk.length;
        this.push(chunk);

        this.emit("progress", this.bytes);
        cb();
    }
}

class FileDescriptor {
    constructor(filePath, sourceId = null, size = null) {
        this.filePath = filePath;
        this.name = path.basename(this.filePath);
        this.extension = path.extname(this.filePath).toLowerCase();
        this.size = size;
        this.zipped = this.extension === ".gz";

        assertUuid4(sourceId, "sourceId is not a valid uuid/v4");
        this.sourceId = sourceId;
    }

    _gzip(callback) {
        let zipper = zlib.createGzip();
        let input = fs.createReadStream(this.filePath, { autoClose: true });
        let output = fs.createWriteStream(this.filePath + ".gz");

        input.pipe(zipper).pipe(output);

        output.once("close", () => {
            return callback(null, this.filePath + ".gz");
        });
    }

    prepare(callback) {
        return fs.stat(this.filePath, (err, stats) => {
            if (err) return callback(err);
            
            this.size = this.size || this.zipped ? stats.size * 11 : stats.size;
            return !this.zipped ? this._gzip(callback) : callback(null, this.filePath);
        });
    }
}


class StreamDescriptor {
    constructor(stream, sourceId = null, isCompressed = false) {
        this._stream = stream;

        this.stream = null;
        this.name = "stream";
        this.size = null;
        this.isCompressed = isCompressed;

        assertUuid4(sourceId, "sourceId is not a valid uuid/v4");
        this.sourceId = sourceId;
    }

    pipe(dest) {
        let bytesCounter = new BytesCounter();

        bytesCounter.once("progress", (sizeInBytes) => this.size = sizeInBytes);

        this.stream = this._stream.pipe(bytesCounter).pipe(dest);
    }
}

class BlobDescriptor {
    constructor(path, size = null, sourceId = null) {
        this.path = path;
        this.size = size;
        
        assertUuid4(sourceId, "sourceId is not a valid uuid/v4");
        this.sourceId = sourceId;
    }
}

module.exports.FileDescriptor = FileDescriptor;
module.exports.BlobDescriptor = BlobDescriptor;
module.exports.StreamDescriptor = StreamDescriptor;
