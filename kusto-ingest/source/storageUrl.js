
const URI_FORMAT = /https:\/\/(\w+).(queue|blob|table).core.windows.net\/([\w,-]+)\\?(.*)/g;


module.exports = class StorageUrl {
    constructor(storageAccountName, objectType, objectName, sas) {
        this.storageAccountName = storageAccountName;
        this.objectType = objectType;
        this.objectName = objectName;
        this.sas = sas;
    }

    static fromURI(uri) {
        const match = URI_FORMAT.exec(uri);
        return new StorageUrl(match[1], match[2], match[3], match[4]);
    }

    toURI() {
        return `https://${this.storageAccountName}.${this.objectType}.core.windows.net/${this.objectName}?${this.sas}`;
    }
};


