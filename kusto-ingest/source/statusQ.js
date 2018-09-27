const azureStorage = require("azure-storage");

class QueueDetails {
    constructor(name, service) {
        this.name = name;
        this.service = service;
    }
}


// function shuffle(a) {
//     for (let i = a.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));
//         [a[i], a[j]] = [a[j], a[i]];
//     }
//     return a;
// }

module.exports = class StatusQueue {
    constructor(getQueuesFunc, messageCls) {
        this.getQueuesFunc = getQueuesFunc;
        this.messageCls = messageCls;
    }

    _getQServices(queuesDetails) {
        return queuesDetails.map(q => new QueueDetails(q.objectName, azureStorage.createQueueServiceWithSas(q.toURI({ withSas: false, withObjectName: false }), q.sas)));
    }

    isEmpty(callback) {
        return this.peek((err, result) => {
            return callback(err, !result || result.length === 0);
        }, 1, { raw: true });
    }
    decodeContent(content) {
        return Buffer.from(content, "base64").toString("ascii");
    }

    deserializeMessage(m) {
        return this.messageCls(this.decodeContent(m.content));
    }

    peek(callback, n = 1, options = null) {
        return this.getQueuesFunc((err, queues) => {
            if (err) return callback(err);

            const qServices = this._getQServices(queues);
            const perQ = Math.floor(n / qServices.length) + 1;

            const result = [];


            // TODO: handle un-even queues like in python
            for (let i = 0; i < qServices.length; i++) {
                let q = qServices[i];
                q.service.peekMessages(q.name, { numOfMessages: perQ }, (err, messages) => {
                    if (err) return callback(err);

                    for (let m of messages) {
                        if (m && Object.keys(m) > 0) {
                            result.push(options && options.raw ? m : this.deserializeMessage(m));


                            if (result.length == n) {
                                return callback(null, result);
                            }
                        }
                    }
                    // TODO: handle execution of all better
                    if (i == qServices.length - 1) {
                        return callback(null, result);
                    }
                });
            }

        });
    }

    pop(callback, n = 1, options = null) {
        return this.getQueuesFunc((err, queues) => {
            if (err) return callback(err);

            const qServices = this._getQServices(queues);
            const perQ = Math.floor(n / qServices.length) + 1;

            const result = [];


            // TODO: handle un-even queues like in python
            for (let i = 0; i < qServices.length; i++) {
                let q = qServices[i];
                q.service.getMessages(q.name, { numOfMessages: perQ }, (err, messages) => {
                    if (err) return callback(err);

                    for (let m of messages) {
                        if (m && Object.keys(m) > 0) {
                            result.push(options && options.raw ? m : this.deserializeMessage(m));

                            if (options && options.remove) {
                                q.service.deleteMessage(q.name, m.id, m.popReceipt, (err) => {
                                    return callback(err);
                                });
                            }

                            if (result.length == n) {
                                return callback(null, result);
                            }
                        }
                    }
                    // TODO: handle execution of all better
                    if (i == qServices.length - 1) {
                        return callback(null, result);
                    }
                });
            }
        });
    }
};