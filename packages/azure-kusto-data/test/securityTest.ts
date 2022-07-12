// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { KustoConnectionStringBuilder } from "../index";
import AadHelper from "../source/security";
import { CloudSettings } from "../source/cloudSettings";
import assert from "assert";
import { ClientAuthError } from "@azure/msal-node";
import { KustoAuthenticationError } from "../source/errors";
import { CredentialUnavailableError } from "@azure/identity";
import { loginTest, manualLoginTest } from "./data/testUtils";

describe("test errors", () => {
    before(() => {
        CloudSettings.getInstance().cloudCache["https://somecluster.kusto.windows.net"] = CloudSettings.getInstance().defaultCloudInfo;
    });

    it("no data source", () => {
        const kcsb = new KustoConnectionStringBuilder("test");
        kcsb.dataSource = "";

        assert.throws(() => new AadHelper(kcsb), Error, "Invalid string builder - missing dataSource");
    });

    it("test user pass", async () => {
        const cluster = "https://somecluster.kusto.windows.net";
        const username = "username@microsoft.com";
        const kcsb = KustoConnectionStringBuilder.withAadUserPasswordAuthentication(cluster, username, "password", "organizations");

        const helper = new AadHelper(kcsb);
        try {
            await helper.getAuthHeader();
            assert.fail("should throw unauthorized exception");
        } catch (e: unknown) {
            assert.ok(e instanceof KustoAuthenticationError);
            assert.ok(e.inner instanceof ClientAuthError);
            assert.strictEqual(e.tokenProviderName, "UserPassTokenProvider");
            assert.strictEqual(e.context.userName, username);
        }
    }).timeout(10000);

    it("test app key", async () => {
        const cluster = "https://somecluster.kusto.windows.net";
        const appId = "86f7361f-15b7-4f10-aef5-3ce66ac73766";
        const key = "private_key";
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(cluster, appId, key, "organizations");

        const helper = new AadHelper(kcsb);
        try {
            await helper.getAuthHeader();
            assert.fail("should throw unauthorized exception");
        } catch (e: unknown) {
            assert.ok(e instanceof KustoAuthenticationError);
            assert.ok(e.inner instanceof ClientAuthError);
            assert.strictEqual(e.tokenProviderName, "ApplicationKeyTokenProvider");
            assert.strictEqual(e.context.clientId, appId);
        }
    }).timeout(10000);

    it("test app certificate", async () => {
        const cluster = "https://somecluster.kusto.windows.net";
        const appId = "86f7361f-15b7-4f10-aef5-3ce66ac73766";
        const thumb = "thumb";
        const privateKey =
            "-----BEGIN RSA PRIVATE KEY-----\n" +
            "MIICXAIBAAKBgQCqGKukO1De7zhZj6+H0qtjTkVxwTCpvKe4eCZ0FPqri0cb2JZfXJ/DgYSF6vUp\n" +
            "wmJG8wVQZKjeGcjDOL5UlsuusFncCzWBQ7RKNUSesmQRMSGkVb1/3j+skZ6UtW+5u09lHNsj6tQ5\n" +
            "1s1SPrCBkedbNf0Tp0GbMJDyR4e9T04ZZwIDAQABAoGAFijko56+qGyN8M0RVyaRAXz++xTqHBLh\n" +
            "3tx4VgMtrQ+WEgCjhoTwo23KMBAuJGSYnRmoBZM3lMfTKevIkAidPExvYCdm5dYq3XToLkkLv5L2\n" +
            "pIIVOFMDG+KESnAFV7l2c+cnzRMW0+b6f8mR1CJzZuxVLL6Q02fvLi55/mbSYxECQQDeAw6fiIQX\n" +
            "GukBI4eMZZt4nscy2o12KyYner3VpoeE+Np2q+Z3pvAMd/aNzQ/W9WaI+NRfcxUJrmfPwIGm63il\n" +
            "AkEAxCL5HQb2bQr4ByorcMWm/hEP2MZzROV73yF41hPsRC9m66KrheO9HPTJuo3/9s5p+sqGxOlF\n" +
            "L0NDt4SkosjgGwJAFklyR1uZ/wPJjj611cdBcztlPdqoxssQGnh85BzCj/u3WqBpE2vjvyyvyI5k\n" +
            "X6zk7S0ljKtt2jny2+00VsBerQJBAJGC1Mg5Oydo5NwD6BiROrPxGo2bpTbu/fhrT8ebHkTz2epl\n" +
            "U9VQQSQzY1oZMVX8i1m5WUTLPz2yLJIBQVdXqhMCQBGoiuSoSjafUhV7i1cEGpb88h5NBYZzWXGZ\n" +
            "37sJ5QsW+sJyoNde3xH8vdXhzU7eT82D6X/scw9RZz+/6rCJ4p0=\n" +
            "-----END RSA PRIVATE KEY-----";
        const kcsb = KustoConnectionStringBuilder.withAadApplicationCertificateAuthentication(cluster, appId, privateKey, thumb, "organizations");

        const helper = new AadHelper(kcsb);
        try {
            await helper.getAuthHeader();
            assert.fail("should throw unauthorized exception");
        } catch (e: unknown) {
            assert.ok(e instanceof KustoAuthenticationError);
            assert.ok(e.inner instanceof ClientAuthError);
            assert.strictEqual(e.tokenProviderName, "ApplicationCertificateTokenProvider");
            assert.strictEqual(e.context.clientId, appId);
            assert.strictEqual(e.context.thumbprint, thumb);
        }
    }).timeout(10000);

    it("device code without function", () => {
        const kcsb = new KustoConnectionStringBuilder("https://somecluster.kusto.windows.net");
        kcsb.aadFederatedSecurity = true;
        kcsb.authorityId = "organizations";
        kcsb.useDeviceCodeAuth = true;

        assert.throws(() => new AadHelper(kcsb), KustoAuthenticationError, "Device code authentication is not supported without a function");
    });

    it("test msi", async () => {
        const cluster = "https://somecluster.kusto.windows.net";
        const clientId = "86f7361f-15b7-4f10-aef5-3ce66ac73766";
        const kcsb = KustoConnectionStringBuilder.withAadManagedIdentities(cluster, clientId, "organizations", 1);

        const helper = new AadHelper(kcsb);
        try {
            await helper.getAuthHeader();
            assert.fail("should throw unauthorized exception");
        } catch (e: unknown) {
            assert.ok(e instanceof KustoAuthenticationError);
            assert.ok(e.inner instanceof CredentialUnavailableError);
            assert.strictEqual(e.tokenProviderName, "MsiTokenProvider");
            assert.strictEqual(e.context.clientId, clientId);
        }
    }).timeout(10000);
});

describe("Test providers", () => {
    before(() => {
        CloudSettings.getInstance().cloudCache["https://somecluster.kusto.windows.net"] = CloudSettings.getInstance().defaultCloudInfo;
    });

    it("test null", async () => {
        const cluster = "https://somecluster.kusto.windows.net";
        const kcsb = new KustoConnectionStringBuilder(cluster);

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.strictEqual(token, null);
    });

    it("test access token", async () => {
        const cluster = "https://somecluster.kusto.windows.net";
        const kcsb = KustoConnectionStringBuilder.withAccessToken(cluster, "somekey");

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.strictEqual(token, "Bearer somekey");
    });

    it("test callback token provider", async () => {
        const cluster = "https://somecluster.kusto.windows.net";
        const kcsb = KustoConnectionStringBuilder.withTokenProvider(cluster, () => Promise.resolve("somekey"));

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.strictEqual(token, "Bearer somekey");
    });

    loginTest(
        "APP_ID",
        "TENANT_ID",
        "APP_KEY"
    )("test app key token provider", async () => {
        const cluster = "https://somecluster.kusto.windows.net";
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            cluster,
            process.env.APP_ID!,
            process.env.APP_KEY!,
            process.env.TENANT_ID!
        );

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.notStrictEqual(token, null);
    }).timeout(10000);

    manualLoginTest(
        "APP_ID",
        "TENANT_ID",
        "CERT_THUMBPRINT",
        "CERT_PUBLIC",
        "CERT_PEM"
    )("test app certificate token provider", async () => {
        const cluster = "https://somecluster.kusto.windows.net";
        const kcsb = KustoConnectionStringBuilder.withAadApplicationCertificateAuthentication(
            cluster,
            process.env.APP_KEY!,
            process.env.CERT_PEM!,
            process.env.CERT_THUMBPRINT!,
            process.env.CERT_PUBLIC!
        );

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.notStrictEqual(token, null);
    }).timeout(10000);

    manualLoginTest(
        "APP_ID",
        "USER_NAME",
        "USER_PASS"
    )("test user pass provider", async () => {
        const cluster = "https://somecluster.kusto.windows.net";
        const kcsb = KustoConnectionStringBuilder.withAadUserPasswordAuthentication(
            cluster,
            process.env.USER_NAME!,
            process.env.USER_PASS!,
            process.env.TENANT_ID!
        );

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.notStrictEqual(token, null);
    }).timeout(10000);

    manualLoginTest()("test az login", async () => {
        const cluster = "https://somecluster.kusto.windows.net";

        const kcsb = KustoConnectionStringBuilder.withAzLoginIdentity(cluster, "organizations");

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.notStrictEqual(token, null);
    }).timeout(30000);

    manualLoginTest()("test device code", async () => {
        const cluster = "https://somecluster.kusto.windows.net";

        const kcsb = KustoConnectionStringBuilder.withAadDeviceAuthentication(cluster, "organizations");

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.notStrictEqual(token, null);
    }).timeout(30000);

    manualLoginTest()("test user prompt", async () => {
        const cluster = "https://somecluster.kusto.windows.net";

        const kcsb = KustoConnectionStringBuilder.withUserPrompt(cluster, "organizations");

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.notStrictEqual(token, null);
    }).timeout(30000);

    manualLoginTest("TEST_MSI")("test msi", async () => {
        const cluster = "https://somecluster.kusto.windows.net";

        const kcsb = KustoConnectionStringBuilder.withAadManagedIdentities(cluster, undefined, "organizations");

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.notStrictEqual(token, null);
    }).timeout(30000);
});
