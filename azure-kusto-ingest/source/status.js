// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const StatusQueue = require("./statusQ");
class StatusMessage {
    constructor(raw, obj, extraProps) {
        let props = [
            "OperationId", "Database", "Table",
            "IngestionSourceId", "IngestionSourcePath", "RootActivityId"
        ];

        if (extraProps && extraProps.length > 0) {
            props = props.concat(extraProps);
        }

        const _obj = obj || JSON.parse(raw || JSON.stringify(raw));

        for (let prop of props) {
            this[prop] = _obj[prop];
        }
    }
}


class SuccessMessage extends StatusMessage {
    constructor(raw, obj) {
        super(raw, obj, [
            "SucceededOn"
        ]);
    }
}


class FailureMessage extends StatusMessage {
    constructor(raw, obj) {
        super(raw, obj, [
            "FailedOn",
            "Details",
            "ErrorCode",
            "FailureStatus",
            "OriginatesFromUpdatePolicy",
            "ShouldRetry"
        ]);
    }
}


module.exports = class KustoIngestStatusQueues {
    constructor(kustoIngestClient) {
        this.success = new StatusQueue(
            () => kustoIngestClient.resourceManager.getSuccessfulIngestionsQueues(),
            SuccessMessage
        );
        this.failure = new StatusQueue(
            () => kustoIngestClient.resourceManager.getFailedIngestionsQueues(),
            FailureMessage
        );
    }
};
