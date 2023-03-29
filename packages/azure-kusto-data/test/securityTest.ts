// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { KustoConnectionStringBuilder } from "../src/index";
import AadHelper from "../src/security";
import { CloudSettings } from "../src/cloudSettings";
import assert from "assert";
import { KustoAuthenticationError } from "../src/errors";
import { CredentialUnavailableError } from "@azure/identity";
import { loginTest, manualLoginTest } from "./data/testUtils";

describe("test errors", () => {
    beforeAll(() => {
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
            assert.strictEqual(e.tokenProviderName, "UserPassTokenProvider");
            assert.strictEqual(e.context.userName, username);
        }
    });

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
            assert.strictEqual(e.tokenProviderName, "ApplicationKeyTokenProvider");
            assert.strictEqual(e.context.clientId, appId);
        }
    });

    it("h", async () => {
        const cluster = "https://somecluster.kusto.windows.net";
        const appId = "86f7361f-15b7-4f10-aef5-3ce66ac73766";
        const privateKey =
            "-----BEGIN CERTIFICATE----\n" +
            "MIICXAIBAAKBgQCqGKukO1De7zhZj6+H0qtjTkVxwTCpvKe4eCZ0FPqri0cb2JZfXJ/DgYSF6vUp" +
            "wmJG8wVQZKjeGcjDOL5UlsuusFncCzWBQ7RKNUSesmQRMSGkVb1/3j+skZ6UtW+5u09lHNsj6tQ5" +
            "1s1SPrCBkedbNf0Tp0GbMJDyR4e9T04ZZwIDAQABAoGAFijko56+qGyN8M0RVyaRAXz++xTqHBLh" +
            "3tx4VgMtrQ+WEgCjhoTwo23KMBAuJGSYnRmoBZM3lMfTKevIkAidPExvYCdm5dYq3XToLkkLv5L2" +
            "pIIVOFMDG+KESnAFV7l2c+cnzRMW0+b6f8mR1CJzZuxVLL6Q02fvLi55/mbSYxECQQDeAw6fiIQX" +
            "GukBI4eMZZt4nscy2o12KyYner3VpoeE+Np2q+Z3pvAMd/aNzQ/W9WaI+NRfcxUJrmfPwIGm63il" +
            "AkEAxCL5HQb2bQr4ByorcMWm/hEP2MZzROV73yF41hPsRC9m66KrheO9HPTJuo3/9s5p+sqGxOlF" +
            "L0NDt4SkosjgGwJAFklyR1uZ/wPJjj611cdBcztlPdqoxssQGnh85BzCj/u3WqBpE2vjvyyvyI5k" +
            "X6zk7S0ljKtt2jny2+00VsBerQJBAJGC1Mg5Oydo5NwD6BiROrPxGo2bpTbu/fhrT8ebHkTz2epl" +
            "U9VQQSQzY1oZMVX8i1m5WUTLPz2yLJIBQVdXqhMCQBGoiuSoSjafUhV7i1cEGpb88h5NBYZzWXGZ" +
            "37sJ5QsW+sJyoNde3xH8vdXhzU7eT82D6X/scw9RZz+/6rCJ4p0=\n" +
            "-----END CERTIFICATE----";
        const kcsb = KustoConnectionStringBuilder.withAadApplicationCertificateAuthentication(cluster, appId, privateKey, "organizations");

        const helper = new AadHelper(kcsb);
        try {
            await helper.getAuthHeader();
            assert.fail("should throw unauthorized exception");
        } catch (e: unknown) {
            assert.ok(e instanceof KustoAuthenticationError);
            assert.strictEqual(e.context.clientId, appId);
        }
    });

    // Does not throw anymore - behavior is printing to console by @azure/identity
    it("device code without function", () => {
        const kcsb = new KustoConnectionStringBuilder("https://somecluster.kusto.windows.net");
        kcsb.aadFederatedSecurity = true;
        kcsb.authorityId = "organizations";
        kcsb.useDeviceCodeAuth = true;

        assert.doesNotThrow(() => new AadHelper(kcsb));
    });

    it("test msi", async () => {
        const cluster = "https://somecluster.kusto.windows.net";
        const clientId = "86f7361f-15b7-4f10-aef5-3ce66ac73766";
        const kcsb = KustoConnectionStringBuilder.withUserManagedIdentity(cluster, clientId, "organizations", 1);

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
    });
});

describe("Test providers", () => {
    beforeAll(() => {
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
    });

    manualLoginTest(
        "APP_ID",
        "TENANT_ID",
        "CERT_PUBLIC",
        "CERT_PEM"
    )("test app certificate token provider", async () => {
        const cluster = "https://somecluster.kusto.windows.net";
        const kcsb = KustoConnectionStringBuilder.withAadApplicationCertificateAuthentication(
            cluster,
            process.env.APP_KEY!,
            process.env.CERT_PEM!,
            process.env.CERT_PUBLIC!
        );

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.notStrictEqual(token, null);
    });

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
    });

    manualLoginTest()("test az login", async () => {
        const cluster = "https://somecluster.kusto.windows.net";

        const kcsb = KustoConnectionStringBuilder.withAzLoginIdentity(cluster);

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.notStrictEqual(token, null);
    });

    manualLoginTest()("test device code", async () => {
        const cluster = "https://somecluster.kusto.windows.net";

        const kcsb = KustoConnectionStringBuilder.withAadDeviceAuthentication(cluster, "organizations");

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.notStrictEqual(token, null);
    });

    manualLoginTest()("test user prompt", async () => {
        const cluster = "https://somecluster.kusto.windows.net";

        const kcsb = KustoConnectionStringBuilder.withUserPrompt(cluster);

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.notStrictEqual(token, null);
    });

    manualLoginTest("TEST_MSI", "MSI_ID")("test msi user", async () => {
        const cluster = "https://somecluster.kusto.windows.net";

        const kcsb = KustoConnectionStringBuilder.withUserManagedIdentity(cluster, process.env.MSI_ID!);

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.notStrictEqual(token, null);
    });

    manualLoginTest("TEST_MSI")("test msi system", async () => {
        const cluster = "https://somecluster.kusto.windows.net";

        const kcsb = KustoConnectionStringBuilder.withSystemManagedIdentity(cluster);

        const helper = new AadHelper(kcsb);
        const token = await helper.getAuthHeader();
        assert.notStrictEqual(token, null);
    });
});
