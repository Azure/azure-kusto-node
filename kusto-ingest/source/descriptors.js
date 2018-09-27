const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const Writable = require("stream").Writable;

class BytesCounter extends Writable {
    constructor() {
        super();
        this.bytes = 0;
    }

    _write(chunk, encoding, cb) {
        this.bytes += chunk.length;
        this.emit("progress", this.bytes);
        cb();
    }
}

class FileDescriptor {
    constructor(filePath) {
        this.filePath = filePath;
        this.name = path.basename(this.filePath);
        this.size = null;
        this.zipped = false;
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

            this.zipped = path.extname(this.filePath).toLowerCase() === ".gz";
            this.size = this.zipped ? stats.size * 5 : stats.size;

            return !this.zipped ? this._gzip(callback) : callback(null, this.filePath);
        });
    }
}


class StreamDescriptor {
    constructor(stream) {
        this.stream = stream;
        this.name = path.basename(this.filePath);
        this.size = null;
    }

    prepare(callback) {
        let zipper = zlib.createGzip();
        let bytesCounter = BytesCounter();

        this.stream.pipe(zipper).pipe(bytesCounter);

        bytesCounter.once("progress", (sizeInBytes) => this.size = sizeInBytes);

        callback(this.stream);
    }
}

class BlobDescriptor {
    constructor(path, size = null) {
        this.path = path;
        this.size = size;
    }
}

module.exports.FileDescriptor = FileDescriptor;
module.exports.BlobDescriptor = BlobDescriptor;
module.exports.StreamDescriptor = StreamDescriptor;