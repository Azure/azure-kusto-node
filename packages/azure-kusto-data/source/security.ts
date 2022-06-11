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

        if (kcsb.accessToken) {
            this.tokenProvider = new TokenProvider.BasicTokenProvider(kcsb.dataSource, kcsb.accessToken as string);
        } else if (kcsb.useUserPromptAuth) {
            this.tokenProvider = new TokenProvider.UserPromptProvider(kcsb.dataSource, kcsb.authorityId);
        } else if (kcsb.tokenProvider) {
            this.tokenProvider = new TokenProvider.CallbackTokenProvider(kcsb.dataSource, kcsb.tokenProvider);
        } else if (kcsb.useDeviceCodeAuth) {
            this.tokenProvider = new TokenProvider.DeviceLoginTokenProvider(kcsb.dataSource, () => {}, kcsb.authorityId);
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
