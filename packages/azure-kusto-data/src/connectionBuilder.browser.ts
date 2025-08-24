// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { DeviceCodeInfo, InteractiveBrowserCredentialInBrowserOptions, InteractiveBrowserCredentialNodeOptions, TokenCredential } from "@azure/identity";
import KustoConnectionStringBuilderBase from "./connectionBuilderBase.js";

/* eslint-disable @typescript-eslint/no-unused-vars */

export class KustoConnectionStringBuilder extends KustoConnectionStringBuilderBase {
    static readonly DefaultDatabaseName = "NetDefaultDB";
    static readonly SecretReplacement = "****";

    static withAadUserPasswordAuthentication(
        _connectionString: string,
        _userId: string,
        _password: string,
        _authorityId?: string,
    ): KustoConnectionStringBuilder {
        throw new Error("Not supported in browser - use withUserPrompt instead");
    }

    static withAadApplicationKeyAuthentication(
        _connectionString: string,
        _aadAppId: string,
        _appKey: string,
        _authorityId?: string,
    ): KustoConnectionStringBuilder {
        throw new Error("Not supported in browser - use withUserPrompt instead");
    }

    static withAadApplicationCertificateAuthentication(
        _connectionString: string,
        _aadAppId: string,
        _applicationCertificatePrivateKey?: string,
        _authorityId?: string,
        _applicationCertificateSendX5c?: boolean,
        _applicationCertificatePath?: string,
    ): KustoConnectionStringBuilder {
        throw new Error("Not supported in browser - use withUserPrompt instead");
    }

    static withAadDeviceAuthentication(
        _connectionString: string,
        _authorityId?: string,
        _deviceCodeCallback?: (response: DeviceCodeInfo) => void,
    ): KustoConnectionStringBuilder {
        throw new Error("Not supported in browser - use withUserPrompt instead");
    }

    static withSystemManagedIdentity(_connectionString: string, _authorityId?: string, _timeoutMs?: number): KustoConnectionStringBuilder {
        throw new Error("Not supported in browser - use withUserPrompt instead");
    }

    static withUserManagedIdentity(_connectionString: string, _msiClientId: string, _authorityId?: string, _timeoutMs?: number): KustoConnectionStringBuilder {
        throw new Error("Not supported in browser - use withUserPrompt instead");
    }

    static withAzLoginIdentity(_connectionString: string, _authorityId?: string, _timeoutMs?: number): KustoConnectionStringBuilder {
        throw new Error("Not supported in browser - use withUserPrompt instead");
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

    static withUserPrompt(
        connectionString: string,
        interactiveCredentialOptions: InteractiveBrowserCredentialNodeOptions | InteractiveBrowserCredentialInBrowserOptions,
        timeoutMs?: number,
    ): KustoConnectionStringBuilder {
        if (!interactiveCredentialOptions) {
            throw new Error(
                "Invalid parameters - You must provide interactiveCredentialOptions={clientId: string, redirectUri:string} to authenticate with user prompt in browser.",
            );
        }
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        const { redirectUri, clientId, tenantId } = interactiveCredentialOptions as InteractiveBrowserCredentialInBrowserOptions;
        if (!clientId) {
            throw new Error("Invalid parameters - You must provide your SPA application client id to authenticate against");
        }

        if (!redirectUri) {
            throw new Error("Invalid parameters - You must provide a redirectUri registered on the SPA app");
        }

        if (tenantId) {
            kcsb.authorityId = tenantId;
        } else {
            interactiveCredentialOptions.tenantId = kcsb.authorityId;
        }

        kcsb.interactiveCredentialOptions = interactiveCredentialOptions;
        kcsb.aadFederatedSecurity = true;
        kcsb.applicationClientId = clientId;
        kcsb.useUserPromptAuth = true;

        kcsb.timeoutMs = timeoutMs;

        return kcsb;
    }

    static withTokenCredential(connectionString: string, credential: TokenCredential): KustoConnectionStringBuilder {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.tokenCredential = credential;

        return kcsb;
    }

    static fromExisting(other: KustoConnectionStringBuilderBase): KustoConnectionStringBuilderBase {
        return Object.assign(new KustoConnectionStringBuilder(other.toString(false)), other);
    }
}

export default KustoConnectionStringBuilder;
