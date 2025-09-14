// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { isNodeLike } from "@azure/core-util";

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

        const response = await fetch(this.getAuthMetadataEndpointFromClusterUri(kustoUri), {
            method: "GET",
        });
        let ex;
        if (response.status === 200) {
            this.cloudCache[cacheKey] = ((await response.json()) as { AzureAD: CloudInfo }).AzureAD;
            return this.cloudCache[cacheKey];
        } else if (response.status === 404) {
            // For now as long not all proxies implement the metadata endpoint, if no endpoint exists return public cloud data
            this.cloudCache[cacheKey] = this.defaultCloudInfo;
            return this.cloudCache[cacheKey];
        } else if (response.status >= 300 && response.status < 400) {
            ex = Error(
                `Request was redirected with status ${response.status} (${response.statusText}) to ${response.headers.get("location") || "<unknown>"}. This client does not follow redirects.`,
            );
        } else {
            ex = Error(`Kusto returned an invalid cloud metadata response - ${await response.json()}`);
        }
        throw new Error(`Failed to get cloud info for cluster ${kustoUri} - ${ex}`);
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
