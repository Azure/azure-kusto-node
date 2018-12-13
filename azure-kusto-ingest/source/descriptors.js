const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const Transform = require("stream").Transform;


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
    constructor(filePath) {
        this.filePath = filePath;
        this.name = path.basename(this.filePath);
        this.extension = path.extname(this.filePath).toLowerCase();
        this.size = null;
        this.zipped = this.extension === ".gz";
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

            this.size = this.zipped ? stats.size * 5 : stats.size;
            return !this.zipped ? this._gzip(callback) : callback(null, this.filePath);
        });
    }
}


class StreamDescriptor {
    constructor(stream) {
        this._stream = stream;

        this.stream = null;
        this.name = "stream";
        this.size = null;
    }

    pipe(dest) {
        let bytesCounter = new BytesCounter();

        bytesCounter.once("progress", (sizeInBytes) => this.size = sizeInBytes);

        this.stream = this._stream.pipe(bytesCounter).pipe(dest);
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
