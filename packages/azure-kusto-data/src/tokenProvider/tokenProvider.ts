// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { ConfidentialClientApplication, PublicClientApplication } from "@azure/msal-node";
import { DeviceCodeResponse } from "@azure/msal-common";
import { AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";
import { TokenCredential } from "@azure/core-auth";
import { AzureIdentityProvider, MsalTokenProvider, TokenType } from "../tokenProviderBase";


/**
 * MSI Token Provider obtains a token from the MSI endpoint
 * The args parameter is a dictionary conforming with the ManagedIdentityCredential initializer API arguments
 */
export class MsiTokenProvider extends AzureIdentityProvider {
    constructor(kustoUri: string, protected clientId?: string, authorityId?: string, timeoutMs?: number) {
        super(kustoUri, authorityId, timeoutMs);
    }

    getCredential(): TokenCredential {
        return this.clientId ? new ManagedIdentityCredential(this.clientId) : new ManagedIdentityCredential();
    }

    context(): Record<string, any> {
        return {
            ...super.context(),
            clientId: this.clientId,
        };
    }
}

/**
 * AzCli Token Provider obtains a refresh token from the AzCli cache and uses it to authenticate with MSAL
 */
export class AzCliTokenProvider extends AzureIdentityProvider {
    getCredential(): TokenCredential {
        return new AzureCliCredential();
    }
}


/**
 * Acquire a token from MSAL with Device Login flow
 */
export class DeviceLoginTokenProvider extends MsalTokenProvider {
    deviceCodeCallback: (response: DeviceCodeResponse) => void;
    homeAccountId?: string;
    msalClient!: PublicClientApplication;

    constructor(kustoUri: string, deviceCodeCallback: (response: DeviceCodeResponse) => void, authorityId: string) {
        super(kustoUri, authorityId, undefined);
        this.deviceCodeCallback = deviceCodeCallback;
    }

    initClient(): void {
        this.msalClient = new PublicClientApplication(this.commonOptions());
    }

    async acquireTokenWithCloudSettings(): Promise<TokenType | null> {
        let token = null;
        if (this.homeAccountId != null) {
            const cache = this.msalClient.getTokenCache();
            const account = await cache.getAccountByHomeId(this.homeAccountId)
            if (account) {
                token = await this.msalClient.acquireTokenSilent({
                    account,
                    scopes: this.scopes,
                });
            }
        }
        if (token == null) {
            token = await this.msalClient.acquireTokenByDeviceCode({
                scopes: this.scopes,
                deviceCodeCallback: this.deviceCodeCallback,
            });
            this.homeAccountId = token?.account?.homeAccountId;
        }
        return token;
    }
}


/**
 * Acquire a token from MSAL using application certificate
 * Passing the public certificate is optional and will result in Subject Name & Issuer Authentication
 */
export class ApplicationCertificateTokenProvider extends MsalTokenProvider {
    msalClient!: ConfidentialClientApplication;

    constructor(
        kustoUri: string,
        private appClientId: string,
        private certThumbprint: string,
        private certPrivateKey: string,
        private certX5c?: string,
        authorityId?: string
    ) {
        super(kustoUri, authorityId!, appClientId);
    }

    initClient(): void {
        const commonOptions = this.commonOptions();
        const clientConfig = {
            ...commonOptions,
            auth: {
                ...commonOptions.auth,
                clientCertificate: {
                    thumbprint: this.certThumbprint,
                    privateKey: this.certPrivateKey,
                    x5c: this.certX5c,
                },
            },
        };
        this.msalClient = new ConfidentialClientApplication(clientConfig);
    }

    acquireTokenWithCloudSettings(): Promise<TokenType | null> {
        return this.msalClient.acquireTokenByClientCredential({
            scopes: this.scopes,
        });
    }

    context(): Record<string, any> {
        return {
            ...super.context(),
            clientId: this.appClientId,
            thumbprint: this.certThumbprint,
        };
    }
}


/**
 * Acquire a token from MSAL with application id and Key
 */
 export class ApplicationKeyTokenProvider extends MsalTokenProvider {
    msalClient!: ConfidentialClientApplication;

    constructor(kustoUri: string, private appClientId: string, private appKey: string, authorityId: string) {
        super(kustoUri, authorityId, appClientId);
    }

    initClient(): void {
        const commonOptions = this.commonOptions();
        const clientConfig = {
            ...commonOptions,
            auth: {
                ...commonOptions.auth,
                clientSecret: this.appKey,
            },
        };
        this.msalClient = new ConfidentialClientApplication(clientConfig);
    }

    acquireTokenWithCloudSettings(): Promise<TokenType | null> {
        return this.msalClient.acquireTokenByClientCredential({
            scopes: this.scopes,
        });
    }

    context(): Record<string, any> {
        return { ...super.context(), clientId: this.appClientId };
    }
}
