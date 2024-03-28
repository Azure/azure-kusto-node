// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import axios from "axios";
import { isNode } from "@azure/core-util";

export type CloudInfo = {
    LoginEndpoint: string;
    LoginMfaRequired: boolean;
    KustoClientAppId: string;
    KustoClientRedirectUri: string;
    KustoServiceResourceId: string;
    FirstPartyAuthorityUrl: string;
};

/**
 * This class holds data for all cloud instances, and returns the specific data instance by parsing the dns suffix from a URL
 */
class CloudSettings {
    METADATA_ENDPOINT = "/v1/rest/auth/metadata";
    defaultCloudInfo: CloudInfo = {
        LoginEndpoint: process.env?.AadAuthorityUri || "https://login.microsoftonline.com",
        LoginMfaRequired: false,
        KustoClientAppId: "db662dc1-0cfe-4e1c-a843-19a68e65be58",
        KustoClientRedirectUri: "https://microsoft/kustoclient",
        KustoServiceResourceId: "https://kusto.kusto.windows.net",
        FirstPartyAuthorityUrl: "https://login.microsoftonline.com/f8cdef31-a31e-4b4a-93e4-5f571e91255a",
    };
    cloudCache: { [kustoUri: string]: CloudInfo } = {};

    writeToCache(url: string, info?: CloudInfo) {
        this.cloudCache[this.normalizeUrl(url)] = info ?? this.defaultCloudInfo;
    }

    getFromCache = (kustoUri: string) => this.cloudCache[this.normalizeUrl(kustoUri)];

    deleteFromCache = (kustoUri: string) => delete this.cloudCache[this.normalizeUrl(kustoUri)];

    async getCloudInfoForCluster(kustoUri: string): Promise<CloudInfo> {
        kustoUri = this.normalizeUrl(kustoUri);
        if (kustoUri in this.cloudCache) {
            return this.cloudCache[kustoUri];
        }

        try {
            const response = await axios.get<{ AzureAD: CloudInfo | undefined }>(kustoUri + this.METADATA_ENDPOINT, {
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
                this.cloudCache[kustoUri] = response.data.AzureAD || this.defaultCloudInfo;
            } else {
                throw new Error(`Kusto returned an invalid cloud metadata response - ${response}`);
            }
        } catch (ex) {
            if (axios.isAxiosError(ex)) {
                // Axios library has a bug in browser, not propagating the status code, see: https://github.com/axios/axios/issues/5330
                if ((ex.response?.status === 404 && isNode) || (!isNode && (!ex.code || ex.code === "ERR_NETWORK" ))) {
                    // For now as long not all proxies implement the metadata endpoint, if no endpoint exists return public cloud data
                    this.cloudCache[kustoUri] = this.defaultCloudInfo;
                } else {
                    throw new Error(`Failed to get cloud info for cluster ${kustoUri} - ${ex}`);
                }
            }
        }
        return this.cloudCache[kustoUri];
    }

    private normalizeUrl(kustoUri: string) {
        const url = new URL(kustoUri);
        const urlString = url.toString();
        if (urlString.endsWith("/")) {
            return urlString.slice(0, urlString.length - 1);
        }
        return urlString;
    }

    static getAuthorityUri(cloudInfo: CloudInfo, authorityId?: string): string {
        return cloudInfo.LoginEndpoint + "/" + (authorityId || "organizations");
    }
}

const cloudSettings = new CloudSettings();
export { cloudSettings as CloudSettings };
export default cloudSettings;
