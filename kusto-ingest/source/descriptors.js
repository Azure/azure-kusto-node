const fs = require("fs");
// const azureStorage = require("azure-storage");
module.exports.FileDescriptor = class FileDescriptor {
    constructor(path) {
        this.path = path;
        this.size = fs.statSync(path);
        this.zipped = false;

        if (path.endsWith(".zip") || path.endsWith(".gz")) {
            this.zipped = true;
            this.size *= 5;
        }
    }
};


module.exports.BlobDescriptor = class BlobDescriptor {
    constructor(path, size = null) {
        this.path = path;
        this.size = size;
    }
};
