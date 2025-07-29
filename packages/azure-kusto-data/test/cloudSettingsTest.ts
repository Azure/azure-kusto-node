// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";

import { CloudSettings } from "../src/cloudSettings.js";

describe("CloudSettings.getAuthMetadataEndpointFromClusterUri", () => {
    it("valid input", () => {
        assert.strictEqual(
            CloudSettings.getAuthMetadataEndpointFromClusterUri("https://statusreturner.azurewebsites.net/"),
            "https://statusreturner.azurewebsites.net/v1/rest/auth/metadata",
        );

        // With path
        assert.strictEqual(
            CloudSettings.getAuthMetadataEndpointFromClusterUri("https://statusreturner.azurewebsites.net/test/test2/test"),
            "https://statusreturner.azurewebsites.net/v1/rest/auth/metadata",
        );

        // With non-default port
        assert.strictEqual(
            CloudSettings.getAuthMetadataEndpointFromClusterUri("https://statusreturner.azurewebsites.net:5050/"),
            "https://statusreturner.azurewebsites.net:5050/v1/rest/auth/metadata",
        );

        // With leading slash
        assert.strictEqual(
            CloudSettings.getAuthMetadataEndpointFromClusterUri("https://statusreturner.azurewebsites.net//////"),
            "https://statusreturner.azurewebsites.net/v1/rest/auth/metadata",
        );
    });
});

describe("CloudSettings Host-based Caching", () => {
    beforeEach(() => {
        // Clear the cache before each test
        CloudSettings.cloudCache = {};
    });

    afterEach(() => {
        // Clean up cache after each test
        CloudSettings.cloudCache = {};
    });

    it("should cache cloud settings by host only, not by full path", () => {
        const testCloudInfo = {
            LoginEndpoint: "https://login.test.com",
            LoginMfaRequired: true,
            KustoClientAppId: "test-app-id",
            KustoClientRedirectUri: "https://test.redirect.uri",
            KustoServiceResourceId: "https://test.service.resource",
            FirstPartyAuthorityUrl: "https://test.authority.url",
        };

        // URLs with same host but different paths
        const url1 = "https://example.kusto.windows.net/database1";
        const url2 = "https://example.kusto.windows.net/database2";
        const url3 = "https://example.kusto.windows.net/some/nested/path";

        // Write to cache using first URL
        CloudSettings.writeToCache(url1, testCloudInfo);

        // Should be able to retrieve using any URL with the same host
        assert.deepStrictEqual(CloudSettings.getFromCache(url1), testCloudInfo);
        assert.deepStrictEqual(CloudSettings.getFromCache(url2), testCloudInfo);
        assert.deepStrictEqual(CloudSettings.getFromCache(url3), testCloudInfo);

        // Different host should not be cached
        const differentHostUrl = "https://different.kusto.windows.net/database1";
        assert.strictEqual(CloudSettings.getFromCache(differentHostUrl), undefined);
    });

    it("should handle URLs with different ports as different cache entries", () => {
        const testCloudInfo1 = {
            LoginEndpoint: "https://login.test1.com",
            LoginMfaRequired: false,
            KustoClientAppId: "test-app-id-1",
            KustoClientRedirectUri: "https://test1.redirect.uri",
            KustoServiceResourceId: "https://test1.service.resource",
            FirstPartyAuthorityUrl: "https://test1.authority.url",
        };

        const testCloudInfo2 = {
            LoginEndpoint: "https://login.test2.com",
            LoginMfaRequired: true,
            KustoClientAppId: "test-app-id-2",
            KustoClientRedirectUri: "https://test2.redirect.uri",
            KustoServiceResourceId: "https://test2.service.resource",
            FirstPartyAuthorityUrl: "https://test2.authority.url",
        };

        const urlDefaultPort = "https://example.kusto.windows.net/database1";
        const urlCustomPort = "https://example.kusto.windows.net:8080/database1";

        CloudSettings.writeToCache(urlDefaultPort, testCloudInfo1);
        CloudSettings.writeToCache(urlCustomPort, testCloudInfo2);

        assert.deepStrictEqual(CloudSettings.getFromCache(urlDefaultPort), testCloudInfo1);
        assert.deepStrictEqual(CloudSettings.getFromCache(urlCustomPort), testCloudInfo2);

        // URLs with same host and port should share cache
        assert.deepStrictEqual(CloudSettings.getFromCache("https://example.kusto.windows.net/different/path"), testCloudInfo1);
        assert.deepStrictEqual(CloudSettings.getFromCache("https://example.kusto.windows.net:8080/different/path"), testCloudInfo2);
    });

    it("should handle URLs with different protocols as different cache entries", () => {
        const testCloudInfo1 = {
            LoginEndpoint: "https://login.test1.com",
            LoginMfaRequired: false,
            KustoClientAppId: "test-app-id-1",
            KustoClientRedirectUri: "https://test1.redirect.uri",
            KustoServiceResourceId: "https://test1.service.resource",
            FirstPartyAuthorityUrl: "https://test1.authority.url",
        };

        const testCloudInfo2 = {
            LoginEndpoint: "https://login.test2.com",
            LoginMfaRequired: true,
            KustoClientAppId: "test-app-id-2",
            KustoClientRedirectUri: "https://test2.redirect.uri",
            KustoServiceResourceId: "https://test2.service.resource",
            FirstPartyAuthorityUrl: "https://test2.authority.url",
        };

        const httpUrl = "http://example.kusto.windows.net/database1";
        const httpsUrl = "https://example.kusto.windows.net/database1";

        CloudSettings.writeToCache(httpUrl, testCloudInfo1);
        CloudSettings.writeToCache(httpsUrl, testCloudInfo2);

        assert.deepStrictEqual(CloudSettings.getFromCache(httpUrl), testCloudInfo1);
        assert.deepStrictEqual(CloudSettings.getFromCache(httpsUrl), testCloudInfo2);
    });

    it("should properly delete cached entries by host", () => {
        const testCloudInfo = {
            LoginEndpoint: "https://login.test.com",
            LoginMfaRequired: true,
            KustoClientAppId: "test-app-id",
            KustoClientRedirectUri: "https://test.redirect.uri",
            KustoServiceResourceId: "https://test.service.resource",
            FirstPartyAuthorityUrl: "https://test.authority.url",
        };

        const url1 = "https://example.kusto.windows.net/database1";
        const url2 = "https://example.kusto.windows.net/database2";

        // Cache using first URL
        CloudSettings.writeToCache(url1, testCloudInfo);

        // Verify it's cached
        assert.deepStrictEqual(CloudSettings.getFromCache(url1), testCloudInfo);
        assert.deepStrictEqual(CloudSettings.getFromCache(url2), testCloudInfo);

        // Delete using second URL (same host)
        CloudSettings.deleteFromCache(url2);

        // Should be deleted for both URLs since they share the same cache key
        assert.strictEqual(CloudSettings.getFromCache(url1), undefined);
        assert.strictEqual(CloudSettings.getFromCache(url2), undefined);
    });

    it("should use default cloud info when no custom info is provided", () => {
        const url = "https://example.kusto.windows.net/database1";

        // Write to cache without providing custom cloud info
        CloudSettings.writeToCache(url);

        // Should return the default cloud info
        const cachedInfo = CloudSettings.getFromCache(url);
        assert.deepStrictEqual(cachedInfo, CloudSettings.defaultCloudInfo);
    });
});
