const StatusQueue = require("./statusQ");
class StatusMessage {
    static get getProps() {
        return [
            "OperationId", "Database", "Table",
            "IngestionSourceId", "IngestionSourcePath", "RootActivityId"
        ];
    }

    constructor(raw, obj) {
        this.raw = raw || JSON.stringify(raw);

        const _obj = obj || JSON.parse(raw);
        let props = this.constructor.getProps();

        for (let prop of props) {
            Object.defineProperty(this, prop, _obj[prop]);
        }
    }
}


class SuccessMessage extends StatusMessage {
    static get getProps() {
        return [
            "SucceededOn"
        ];
    }

    constructor(raw, obj) {
        const _obj = obj || JSON.parse(raw);

        super(null, _obj);
        let props = this.constructor.getProps();

        for (let prop of props) {
            Object.defineProperty(this, prop, _obj[prop]);
        }

    }
}


class FailureMessage extends StatusMessage {
    static get getProps() {
        return [
            "FailedOn",
            "Details",
            "ErrorCode",
            "FailureStatus",
            "OriginatesFromUpdatePolicy",
            "ShouldRetry"
        ];
    }

    constructor(raw, obj) {
        const _obj = obj || JSON.parse(raw);

        super(null, _obj);

        let props = this.constructor.getProps();

        for (let prop of props) {
            Object.defineProperty(this, prop, _obj[prop]);
        }
    }
}


module.exports = class KustoIngestStatusQueues {
    constructor(kustoIngestClient) {
        this.success = new StatusQueue(
            (cb) => kustoIngestClient.resourceManager.getSuccessfulIngestionsQueues(cb),
            SuccessMessage
        );
        this.failure = new StatusQueue(
            (cb) => kustoIngestClient.resourceManager.getFailedIngestionsQueues(cb),
            FailureMessage
        );
    }
};
