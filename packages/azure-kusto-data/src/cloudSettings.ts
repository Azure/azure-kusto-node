// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import axios from "axios";
import { isNodeLike } from "@azure/core-util";

export type CloudInfo = {
    LoginEndpoint: string;
    LoginMfaRequired: boolean;
    KustoClientAppId: string;
    KustoClientRedirectUri: string;
    KustoServiceResourceId: string;
    FirstPartyAuthorityUrl: string;
};

const AXIOS_ERR_NETWORK = axios?.AxiosError?.ERR_NETWORK ?? "ERR_NETWORK";

/**
 * This class holds data for all cloud instances, and returns the specific data instance by parsing the dns suffix from a URL
 */
class CloudSettings {
    METADATA_ENDPOINT = "/v1/rest/auth/metadata";
    defaultCloudInfo: CloudInfo = {
        LoginEndpoint: (isNodeLike ? process?.env?.AadAuthorityUri : undefined) || "https://login.microsoftonline.com",
        LoginMfaRequired: false,
        KustoClientAppId: "db662dc1-0cfe-4e1c-a843-19a68e65be58",
        KustoClientRedirectUri: "https://microsoft/kustoclient",
        KustoServiceResourceId: "https://kusto.kusto.windows.net",
        FirstPartyAuthorityUrl: "https://login.microsoftonline.com/f8cdef31-a31e-4b4a-93e4-5f571e91255a",
    };
    cloudCache: { [kustoUri: string]: CloudInfo } = {};

    writeToCache(url: string, info?: CloudInfo) {
        this.cloudCache[this.getCacheKey(url)] = info ?? this.defaultCloudInfo;
    }

    getFromCache = (kustoUri: string) => this.cloudCache[this.getCacheKey(kustoUri)];

    deleteFromCache = (kustoUri: string) => delete this.cloudCache[this.getCacheKey(kustoUri)];

    async getCloudInfoForCluster(kustoUri: string): Promise<CloudInfo> {
        const cacheKey = this.getCacheKey(kustoUri);
        if (cacheKey in this.cloudCache) {
            return this.cloudCache[cacheKey];
        }

        try {
            const response = await axios.get<{ AzureAD: CloudInfo | undefined }>(this.getAuthMetadataEndpointFromClusterUri(kustoUri), {
                headers: {
                    "Cache-Control": "no-cache",
                    // Disable caching - it's being cached in memory (Service returns max-age).
                    // The original motivation for this is due to a CORS issue in Ibiza due to a dynamic subdomain.
                    // The first dynamic subdomain is attached to the cache and for some reason isn't invalidated
                    // when there is a new subdomain. It causes the request failure due to CORS.
                    // Example:
                    // Access to XMLHttpRequest at 'https://safrankecc.canadacentral.kusto.windows.net/v1/rest/auth/metadata' from origin
                    // 'https://sandbox-46-11.reactblade.portal.azure.net' has been blocked by CORS policy: The 'Access-Control-Allow-Origin' header has a value
                    // 'https://sandbox-46-10.reactblade.portal.azure.net' that is not equal to the supplied origin.
                },
                maxRedirects: 0,
            });
            if (response.status === 200) {
                this.cloudCache[cacheKey] = response.data.AzureAD || this.defaultCloudInfo;
            } else {
                throw new Error(`Kusto returned an invalid cloud metadata response - ${response}`);
            }
        } catch (ex) {
            if (axios.isAxiosError(ex)) {
                // Axios library has a bug in browser, not propagating the status code, see: https://github.com/axios/axios/issues/5330
                if ((isNodeLike && ex.response?.status === 404) || (!isNodeLike && (!ex.code || ex.code === AXIOS_ERR_NETWORK))) {
                    // For now as long not all proxies implement the metadata endpoint, if no endpoint exists return public cloud data
                    this.cloudCache[cacheKey] = this.defaultCloudInfo;
                } else {
                    throw new Error(`Failed to get cloud info for cluster ${kustoUri} - ${ex}`);
                }
            }
        }
        return this.cloudCache[cacheKey];
    }

    private getCacheKey(kustoUri: string): string {
        const url = new URL(kustoUri);
        // Return only the protocol and host (includes port if non-standard)
        return `${url.protocol}//${url.host}`;
    }

    getAuthMetadataEndpointFromClusterUri(kustoUri: string): string {
        const url = new URL(kustoUri);
        // Returns endpoint URL in the form of https://<cluster>:port/v1/rest/auth/metadata
        return `${url.protocol}//${url.host}${this.METADATA_ENDPOINT}`;
    }

    static getAuthorityUri(cloudInfo: CloudInfo, authorityId?: string): string {
        return cloudInfo.LoginEndpoint + "/" + (authorityId || "organizations");
    }
}

const cloudSettings = new CloudSettings();
export { cloudSettings as CloudSettings };
export default cloudSettings;
