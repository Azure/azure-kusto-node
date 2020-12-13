// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {StatusQueue} from "./statusQ";

export class StatusMessage {
    OperationId?: string;
    Database?: string;
    Table?: string;
    IngestionSourceId?: string;
    IngestionSourcePath?: string;
    RootActivityId?: string;

    [other: string] : any;
    constructor(raw: any, obj: any, extraProps: string[] | null) {
        let props : string[] = [
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
    SucceededOn?: string;

    constructor(raw: any, obj: any) {
        super(raw, obj, [
            "SucceededOn"
        ]);
    }
}


class FailureMessage extends StatusMessage {
    FailedOn? : string;
    Details? : string;
    ErrorCode? : string;
    FailureStatus? : string;
    OriginatesFromUpdatePolicy? : string;
    ShouldRetry? : string;
    constructor(raw: any, obj: any) {
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


export class KustoIngestStatusQueues {
    success: StatusQueue;
    failure: StatusQueue;
    constructor(kustoIngestClient: any) { //todo ts
        this.success = new StatusQueue(
            () => kustoIngestClient.resourceManager.getSuccessfulIngestionsQueues(),
            SuccessMessage
        );
        this.failure = new StatusQueue(
            () => kustoIngestClient.resourceManager.getFailedIngestionsQueues(),
            FailureMessage
        );
    }
}

export default KustoIngestStatusQueues;