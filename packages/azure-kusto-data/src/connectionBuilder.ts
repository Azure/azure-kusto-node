// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DeviceCodeInfo, InteractiveBrowserCredentialInBrowserOptions, InteractiveBrowserCredentialNodeOptions } from "@azure/identity";
import { KustoConnectionStringBuilderBase } from "./connectionBuilderBase";

export class KustoConnectionStringBuilder extends KustoConnectionStringBuilderBase {
    static readonly DefaultDatabaseName = "NetDefaultDB";
    static readonly SecretReplacement = "****";

    static withAadUserPasswordAuthentication(connectionString: string, userId: string, password: string, authorityId?: string) {
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

    static withAadApplicationKeyAuthentication(connectionString: string, aadAppId: string, appKey: string, authorityId?: string) {
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
        applicationCertificatePrivateKey: string,
        authorityId?: string,
        applicationCertificateSendX5c?: boolean
    ) {
        if (aadAppId.trim().length === 0) throw new Error("Invalid app id");
        if (applicationCertificatePrivateKey.trim().length === 0) throw new Error("Invalid certificate");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;
        kcsb.applicationClientId = aadAppId;
        kcsb.applicationCertificatePrivateKey = applicationCertificatePrivateKey;
        kcsb.applicationCertificateSendX5c = applicationCertificateSendX5c;

        if (authorityId) {
            kcsb.authorityId = authorityId;
        }

        return kcsb;
    }

    static withAadDeviceAuthentication(connectionString: string, authorityId?: string, deviceCodeCallback?: (response: DeviceCodeInfo) => void) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }
        kcsb.deviceCodeCallback = deviceCodeCallback;
        kcsb.useDeviceCodeAuth = true;

        return kcsb;
    }

    private static withAadManagedIdentities(connectionString: string, msiClientId?: string, authorityId?: string, timeoutMs?: number) {
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

    static withSystemManagedIdentity(connectionString: string, authorityId?: string, timeoutMs?: number) {
        return this.withAadManagedIdentities(connectionString, undefined, authorityId, timeoutMs);
    }

    static withUserManagedIdentity(connectionString: string, msiClientId: string, authorityId?: string, timeoutMs?: number) {
        return this.withAadManagedIdentities(connectionString, msiClientId, authorityId, timeoutMs);
    }

    static withAzLoginIdentity(connectionString: string, authorityId?: string, timeoutMs?: number) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;

        kcsb.useAzLoginAuth = true;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }
        kcsb.timeoutMs = timeoutMs;

        return kcsb;
    }

    static withAccessToken(connectionString: string, accessToken: string) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;

        kcsb.accessToken = accessToken;

        return kcsb;
    }

    static withTokenProvider(connectionString: string, tokenProvider: () => Promise<string>) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;

        kcsb.tokenProvider = tokenProvider;

        return kcsb;
    }

    static withUserPrompt(
        connectionString: string,
        options?: InteractiveBrowserCredentialNodeOptions | InteractiveBrowserCredentialInBrowserOptions,
        timeoutMs?: number
    ) {
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
}

export default KustoConnectionStringBuilder;
