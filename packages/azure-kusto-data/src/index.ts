// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import KustoClient from "./client";
import ClientRequestProperties from "./clientRequestProperties";
import KustoConnectionStringBuilder from "./connectionBuilder";
import * as KustoDataErrors from "./errors";
import { toMilliseconds } from "./timeUtils";

const TimeUtils = { toMilliseconds };

export { KustoClient as Client, ClientRequestProperties, KustoConnectionStringBuilder, KustoDataErrors, TimeUtils };
