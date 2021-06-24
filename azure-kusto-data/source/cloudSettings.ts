// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import axios from "axios";

/**
 * This class holds data for all cloud instances, and returns the specific data instance by parsing the dns suffix from a URL
 */
export namespace CloudSettings {
    const METADATA_ENDPOINT = "v1/rest/auth/metadata";
    const defaultCloudInfo: CloudInfo = {
        loginEndpoint: process.env.AadAuthorityUri || "https://login.microsoftonline.com",
        loginMfaRequired: false,
        kustoClientAppId: "db662dc1-0cfe-4e1c-a843-19a68e65be58",
        kustoClientRedirectUri: "https://microsoft/kustoclient",
        kustoServiceResourceId: "https://kusto.kusto.windows.net",
        firstPartyAuthorityUrl: "https://login.microsoftonline.com/f8cdef31-a31e-4b4a-93e4-5f571e91255a",
    }
    const cloudCache: { [kustoUri: string]: CloudInfo } = {}

    export async function getCloudInfoForCluster(kustoUri: string): Promise<CloudInfo> {
        if (kustoUri in cloudCache) {
            return cloudCache[kustoUri];
        }
        try {
            const response = await axios.get(new URL(kustoUri, METADATA_ENDPOINT).href);
            if (response.status == 200) {
                cloudCache[kustoUri] = response.data;
            }
            else if (response.status == 401) {
                // For now as long not all proxies implement the metadata endpoint, if no endpoint exists return public cloud data
                cloudCache[kustoUri] = defaultCloudInfo;
            }
            throw new Error(`Kusto returned an invalid cloud metadata response - ${response}`);
        }
        catch {
            throw new Error(`Failed to get cloud ingo for cluster ${kustoUri}`);
        }

    }

    export function getAuthorityUri(cloudInfo : CloudInfo, authorityId ?: string) : string{
        return cloudInfo.loginEndpoint + "/" + (authorityId || "organizations")
    }


    export declare type CloudInfo = {
        loginEndpoint: string,
        loginMfaRequired: Boolean,
        kustoClientAppId: string,
        kustoClientRedirectUri: string,
        kustoServiceResourceId: string,
        firstPartyAuthorityUrl: string,
    };
}