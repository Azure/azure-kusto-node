// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";

import { CloudSettings } from "../src/cloudSettings.js";
import { sanitizeUrlForLogging } from "../src/utils.js";

describe("CloudSettings.getAuthMetadataEndpointFromClusterUri", () => {
    it("valid input", () => {
        assert.strictEqual(
            CloudSettings.getAuthMetadataEndpointFromClusterUri("https://statusreturner.azurewebsites.net/"),
            "https://statusreturner.azurewebsites.net/v1/rest/auth/metadata"
        );

        // With path
        assert.strictEqual(
            CloudSettings.getAuthMetadataEndpointFromClusterUri("https://statusreturner.azurewebsites.net/test/test2/test"),
            "https://statusreturner.azurewebsites.net/v1/rest/auth/metadata"
        );

        // With non-default port
        assert.strictEqual(
            CloudSettings.getAuthMetadataEndpointFromClusterUri("https://statusreturner.azurewebsites.net:5050/"),
            "https://statusreturner.azurewebsites.net:5050/v1/rest/auth/metadata"
        );

        // With leading slash
        assert.strictEqual(
            CloudSettings.getAuthMetadataEndpointFromClusterUri("https://statusreturner.azurewebsites.net//////"),
            "https://statusreturner.azurewebsites.net/v1/rest/auth/metadata"
        );
    });
});

describe("sanitizeUrlForLogging", () => {
    it("should remove query parameters from URLs", () => {
        // Test basic URL without query parameters
        assert.strictEqual(
            sanitizeUrlForLogging("https://example.kusto.windows.net"),
            "https://example.kusto.windows.net/"
        );

        // Test URL with sensitive query parameters
        assert.strictEqual(
            sanitizeUrlForLogging("https://example.kusto.windows.net?sig=secret123&param=value"),
            "https://example.kusto.windows.net/"
        );

        // Test URL with path and query parameters
        assert.strictEqual(
            sanitizeUrlForLogging("https://example.kusto.windows.net/path/to/resource?sig=secret&token=abc"),
            "https://example.kusto.windows.net/path/to/resource"
        );

        // Test URL with port and query parameters
        assert.strictEqual(
            sanitizeUrlForLogging("https://example.kusto.windows.net:8080/api?sig=secret"),
            "https://example.kusto.windows.net:8080/api"
        );

        // Test malformed URL
        assert.strictEqual(
            sanitizeUrlForLogging("not-a-url"),
            "[invalid-url]"
        );

        // Test empty string
        assert.strictEqual(
            sanitizeUrlForLogging(""),
            "[invalid-url]"
        );
    });

    it("should use sanitized URL in error messages when cloud info fails", async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const testCloudSettings = new (CloudSettings.constructor as any)();
        const testUrl = "https://invalid-cluster.kusto.windows.net?sig=sensitive_secret&token=abc123";

        try {
            // This should fail since it's an invalid cluster
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await testCloudSettings.getCloudInfoForCluster(testUrl);
            assert.fail("Expected getCloudInfoForCluster to throw an error");
        } catch (error) {
            const errorMessage = (error as Error).message;

            // Verify the error message contains the sanitized URL (without query parameters)
            assert(errorMessage.includes("https://invalid-cluster.kusto.windows.net/"),
                `Error message should contain sanitized URL. Got: ${errorMessage}`);

            // Verify the error message does NOT contain sensitive information
            assert(!errorMessage.includes("sig=sensitive_secret"),
                `Error message should not contain sensitive query parameter. Got: ${errorMessage}`);
            assert(!errorMessage.includes("token=abc123"),
                `Error message should not contain sensitive query parameter. Got: ${errorMessage}`);
        }
    });
});