// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.


// @ts-ignore
import request from "request";

const MSI_API_VERSION = "2018-02-01";
const MSI_FUNCTION_API_VERSION = "2017-09-01";

export default function acquireToken<T>(resource: string, msiEndpoint: string, msiClientId: string, msiSecret: string, callback: (error: string | null, token?: { tokenType: string; accessToken: string }) => T) {
    let msiUri = `${msiEndpoint}?resource=${resource}&api-version=${msiSecret ? MSI_FUNCTION_API_VERSION : MSI_API_VERSION}`;

    if (msiClientId) {
        msiUri += `&client_id=${msiClientId}`;
    }

    const headers: any = {
        Metadata: true
    };

    if (msiSecret) {
        headers.Secret = msiSecret;
    }

    request({
        method: "GET",
        url: msiUri,
        headers
    }, (error: string | null, response: {statusCode: number, json: string, body: string}, body: any) => {
        if (error) return callback(error);

        if (response.statusCode < 200 || response.statusCode >= 400) {
            return callback(`Unexpected status ${response.statusCode}.\n ${response.body}`);
        }

        const tokenData = JSON.parse(body);
        return callback(null, {tokenType: tokenData.token_type, accessToken: tokenData.access_token});
    });
};
