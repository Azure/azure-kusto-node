// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DeviceCodeInfo, InteractiveBrowserCredentialInBrowserOptions, InteractiveBrowserCredentialNodeOptions } from "@azure/identity";
import KustoConnectionStringBuilderBase from "./connectionBuilderBase";

export class KustoConnectionStringBuilder extends KustoConnectionStringBuilderBase {
    static readonly DefaultDatabaseName = "NetDefaultDB";
    static readonly SecretReplacement = "****";
    // eslint-disable-next-line no-console

    // TODO delete?
    static withAadUserPasswordAuthentication(_connectionString: string, _userId: string, _password: string, _authorityId?: string) {
        throw new Error("Not supported for browser - use withUserPrompt instead");
    }

    static withAadApplicationKeyAuthentication(_connectionString: string, _aadAppId: string, _appKey: string, _authorityId?: string) {
        throw new Error("Not supported for browser - use withUserPrompt instead");
    }

    static withAadApplicationCertificateAuthentication(
        _connectionString: string,
        _aadAppId: string,
        _applicationCertificatePrivateKey: string,
        _authorityId?: string,
        _applicationCertificateSendX5c?: boolean
    ) {
        throw new Error("Not supported for browser - use withUserPrompt instead");
    }

    static withAadDeviceAuthentication(_connectionString: string, _authorityId?: string, _deviceCodeCallback?: (response: DeviceCodeInfo) => void) {
        throw new Error("Not supported for browser - use withUserPrompt instead");
    }

    static withSystemManagedIdentity(_connectionString: string, _authorityId?: string, _timeoutMs?: number) {
        throw new Error("Not supported for browser - use withUserPrompt instead");
    }

    static withUserManagedIdentity(_connectionString: string, _msiClientId: string, _authorityId?: string, _timeoutMs?: number) {
        throw new Error("Not supported for browser - use withUserPrompt instead");
    }

    static withAzLoginIdentity(_connectionString: string, _authorityId?: string, _timeoutMs?: number) {
        throw new Error("Not supported for browser - use withUserPrompt instead");
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
        interactiveCredentialOptions: InteractiveBrowserCredentialNodeOptions | InteractiveBrowserCredentialInBrowserOptions,
        timeoutMs?: number
    ) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        const { redirectUri, clientId, tenantId } = interactiveCredentialOptions as InteractiveBrowserCredentialInBrowserOptions;
        if (!clientId) {
            throw new Error("You must provide your SPA application client id to authenticate against");
        }

        if (!redirectUri) {
            throw new Error("You must provide a redirectUri registered on the SPA app");
        }

        kcsb.interactiveCredentialOptions = interactiveCredentialOptions;
        kcsb.aadFederatedSecurity = true;
        kcsb.applicationClientId = clientId;
        kcsb.useUserPromptAuth = true;
        if (tenantId) {
            kcsb.authorityId = tenantId;
        }
        kcsb.timeoutMs = timeoutMs;

        return kcsb;
    }
}

export default KustoConnectionStringBuilder;
