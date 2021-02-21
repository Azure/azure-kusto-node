// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {AzureCliCredentials} from "@azure/ms-rest-nodeauth";

export default function acquireToken<T>(connectionString: string, callback: (err: Error | null, data?: { tokenType: string; accessToken: string }) => T) {

    AzureCliCredentials.create({resource: connectionString}).then((res) => {

        const tokenData = res.tokenInfo;
        return callback(null, {tokenType: tokenData.tokenType, accessToken: tokenData.accessToken});

    }).catch(err => callback(err));
}
