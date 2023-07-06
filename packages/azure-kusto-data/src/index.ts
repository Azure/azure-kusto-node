// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import KustoClient from "./client";
import ClientRequestProperties from "./clientRequestProperties";
import CloudSettings from "./cloudSettings";
import KustoConnectionStringBuilder from "./connectionBuilder";
import * as KustoDataErrors from "./errors";
import { kustoTrustedEndpoints, MatchRule } from "./kustoTrustedEndpoints";
import { KustoResponseDataSet } from "./response";
import { toMilliseconds } from "./timeUtils";

const TimeUtils = { toMilliseconds };

export {
    KustoClient as Client,
    ClientRequestProperties, CloudSettings, KustoConnectionStringBuilder,
    KustoDataErrors, KustoResponseDataSet, kustoTrustedEndpoints,
    MatchRule, TimeUtils
};
