// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DeviceCodeInfo, InteractiveBrowserCredentialInBrowserOptions, InteractiveBrowserCredentialNodeOptions, TokenCredential } from "@azure/identity";
import { KustoConnectionStringBuilderBase } from "./connectionBuilderBase";
import fs from "fs";

/*
 * A builder for Kusto connection strings
 * For browsers use withUserPrompt or provide the token yourself using withTokenProvider
 */
export class KustoConnectionStringBuilder extends KustoConnectionStringBuilderBase {
    static readonly DefaultDatabaseName = "NetDefaultDB";
    static readonly SecretReplacement = "****";

    static withAadUserPasswordAuthentication(connectionString: string, userId: string, password: string, authorityId?: string): KustoConnectionStringBuilder {
        if (userId.trim().length === 0) throw new Error("Invalid user");
        if (password.trim().length === 0) throw new Error("Invalid password");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;
        kcsb.aadUserId = userId;
        kcsb.password = password;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }

        return kcsb;
    }

    static withAadApplicationKeyAuthentication(connectionString: string, aadAppId: string, appKey: string, authorityId?: string): KustoConnectionStringBuilder {
        if (aadAppId.trim().length === 0) throw new Error("Invalid app id");
        if (appKey.trim().length === 0) throw new Error("Invalid app key");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;
        kcsb.applicationClientId = aadAppId;
        kcsb.applicationKey = appKey;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }

        return kcsb;
    }

    static withAadApplicationCertificateAuthentication(
        connectionString: string,
        aadAppId: string,
        applicationCertificatePrivateKeyOrPath: string,
        authorityId?: string,
        applicationCertificateSendX5c?: boolean
    ): KustoConnectionStringBuilder {
        if (aadAppId.trim().length === 0) throw new Error("Invalid app id");
        if (applicationCertificatePrivateKeyOrPath.trim().length === 0) throw new Error("Invalid certificate key or path");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;
        kcsb.applicationClientId = aadAppId;
        try {
            fs.lstatSync("test.txt");
            kcsb.applicationCertificatePath = applicationCertificatePrivateKeyOrPath;
        } catch (e) {
            // No such file
            kcsb.applicationCertificatePrivateKey = applicationCertificatePrivateKeyOrPath;
        }

        kcsb.applicationCertificateSendX5c = applicationCertificateSendX5c;

        if (authorityId) {
            kcsb.authorityId = authorityId;
        }

        return kcsb;
    }

    static withAadDeviceAuthentication(
        connectionString: string,
        authorityId?: string,
        deviceCodeCallback?: (response: DeviceCodeInfo) => void
    ): KustoConnectionStringBuilder {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }
        kcsb.deviceCodeCallback = deviceCodeCallback;
        kcsb.useDeviceCodeAuth = true;

        return kcsb;
    }

    private static withAadManagedIdentities(
        connectionString: string,
        msiClientId?: string,
        authorityId?: string,
        timeoutMs?: number
    ): KustoConnectionStringBuilder {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }
        kcsb.msiClientId = msiClientId;
        kcsb.timeoutMs = timeoutMs;
        kcsb.useManagedIdentityAuth = true;

        return kcsb;
    }

    static withSystemManagedIdentity(connectionString: string, authorityId?: string, timeoutMs?: number): KustoConnectionStringBuilder {
        return this.withAadManagedIdentities(connectionString, undefined, authorityId, timeoutMs);
    }

    static withUserManagedIdentity(connectionString: string, msiClientId: string, authorityId?: string, timeoutMs?: number): KustoConnectionStringBuilder {
        return this.withAadManagedIdentities(connectionString, msiClientId, authorityId, timeoutMs);
    }

    static withAzLoginIdentity(connectionString: string, authorityId?: string, timeoutMs?: number): KustoConnectionStringBuilder {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;

        kcsb.useAzLoginAuth = true;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }
        kcsb.timeoutMs = timeoutMs;

        return kcsb;
    }

    static withAccessToken(connectionString: string, accessToken: string): KustoConnectionStringBuilder {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;

        kcsb.accessToken = accessToken;

        return kcsb;
    }

    static withTokenProvider(connectionString: string, tokenProvider: () => Promise<string>): KustoConnectionStringBuilder {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;

        kcsb.tokenProvider = tokenProvider;

        return kcsb;
    }

    /**
     * Use InteractiveBrowserCredentialNodeOptions in Node.JS and InteractiveBrowserCredentialInBrowserOptions in browser
     * For browser cors issue: you need to visit your app registration and update the redirect URI you're using to the type spa (for "single page application").
     * See: https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/identity/identity/test/manual/interactive-browser-credential
     */
    static withUserPrompt(
        connectionString: string,
        options?: InteractiveBrowserCredentialNodeOptions | InteractiveBrowserCredentialInBrowserOptions,
        timeoutMs?: number
    ): KustoConnectionStringBuilder {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        const { tenantId, clientId } = (options as InteractiveBrowserCredentialNodeOptions) || {};
        if (clientId) {
            throw new Error("clientId should be empty as it is retrived from the service management endpoint");
        }

        kcsb.aadFederatedSecurity = true;
        kcsb.useUserPromptAuth = true;
        if (tenantId) {
            kcsb.authorityId = tenantId;
        }

        kcsb.timeoutMs = timeoutMs;

        return kcsb;
    }

    static withTokenCredential(connectionString: string, credential: TokenCredential): KustoConnectionStringBuilder {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.tokenCredential = credential;

        return kcsb;
    }
}

export default KustoConnectionStringBuilder;
