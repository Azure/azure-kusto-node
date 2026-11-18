// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CloudSettings } from "../src/cloudSettings.js";
import assert from "assert";
import { CloudSettingsTokenProvider, TokenResponse } from "../src/tokenProvider.js";

class StubTokenProvider extends CloudSettingsTokenProvider {
    constructor(kustoUri: string) {
        super(kustoUri);
    }

    initClient(): void {}

    acquireTokenWithCloudSettings(): Promise<TokenResponse> {
        return Promise.resolve({ tokenType: "Bearer", accessToken: "test-token" });
    }
}

describe("CloudInfo", () => {
    it.each([
        { mfa: false, expectedScope: "https://fakeurl.kusto.windows.net/.default" },
        { mfa: true, expectedScope: "https://fakeurl.kustomfa.windows.net/.default" },
    ])("constructs resource scopes with MFA=$mfa without live authentication", async ({ mfa, expectedScope }) => {
        const cluster = `https://fakeurl-${mfa}.kusto.windows.net`;
        CloudSettings.writeToCache(cluster, {
            ...CloudSettings.defaultCloudInfo,
            LoginMfaRequired: mfa,
            KustoServiceResourceId: "https://fakeurl.kusto.windows.net",
        });
        try {
            const provider = new StubTokenProvider(cluster);
            await provider.acquireToken();
            assert.deepStrictEqual(provider.scopes, [expectedScope]);
        } finally {
            CloudSettings.deleteFromCache(cluster);
        }
    });
});
