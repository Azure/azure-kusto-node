// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import KustoClient from "./client";
import ClientRequestProperties from "./clientRequestProperties";
import { CloudSettings, CloudInfo } from "./cloudSettings";
import KustoConnectionStringBuilder from "./connectionBuilder";
import * as KustoDataErrors from "./errors";
import { kustoTrustedEndpoints, MatchRule } from "./kustoTrustedEndpoints";
import { KustoResultColumn, KustoResultRow, KustoResultTable } from "./models";
import { KustoResponseDataSet } from "./response";
import { toMilliseconds } from "./timeUtils";

const TimeUtils = { toMilliseconds };

export {
    KustoClient as Client,
    ClientRequestProperties,
    CloudSettings,
    KustoConnectionStringBuilder,
    KustoDataErrors,
    KustoResponseDataSet,
    KustoResultColumn,
    KustoResultRow,
    KustoResultTable,
    kustoTrustedEndpoints,
    MatchRule,
    TimeUtils,
    CloudInfo,
};
