// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";

import { CloudSettings } from "../src/cloudSettings.js";

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