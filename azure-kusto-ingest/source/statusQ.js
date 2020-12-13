// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const { QueueClient } = require("@azure/storage-queue");

class QueueDetails {
    constructor(name, service) {
        this.name = name;
        this.service = service;
    }
}


function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = a[j];
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
        return queuesDetails.map(q => new QueueDetails(q.objectName,
            new QueueClient(q.getSASConnectionString()?? "", q.objectName)));
    }

    async isEmpty() {
        const result = await this.peek(1, { raw: true });
        return !result || result.length === 0;
    }

    decodeContent(content) {
        return Buffer.from(content, "base64").toString("ascii");
    }

    deserializeMessage(m) {
        return new this.messageCls(this.decodeContent(m.messageText));
    }

    async _peek(qs, n, options) {
        const result = [];
        const nonEmptyQs = [];

        for (const q of qs) {
            const response = await q.service.peekMessages();
            const messages = response.peekedMessageItems;

            if (messages && messages.length > 0) {
                nonEmptyQs.push(q);
            }

            for (const m of messages) {
                if (m && Object.keys(m).length > 0) {
                    result.push(options && options.raw ? m : this.deserializeMessage(m));

                    if (result.length == n) {
                        return { done: true, nonEmptyQs, result };
                    }
                }
            }
        }
        return { done: nonEmptyQs.length === 0, nonEmptyQs, result };
    }

    async peek(n = 1, options = null) {
        const queues = await this.getQueuesFunc();
        const qServices = shuffle(this._getQServices(queues));
        const perQ = qServices.length > 1 ? Math.floor(n / qServices.length) : qServices.length;

        // First, iterate evenly and randomly on status queues
        const partial = await this._peek(qServices, perQ, options);

        if (partial.done) {
            return partial.result;
        }
        const messagesLeftToPeek = n - partial.result.length;

        // In case queues are uneven, iterate again. This time, request for all n messages and trim
        return await this._peek(partial.nonEmptyQs, messagesLeftToPeek, options);
    }

    async _pop(qs, n, options) {
        const nonEmptyQs = [];
        const result = [];

        for (const q of qs) {
            const response = await q.service.receiveMessages({ numOfMessages: n });
            const messages = response.receivedMessageItems;
            for (const m of messages) {
                if (m && Object.keys(m).length > 0) {
                    result.push(options && options.raw ? m : this.deserializeMessage(m));

                    if (!(options && options.remove === false)) {
                        q.service.deleteMessage(m.messageId, m.popReceipt);
                    }
                    if (result.length == n) {
                        return { done: true, nonEmptyQs, result };
                    }
                }
            }
        }
        return { done: nonEmptyQs.length === 0, nonEmptyQs, result };
    }


    async pop(n = 1, options = null) {
        const queues = await this.getQueuesFunc();
        const qServices = shuffle(this._getQServices(queues));
        const perQ = qServices.length > 1 ? Math.floor(n / qServices.length) : qServices.length;

        // First, iterate evenly and randomly on status queues
        const partial = await this._pop(qServices, perQ, options);
        if (partial.done) {
            return partial.result;
        }

        const messagesLeftToPop = n - partial.result.length;

        // In case queues are uneven, iterate again. This time, request for all n messages and trim
        const final = await this._pop(partial.nonEmptyQs, messagesLeftToPop, options);
        return partial.result.concat(final.result);
    }
};
