// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { PublicClientApplication, ConfidentialClientApplication } from "@azure/msal-node";
import { DeviceCodeResponse } from "@azure/msal-common";
import {
    ManagedIdentityCredential,
    AzureCliCredential,
    InteractiveBrowserCredential,
    TokenCredentialOptions,
} from "@azure/identity";
import { CloudSettings, CloudInfo } from "./cloudSettings"
import { TokenCredential } from "@azure/core-auth";

// We want all the Token Providers in this file
/* tslint:disable:max-classes-per-file */

export declare type TokenResponse = {
    tokenType: string;
    accessToken: string;
}

interface TokenType {
    tokenType: string,
    accessToken: string
}


const BEARER_TYPE = "Bearer";

/**
 * This base class abstracts token acquisition for all implementations.
 * The class is build for Lazy initialization, so that the first call, take on instantiation of 'heavy' long-lived class members
 */
export abstract class TokenProviderBase {
    kustoUri: string;
    scopes!: string[];

    abstract acquireToken(): Promise<TokenResponse>;

    protected constructor(kustoUri: string) {
        this.kustoUri = kustoUri;
        if (kustoUri != null) {
            const suffix = this.kustoUri.endsWith("/") ? ".default" : "/.default";
            this.scopes = [kustoUri + suffix];
        }
    }
}

/**
 * Basic Token Provider keeps and returns a token received on construction
 */
export class BasicTokenProvider extends TokenProviderBase {
    token: string;

    constructor(kustoUri: string, token: string) {
        super(kustoUri);
        this.token = token;
    }

    acquireToken(): Promise<TokenResponse> {
        return Promise.resolve<TokenResponse>({ tokenType: BEARER_TYPE, accessToken: this.token });
    }
}

/**
 * Callback Token Provider generates a token based on a callback function provided by the caller
 */
export class CallbackTokenProvider extends TokenProviderBase {
    callback: () => Promise<string>;

    constructor(kustoUri: string, callback: () => Promise<string>) {
        super(kustoUri);
        this.callback = callback;
    }

    async acquireToken(): Promise<TokenResponse> {
        const token = await this.callback();
        return { tokenType: BEARER_TYPE, accessToken: token };
    }
}

/**
 * Acquire a token from MSAL
 */
abstract class MsalTokenProvider extends TokenProviderBase {
    cloudInfo!: CloudInfo;
    authorityId: string;
    initialized: boolean;
    authorityUri: string;

    abstract initClient(): void;
    abstract acquireMsalToken(): Promise<TokenType | null>;

    protected constructor(kustoUri: string, authorityId: string) {
        super(kustoUri);
        this.initialized = false;
        this.authorityId = authorityId;
        this.authorityUri = CloudSettings.getAuthorityUri(this.cloudInfo, this.authorityId);
    }

    async acquireToken(): Promise<TokenResponse> {
        if (!this.initialized) {
            if (this.cloudInfo == null) {
                this.cloudInfo = await CloudSettings.getInstance().getCloudInfoForCluster(this.kustoUri);
                let resourceUri = this.cloudInfo.KustoServiceResourceId;
                if (this.cloudInfo.LoginMfaRequired) {
                    resourceUri = resourceUri.replace(".kusto.", ".kustomfa.")
                }
                this.scopes = [resourceUri + "/.default"]
                this.initClient();
            }
            this.initialized = true;
        }

        const token = await this.acquireMsalToken();
        if (token) {
            return { tokenType: token.tokenType, accessToken: token.accessToken }
        }
        throw new Error("Failed to get token from msal");
    }
}

export abstract class AzureIdentityProvider extends MsalTokenProvider {
    private credential!: TokenCredential;
    protected authorityHost!: string;

    constructor(kustoUri: string, authorityId: string, protected clientId?: string, private timeoutMs?: number) {
        super(kustoUri, authorityId);
    }

    initClient(): void {
        this.authorityHost = this.cloudInfo.LoginEndpoint;
        this.credential = this.getCredential();
    }

    async acquireMsalToken(): Promise<TokenType | null> {
        const response = await this.credential.getToken(this.scopes, {
            requestOptions: {
                timeout: this.timeoutMs
            },
        });
        if (response === null) {
            throw new Error("Failed to get token from msal");
        }
        return { tokenType: BEARER_TYPE, accessToken: response.token };
    }

    abstract getCredential(): TokenCredential;
}

/**
 * MSI Token Provider obtains a token from the MSI endpoint
 * The args parameter is a dictionary conforming with the ManagedIdentityCredential initializer API arguments
 */
export class MsiTokenProvider extends AzureIdentityProvider {
    getCredential(): TokenCredential {
        const options: TokenCredentialOptions = {authorityHost: this.authorityHost};
        return this.clientId ? new ManagedIdentityCredential(this.clientId, options) : new ManagedIdentityCredential(options);
    }
}

/**
 * AzCli Token Provider obtains a refresh token from the AzCli cache and uses it to authenticate with MSAL
 */
export class AzCliTokenProvider extends AzureIdentityProvider {
    getCredential(): TokenCredential {
        return new AzureCliCredential({authorityHost: this.authorityHost});
    }
}

/**
 * AzCli Token Provider obtains a refresh token from the AzCli cache and uses it to authenticate with MSAL
 */
export class InteractiveLoginTokenProvider extends AzureIdentityProvider {
    constructor(kustoUri: string, authorityId: string, clientId?: string, timeoutMs?: number, private loginHint?: string) {
        super(kustoUri, authorityId, clientId, timeoutMs);
    }

    getCredential(): TokenCredential {
        return new InteractiveBrowserCredential({
            authorityHost: this.authorityHost,
            loginHint: this.loginHint,
            clientId: this.clientId,
            // The default port is 80, which can lead to permission errors, so let's set it to a random port
            redirectUri: "http://localhost:23145/"
});
    }
}

/**
 * Acquire a token from MSAL with username and password
 */
export class UserPassTokenProvider extends MsalTokenProvider {
    userName: string;
    password: string;
    homeAccountId?: string;
    msalClient!: PublicClientApplication;

    constructor(kustoUri: string, userName: string, password: string, authorityId: string) {
        super(kustoUri, authorityId);
        this.userName = userName;
        this.password = password;
    }

    initClient(): void {
        const clientConfig = {
            auth: {
                clientId: this.cloudInfo.KustoClientAppId,
                authority: this.authorityUri,
            }
        };
        this.msalClient = new PublicClientApplication(clientConfig);
    }

    async acquireMsalToken(): Promise<TokenType | null> {
        let token = null;
        if (this.homeAccountId != null) {
            const account = await this.msalClient.getTokenCache().getAccountByHomeId(this.homeAccountId)
            if (account) {
                token = await this.msalClient.acquireTokenSilent({ account, scopes: this.scopes });
            }
        }
        if (token == null) {
            token = await this.msalClient.acquireTokenByUsernamePassword({ scopes: this.scopes, username: this.userName, password: this.password });
            this.homeAccountId = token?.account?.homeAccountId;
        }
        return token;
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
        super(kustoUri, authorityId);
        this.deviceCodeCallback = deviceCodeCallback;
    }

    initClient(): void {
        const clientConfig = {
            auth: {
                clientId: this.cloudInfo.KustoClientAppId,
                authority: this.authorityUri,
            },
        };
        this.msalClient = new PublicClientApplication(clientConfig);
    }

    async acquireMsalToken(): Promise<TokenType | null> {
        let token = null;
        if (this.homeAccountId != null) {
            const account = await this.msalClient.getTokenCache().getAccountByHomeId(this.homeAccountId)
            if (account) {
                token = await this.msalClient.acquireTokenSilent({ account, scopes: this.scopes });
            }
        }
        if (token == null) {
            token = await this.msalClient.acquireTokenByDeviceCode({ scopes: this.scopes, deviceCodeCallback: this.deviceCodeCallback });
            this.homeAccountId = token?.account?.homeAccountId;
        }
        return token;
    }
}

/**
 * Acquire a token from MSAL with application Id and Key
 */
export class ApplicationKeyTokenProvider extends MsalTokenProvider {
    appClientId: string;
    appKey: string;
    msalClient!: ConfidentialClientApplication;

    constructor(kustoUri: string, appClientId: string, appKey: string, authorityId: string) {
        super(kustoUri, authorityId);
        this.appClientId = appClientId;
        this.appKey = appKey;
    }

    initClient(): void {
        const clientConfig = {
            auth: {
                clientId: this.appClientId,
                clientSecret: this.appKey,
                authority: this.authorityUri,
            }
        };
        this.msalClient = new ConfidentialClientApplication(clientConfig);
    }

    acquireMsalToken(): Promise<TokenType | null> {
        return this.msalClient.acquireTokenByClientCredential({ scopes: this.scopes });
    }
}

/**
 * Acquire a token from MSAL using application certificate
 * Passing the public certificate is optional and will result in Subject Name & Issuer Authentication
 */
export class ApplicationCertificateTokenProvider extends MsalTokenProvider {
    appClientId: string;
    certThumbprint: string;
    certPrivateKey: string;
    certX5c?: string;
    msalClient!: ConfidentialClientApplication;

    constructor(kustoUri: string, appClientId: string, certThumbprint: string, certPrivateKey: string, certX5c?: string, authorityId?: string) {
        super(kustoUri, authorityId!);
        this.appClientId = appClientId;
        this.certThumbprint = certThumbprint;
        this.certPrivateKey = certPrivateKey;
        this.certX5c = certX5c;
    }

    initClient(): void {
        const clientConfig = {
            auth: {
                clientId: this.appClientId,
                authority: this.authorityUri,
                clientCertificate: {
                    thumbprint: this.certThumbprint,
                    privateKey: this.certPrivateKey,
                    x5c: this.certX5c
                }
            }
        };
        this.msalClient = new ConfidentialClientApplication(clientConfig);
    }

    acquireMsalToken(): Promise<TokenType | null> {
        return this.msalClient.acquireTokenByClientCredential({ scopes: this.scopes });
    }
}
