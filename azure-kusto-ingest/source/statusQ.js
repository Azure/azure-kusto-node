const azureStorage = require("azure-storage");

class QueueDetails {
    constructor(name, service) {
        this.name = name;
        this.service = service;
    }
}


function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        let temp = a[j];
        a[j] = a[i];
        a[i] = temp;
    }

    return a;
}

module.exports = class StatusQueue {
    constructor(getQueuesFunc, messageCls) {
        this.getQueuesFunc = getQueuesFunc;
        this.messageCls = messageCls;
    }

    _getQServices(queuesDetails) {
        return queuesDetails.map(q => new QueueDetails(q.objectName, azureStorage.createQueueServiceWithSas(
            q.toURI({ withSas: false, withObjectName: false }), 
            q.sas))
        );
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
        return new this.messageCls(this.decodeContent(m.messageText));
    }

    _peek(qs, n, options, callback) {
        const result = [];
        const nonEmptyQs = [];

        for (let i = 0; i < qs.length; i++) {
            let q = qs[i];
            q.service.peekMessages(q.name, { numOfMessages: n }, (err, messages) => {
                if (err) return callback(err);

                if (messages && messages.length > 0) {
                    nonEmptyQs.push(q);
                }

                for (let m of messages) {
                    if (m && Object.keys(m).length > 0) {
                        result.push(options && options.raw ? m : this.deserializeMessage(m));


                        if (result.length == n) {
                            return callback(null, { done: true, nonEmptyQs, result });
                        }
                    }
                }

                if (i == qs.length - 1) {
                    return callback(null, { done: nonEmptyQs.length === 0, nonEmptyQs, result });
                }
            });
        }
    }

    peek(callback, n = 1, options = null) {
        return this.getQueuesFunc((err, queues) => {
            if (err) return callback(err);

            const qServices = shuffle(this._getQServices(queues));
            const perQ = qServices.length > 1 ? Math.floor(n / qServices.length) : qServices.length;

            // first, iterate evenly and randomly on status queues
            return this._peek(qServices, perQ, options, (err, partial) => {
                if (err) return callback(err);

                if (partial.done) return callback(null, partial.result);

                let messagesLeftToPeek = n - partial.result.length;

                // incase queues are uneven, iterate again, this time, request entire n messages, and trim
                return this._peek(partial.result.nonEmptyQs, messagesLeftToPeek, options, (err, final) => {
                    if (err) return callback(err);

                    return callback(null, partial.result.concat(final.result));
                });
            });
        });
    }

    _pop(qs, n, options, callback) {
        const nonEmptyQs = [];
        const result = [];

        for (let i = 0; i < qs.length; i++) {
            let q = qs[i];
            q.service.getMessages(q.name, { numOfMessages: n }, (err, messages) => {
                if (err) return callback(err);

                for (let m of messages) {
                    if (m && Object.keys(m).length > 0) {
                        result.push(options && options.raw ? m : this.deserializeMessage(m));

                        if (!(options && options.remove === false)) {
                            q.service.deleteMessage(q.name, m.messageId, m.popReceipt, (err) => {
                                if (err) return callback(err);
                            });
                        }

                        if (result.length == n) {
                            return callback(null, { done: true, nonEmptyQs, result });
                        }
                    }
                }

                if (i == qs.length - 1) {
                    return callback(null, { done: nonEmptyQs.length === 0, nonEmptyQs, result });
                }
            });
        }
    }

    pop(callback, n = 1, options = null) {
        return this.getQueuesFunc((err, queues) => {
            if (err) return callback(err);

            const qServices = shuffle(this._getQServices(queues));
            const perQ = qServices.length > 1 ? Math.floor(n / qServices.length) : qServices.length;

            // first, iterate evenly and randomly on status queues
            return this._pop(qServices, perQ, options, (err, partial) => {
                if (err) return callback(err);

                if (partial.done) return callback(null, partial.result);

                let messagesLeftToPop = n - partial.result.length;

                // incase queues are uneven, iterate again, this time, request entire n messages, and trim
                return this._pop(partial.result.nonEmptyQs, messagesLeftToPop, options, (err, final) => {
                    if (err) return callback(err);

                    return callback(null, partial.result.concat(final.result));
                });
            });

        });
    }
};
