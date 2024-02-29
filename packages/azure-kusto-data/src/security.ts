// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { KustoConnectionStringBuilder } from "./connectionBuilder";
import * as TokenProvider from "./tokenProvider";
import { KustoAuthenticationError } from "./errors";
import { BasicTokenProvider, CallbackTokenProvider, TokenProviderBase, UserPromptProvider, TokenCredentialProvider } from "./tokenProvider";

export class AadHelper {
    tokenProvider?: TokenProviderBase;

    constructor(kcsb: KustoConnectionStringBuilder) {
        if (!kcsb.dataSource) {
            throw new Error("Invalid string builder - missing dataSource");
        }

        if (!!kcsb.aadUserId && !!kcsb.password) {
            this.tokenProvider = new TokenProvider.UserPassTokenProvider(kcsb.dataSource, kcsb.aadUserId, kcsb.password, kcsb.authorityId, kcsb.timeoutMs);
        } else if (!!kcsb.applicationClientId && !!kcsb.applicationKey) {
            this.tokenProvider = new TokenProvider.ApplicationKeyTokenProvider(
                kcsb.dataSource,
                kcsb.applicationClientId,
                kcsb.applicationKey,
                kcsb.authorityId,
                kcsb.timeoutMs
            );
        } else if (!!kcsb.applicationClientId && (!!kcsb.applicationCertificatePrivateKey || !!kcsb.applicationCertificatePath)) {
            this.tokenProvider = new TokenProvider.ApplicationCertificateTokenProvider(
                kcsb.dataSource,
                kcsb.applicationClientId,
                kcsb.applicationCertificatePrivateKey,
                kcsb.applicationCertificatePath,
                kcsb.applicationCertificateSendX5c,
                kcsb.authorityId,
                kcsb.timeoutMs
            );
        } else if (kcsb.useManagedIdentityAuth) {
            this.tokenProvider = new TokenProvider.MsiTokenProvider(kcsb.dataSource, kcsb.msiClientId, kcsb.authorityId, kcsb.timeoutMs);
        } else if (kcsb.useAzLoginAuth) {
            this.tokenProvider = new TokenProvider.AzCliTokenProvider(kcsb.dataSource, kcsb.authorityId, kcsb.timeoutMs);
        } else if (kcsb.accessToken) {
            this.tokenProvider = new BasicTokenProvider(kcsb.dataSource, kcsb.accessToken as string);
        } else if (kcsb.useUserPromptAuth) {
            this.tokenProvider = new UserPromptProvider(kcsb.dataSource, kcsb.interactiveCredentialOptions, kcsb.timeoutMs);
        } else if (kcsb.tokenProvider) {
            this.tokenProvider = new CallbackTokenProvider(kcsb.dataSource, kcsb.tokenProvider);
        } else if (kcsb.useDeviceCodeAuth) {
            this.tokenProvider = new TokenProvider.DeviceLoginTokenProvider(kcsb.dataSource, kcsb.deviceCodeCallback, kcsb.authorityId, kcsb.timeoutMs);
        } else if (kcsb.tokenCredential) {
            this.tokenProvider = new TokenCredentialProvider(kcsb.dataSource, kcsb.tokenCredential, kcsb.timeoutMs);
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
