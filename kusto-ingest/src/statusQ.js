// from azure.storage.common import CloudStorageAccount
const azureStorage = require("azure-storage");

class QueueDetails {
    constructor(name, service) {
        this.name = name;
        this.service = service;
    }
}

module.exports = class StatusQueue {
    constructor(getQueuesFunc, messageCls) {
        this.getQueuesFunc = getQueuesFunc;
        this.messageCls = messageCls;
    }

    _getQServices(queuesDetails) {
        return [
            queuesDetails.map(q => new QueueDetails(q,
                azureStorage.createQueueService(q.storageAccount,q.storageKey)))
        ];
    }

    is_empty() {
        return !this.peek(1, true);
    }
    decodeContent(content) {
        return Buffer.from(content, "base64").toString("ascii");
    }

    deserializeMessage(m) {
        return this.messageCls(this.decodeContent(m.content));
    }

    peek(n = 1, raw = false) {
        let qServices = this._getQServices(this.getQueuesFunc());

        const perQ = Math.floor(n / qServices.length) + 1;

        const result = [];
        for (let q of qServices) {
            for (let m of q.service.peekMessages(q.name, perQ)) {
                if (m) {
                    result.push(raw ? m : this.deserializeMessage(m));
                    if (result.length == n) {
                        return result;
                    }
                }
            }
        }

        return result;
    }

    pop(n = 1, raw = false, remove = true) {
        const qServices = this._getQServices(this.getQueuesFunc());

        const perQ = Math.floor(n / qServices.length) + 1;

        const result = [];
        for (let q of qServices) {
            for (let m of q.service.getMessages(q.name, perQ)) {
                if (m) {
                    result.push(raw ? m : this.deserializeMessage(m));
                    if (remove) {
                        q.service.deleteMessage(q.name, m.id, m.popReceipt);
                    }
                    if (result.length == n) {
                        return result;
                    }
                }
            }
        }

        return result;
    }
};