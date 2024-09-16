// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import KustoClient from "./client.js";
import ClientRequestProperties from "./clientRequestProperties.js";
import { CloudSettings, CloudInfo } from "./cloudSettings.js";
import KustoConnectionStringBuilder from "./connectionBuilder.js";
import * as KustoDataErrors from "./errors.js";
import { kustoTrustedEndpoints, MatchRule } from "./kustoTrustedEndpoints.js";
import { KustoResultColumn, KustoResultRow, KustoResultTable } from "./models.js";
import { KustoResponseDataSet } from "./response.js";
import { toMilliseconds } from "./timeUtils.js";

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
    type CloudInfo,
};
