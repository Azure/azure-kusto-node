// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import KustoConnectionStringBuilder from "./connectionBuilder";
import "./tokenProvider";
import * as TokenProvider from "./tokenProvider";

export class AadHelper {
    tokenProvider: TokenProvider.TokenProviderBase;

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
        } else if (kcsb.managedIdentity) {
            this.tokenProvider = new TokenProvider.MsiTokenProvider(kcsb.dataSource, kcsb.msiClientId as string | undefined);
        } else if (kcsb.azLoginIdentity) {
            this.tokenProvider = new TokenProvider.AzCliTokenProvider(kcsb.dataSource);
        } else if (kcsb.accessToken) {
            this.tokenProvider = new TokenProvider.BasicTokenProvider(kcsb.dataSource, kcsb.accessToken as string);
        } else {
            let callback = kcsb.deviceCodeCallback;
            if (!callback) {
                // tslint:disable-next-line:no-console
                callback = (response) => console.log(response.message);
            }
            this.tokenProvider = new TokenProvider.DeviceLoginTokenProvider(kcsb.dataSource, callback);
        }
    }

    async _getAuthHeader(): Promise<string> {
        const token = await this.tokenProvider.acquireToken();
        return `${token.tokenType} ${token.accessToken}`;
    }
}

export default AadHelper;