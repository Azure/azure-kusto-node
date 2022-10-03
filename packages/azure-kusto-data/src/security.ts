// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import KustoConnectionStringBuilder from "./connectionBuilder";
import TokenProvider = require("#tokenProvider");
import { KustoAuthenticationError } from "./errors";
import { BasicTokenProvider, CallbackTokenProvider, TokenProviderBase, UserPromptProvider } from "./tokenProviderBase";

export class AadHelper {
    tokenProvider?: TokenProviderBase;

    constructor(kcsb: KustoConnectionStringBuilder) {
        if (!kcsb.dataSource) {
            throw new Error("Invalid string builder - missing dataSource");
        }

        if (!!kcsb.applicationClientId && !!kcsb.applicationKey) {
            this.tokenProvider = new TokenProvider.ApplicationKeyTokenProvider(
                kcsb.dataSource,
                kcsb.applicationClientId,
                kcsb.applicationKey,
                kcsb.authorityId
            );
        } else if (!!kcsb.applicationClientId && !!kcsb.applicationCertificateThumbprint && !!kcsb.applicationCertificatePrivateKey) {
            this.tokenProvider = new TokenProvider.ApplicationCertificateTokenProvider(
                kcsb.dataSource,
                kcsb.applicationClientId,
                kcsb.applicationCertificateThumbprint,
                kcsb.applicationCertificatePrivateKey,
                kcsb.applicationCertificateX5c as string | undefined,
                kcsb.authorityId
            );
        } else if (kcsb.useManagedIdentityAuth) {
            this.tokenProvider = new TokenProvider.MsiTokenProvider(kcsb.dataSource, kcsb.msiClientId, kcsb.authorityId, kcsb.timeoutMs);
        } else if (kcsb.useAzLoginAuth) {
            this.tokenProvider = new TokenProvider.AzCliTokenProvider(kcsb.dataSource, kcsb.authorityId, kcsb.timeoutMs);
        } else if (kcsb.accessToken) {
            this.tokenProvider = new BasicTokenProvider(kcsb.dataSource, kcsb.accessToken as string);
        } else if (kcsb.useUserPromptAuth) {
            this.tokenProvider = new UserPromptProvider(kcsb.dataSource, kcsb.authorityId, kcsb.timeoutMs, kcsb.loginHint);
        } else if (kcsb.tokenProvider) {
            this.tokenProvider = new CallbackTokenProvider(kcsb.dataSource, kcsb.tokenProvider);
        } else if (kcsb.useDeviceCodeAuth) {
            if (kcsb.deviceCodeCallback === undefined) {
                throw new KustoAuthenticationError(
                    "Device code authentication requires a callback function",
                    undefined,
                    TokenProvider.DeviceLoginTokenProvider.name,
                    {}
                );
            }
            this.tokenProvider = new TokenProvider.DeviceLoginTokenProvider(kcsb.dataSource, kcsb.deviceCodeCallback, kcsb.authorityId);
        }
    }

    async getAuthHeader(): Promise<string | null> {
        if (!this.tokenProvider) {
            return null;
        }
        try {
            const token = await this.tokenProvider.acquireToken();
            return `${token.tokenType} ${token.accessToken}`;
        } catch (e) {
            throw new KustoAuthenticationError(
                e instanceof Error ? e.message : `${e}`,
                e instanceof Error ? e : undefined,
                this.tokenProvider.constructor.name,
                this.tokenProvider.context()
            );
        }
    }
}

export default AadHelper;
