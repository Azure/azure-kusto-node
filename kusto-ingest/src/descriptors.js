const fs = require("fs");

module.exports.FileDescriptor = class FileDescriptor {        
    constructor(path, size=0) {
        this.path = path;
        this.size = size;
        // this.stream_name = os.path.basename(this.path);
        // if (this.path.endswith(".gz") or this.path.endswith(".zip")) {
        //     this.zipped_stream = open(this.path, "rb");
        //     if ( this.size <= 0) {                
        //         this.size = int(os.path.getsize(this.path)) * 5;
        //     }
        // }
        // else {
        //     this.size = int(os.path.getsize(this.path));
        //     this.stream_name += ".gz";
        //     this.zipped_stream = BytesIO();
        //     with open(this.path, "rb") as f_in, GzipFile(;
        //         filename="data", fileobj=this.zipped_stream, mode="wb";
        //     ) as f_out:
        //         shutil.copyfileobj(f_in, f_out)
        //     this.zipped_stream.seek(0);
        // }
    }

    deleteFiles() {          
        if (!this.zippedStream) {
            this.zippedStream.close();
        }
    };
};


module.exports.BlobDescriptor = class BlobDescriptor {
    constructor( path, size) {
        this.path = path;
        this.size = size;
    }
};
