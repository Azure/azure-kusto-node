// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DeviceCodeInfo } from "@azure/identity";
import KustoConnectionStringBuilderBase from "./connectionBuilderBase";

export class KustoConnectionStringBuilder extends KustoConnectionStringBuilderBase {
    static readonly DefaultDatabaseName = "NetDefaultDB";
    static readonly SecretReplacement = "****";
    // eslint-disable-next-line no-console

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

    static withAadDeviceAuthentication(
        _connectionString: string,
        _authorityId?: string,
        _deviceCodeCallback?: (response: DeviceCodeInfo) => void
    ) {
        throw new Error("Not supported for browser - use withUserPrompt instead")
    }

    static withSystemManagedIdentity(_connectionString: string, _authorityId?: string, _timeoutMs?: number) {
        throw new Error("Not supported for browser - use withUserPrompt instead")
    }

    static withUserManagedIdentity(_connectionString: string, _msiClientId: string, _authorityId?: string, _timeoutMs?: number) {
        throw new Error("Not supported for browser - use withUserPrompt instead")
    }

    static withAzLoginIdentity(_connectionString: string, _authorityId?: string, _timeoutMs?: number) {
        throw new Error("Not supported for browser - use withUserPrompt instead")
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

    static withUserPrompt(connectionString: string, authorityId?: string, timeoutMs?: number, loginHint?: string) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;

        kcsb.useUserPromptAuth = true;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }
        kcsb.loginHint = loginHint;
        kcsb.timeoutMs = timeoutMs;

        return kcsb;
    }
}

export default KustoConnectionStringBuilder;
