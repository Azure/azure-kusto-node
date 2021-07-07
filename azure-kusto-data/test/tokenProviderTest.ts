// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CloudSettings } from "../source/cloudSettings";
import { UserPassTokenProvider } from "../source/tokenProvider"

const assert = require("assert");


describe("CloudInfo", function () {
    describe("#CloudInfo", function () {
        it("mfa off", async function () {
            const fakeUri = "https://fakeurl_mfa.kusto.windows.net"
            const cloudInfo =
            {
                LoginEndpoint: process.env.AadAuthorityUri || "https://login.microsoftonline.com",
                LoginMfaRequired: false,
                KustoClientAppId: "1234",
                KustoClientRedirectUri: "https://microsoft/kustoclient",
                KustoServiceResourceId: "https://fakeurl.kusto.windows.net",
                FirstPartyAuthorityUrl: "https://login.microsoftonline.com/8cdef31-a31e-4b4a-93e4-5f571e91255a",
            }
            CloudSettings.getInstance().cloudCache[fakeUri] = cloudInfo;

            const provider = new UserPassTokenProvider(fakeUri, "auth_test", "a", "b")
            try {
                await provider.acquireToken();
            }
            catch { }// We should fail to aquire token but we want to validate the CloudSettings which acquireToken init

            assert.equal(provider.scopes[0], "https://fakeurl.kusto.windows.net/.default");
        });

        it("mfa off", async function () {
            const fakeUri2 = "https://fakeurl2.kusto.windows.net"
            const cloudInfo =
            {
                LoginEndpoint: process.env.AadAuthorityUri || "https://login.microsoftonline.com",
                LoginMfaRequired: true,
                KustoClientAppId: "1234",
                KustoClientRedirectUri: "https://microsoft/kustoclient",
                KustoServiceResourceId: "https://fakeurl.kusto.windows.net",
                FirstPartyAuthorityUrl: "https://login.microsoftonline.com/f8cdef31-a31e-4b4a-93e4-5f571e91255a",
            }
            CloudSettings.getInstance().cloudCache[fakeUri2] = cloudInfo;

            const provider = new UserPassTokenProvider(fakeUri2, "auth_test", "a", "b")
            try {
                await provider.acquireToken();
            }
            catch { }// We should fail to aquire token but we want to validate the CloudSettings which acquireToken init

            assert.equal(provider.scopes[0], "https://fakeurl.kustomfa.windows.net/.default");
        });
    });
});
