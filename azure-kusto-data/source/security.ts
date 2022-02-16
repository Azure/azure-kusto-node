// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import KustoConnectionStringBuilder from "./connectionBuilder";
import "./tokenProvider";
import * as TokenProvider from "./tokenProvider";
import { KustoAuthenticationError } from "./errors";

export class AadHelper {
    tokenProvider?: TokenProvider.TokenProviderBase;

    constructor(kcsb: KustoConnectionStringBuilder) {
        if (!kcsb.dataSource) {
            throw new Error("Invalid string builder - missing dataSource");
        }

        if (!!kcsb.aadUserId && !!kcsb.password) {
            this.tokenProvider = new TokenProvider.UserPassTokenProvider(kcsb.dataSource, kcsb.aadUserId, kcsb.password, kcsb.authorityId);
        } else if (!!kcsb.applicationClientId && !!kcsb.applicationKey) {
            this.tokenProvider = new TokenProvider.ApplicationKeyTokenProvider(kcsb.dataSource, kcsb.applicationClientId, kcsb.applicationKey, kcsb.authorityId);
        } else if (!!kcsb.applicationClientId &&
            !!kcsb.applicationCertificateThumbprint && !!kcsb.applicationCertificatePrivateKey) {
            this.tokenProvider = new TokenProvider.ApplicationCertificateTokenProvider(kcsb.dataSource, kcsb.applicationClientId, kcsb.applicationCertificateThumbprint, kcsb.applicationCertificatePrivateKey, kcsb.applicationCertificateX5c as string | undefined, kcsb.authorityId);
        } else if (kcsb.isManagedIdentity) {
            this.tokenProvider = new TokenProvider.MsiTokenProvider(kcsb.dataSource, kcsb.authorityId, kcsb.msiClientId, kcsb.timeoutMs);
        } else if (kcsb.isAzLoginIdentity) {
            this.tokenProvider = new TokenProvider.AzCliTokenProvider(kcsb.dataSource, kcsb.authorityId, undefined, kcsb.timeoutMs);
        } else if (kcsb.accessToken) {
            this.tokenProvider = new TokenProvider.BasicTokenProvider(kcsb.dataSource, kcsb.accessToken as string);
        } else if (kcsb.isInteractiveLogin) {
            this.tokenProvider = new TokenProvider.InteractiveLoginTokenProvider(kcsb.dataSource, kcsb.authorityId, kcsb.applicationClientId, kcsb.timeoutMs, kcsb.loginHint);
        } else if (kcsb.tokenProvider) {
            this.tokenProvider = new TokenProvider.CallbackTokenProvider(kcsb.dataSource, kcsb.tokenProvider);
        } else if (kcsb.isDeviceCode){
            if (kcsb.deviceCodeCallback === undefined) {
                throw new KustoAuthenticationError("Device code authentication requires a callback function", undefined, TokenProvider.DeviceLoginTokenProvider.name, {});
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
            throw new KustoAuthenticationError(e instanceof Error ? e.message : `${e}`, e, this.tokenProvider.constructor.name, this.tokenProvider.context());
        }
    }
}

export default AadHelper;