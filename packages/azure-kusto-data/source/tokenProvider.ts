// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ConfidentialClientApplication, PublicClientApplication, Configuration } from "@azure/msal-node";
import { DeviceCodeResponse } from "@azure/msal-common";
import { AzureCliCredential, InteractiveBrowserCredential, ManagedIdentityCredential, TokenCredentialOptions } from "@azure/identity";
import { CloudInfo, CloudSettings } from "./cloudSettings";
import { TokenCredential } from "@azure/core-auth";

export declare type TokenResponse = {
    tokenType: string;
    accessToken: string;
};

interface TokenType {
    tokenType: string;
    accessToken: string;
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

    context(): Record<string, any> {
        return {};
    }

    protected constructor(kustoUri: string) {
        this.kustoUri = kustoUri;
        if (kustoUri != null) {
            const suffix = (!this.kustoUri.endsWith("/") ? "/" : "") + ".default";
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
        return Promise.resolve<TokenResponse>({
            tokenType: BEARER_TYPE,
            accessToken: this.token,
        });
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
    authorityUri!: string;

    abstract initClient(commonOptions: Configuration): void;

    abstract acquireMsalToken(): Promise<TokenType | null>;

    protected constructor(kustoUri: string, authorityId: string) {
        super(kustoUri);
        this.initialized = false;
        this.authorityId = authorityId;
    }

    commonOptions(): Configuration {
        return {
            auth: {
                clientId: this.cloudInfo.KustoClientAppId,
                knownAuthorities: [this.cloudInfo.LoginEndpoint],
                authority: this.authorityUri,
            },
        };
    }

    async acquireToken(): Promise<TokenResponse> {
        if (!this.initialized) {
            if (this.cloudInfo == null) {
                this.cloudInfo = await CloudSettings.getInstance().getCloudInfoForCluster(this.kustoUri);
                let resourceUri = this.cloudInfo.KustoServiceResourceId;
                if (this.cloudInfo.LoginMfaRequired) {
                    resourceUri = resourceUri.replace(".kusto.", ".kustomfa.");
                }
                this.scopes = [resourceUri + "/.default"];
                this.authorityUri = CloudSettings.getAuthorityUri(this.cloudInfo, this.authorityId);
                this.initClient(this.commonOptions());
            }
            this.initialized = true;
        }

        const token = await this.acquireMsalToken();
        if (token) {
            return { tokenType: token.tokenType, accessToken: token.accessToken };
        }
        throw new Error("Failed to get token from msal");
    }

    context(): Record<string, any> {
        return {
            ...super.context(),
            kustoUri: this.kustoUri,
            authorityId: this.authorityId,
        };
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

    getCommonOptions(): {
        authorityHost: string;
        clientId: string | undefined;
        tenantId: string;
    } {
        return {
            authorityHost: this.authorityHost,
            tenantId: this.authorityId,
            clientId: this.clientId,
        };
    }

    async acquireMsalToken(): Promise<TokenType | null> {
        const response = await this.credential.getToken(this.scopes, {
            requestOptions: {
                timeout: this.timeoutMs,
            },
            tenantId: this.authorityId,
        });
        if (response === null) {
            throw new Error("Failed to get token from msal");
        }
        return { tokenType: BEARER_TYPE, accessToken: response.token };
    }

    context(): Record<string, any> {
        let base: Record<string, any> = {
            ...super.context(),
            kustoUri: this.kustoUri,
            authorityId: this.authorityId,
        };
        if (this.clientId) {
            base = { ...base, clientId: this.clientId };
        }
        if (this.timeoutMs) {
            base = { ...base, timeoutMs: this.timeoutMs };
        }

        return base;
    }

    abstract getCredential(): TokenCredential;
}

/**
 * MSI Token Provider obtains a token from the MSI endpoint
 * The args parameter is a dictionary conforming with the ManagedIdentityCredential initializer API arguments
 */
export class MsiTokenProvider extends AzureIdentityProvider {
    getCredential(): TokenCredential {
        const options: TokenCredentialOptions = this.getCommonOptions();
        return this.clientId ? new ManagedIdentityCredential(this.clientId, options) : new ManagedIdentityCredential(options);
    }
}

/**
 * AzCli Token Provider obtains a refresh token from the AzCli cache and uses it to authenticate with MSAL
 */
export class AzCliTokenProvider extends AzureIdentityProvider {
    getCredential(): TokenCredential {
        return new AzureCliCredential(this.getCommonOptions());
    }
}

/**
 * UserPromptProvider will pop up a login prompt to acquire a token.
 */
export class UserPromptProvider extends AzureIdentityProvider {
    // The default port is 80, which can lead to permission errors, so we'll choose another port
    readonly MinPort = 20000;
    readonly MaxPort = 65536;

    constructor(kustoUri: string, authorityId: string, clientId?: string, timeoutMs?: number, private loginHint?: string) {
        super(kustoUri, authorityId, clientId, timeoutMs);
    }

    getCredential(): TokenCredential {
        return new InteractiveBrowserCredential({
            ...this.getCommonOptions(),
            loginHint: this.loginHint,
            redirectUri: `http://localhost:${this.getRandomPortInRange()}/`,
        });
    }

    private getRandomPortInRange() {
        return Math.floor(Math.random() * (this.MaxPort - this.MinPort) + this.MinPort);
    }

    context(): Record<string, any> {
        let base = super.context();
        if (this.loginHint) {
            base = { ...base, loginHint: this.loginHint };
        }
        return base;
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

    initClient(commonOptions: Configuration): void {
        this.msalClient = new PublicClientApplication(commonOptions);
    }

    async acquireMsalToken(): Promise<TokenType | null> {
        let token = null;
        if (this.homeAccountId != null) {
            const account = await this.msalClient.getTokenCache().getAccountByHomeId(this.homeAccountId);
            if (account) {
                token = await this.msalClient.acquireTokenSilent({
                    account,
                    scopes: this.scopes,
                });
            }
        }
        if (token == null) {
            token = await this.msalClient.acquireTokenByUsernamePassword({
                scopes: this.scopes,
                username: this.userName,
                password: this.password,
            });
            this.homeAccountId = token?.account?.homeAccountId;
        }
        return token;
    }

    context(): Record<string, any> {
        return {
            ...super.context(),
            userName: this.userName,
            homeAccountId: this.homeAccountId,
        };
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

    initClient(commonOptions: Configuration): void {
        this.msalClient = new PublicClientApplication(commonOptions);
    }

    async acquireMsalToken(): Promise<TokenType | null> {
        let token = null;
        if (this.homeAccountId != null) {
            const account = await this.msalClient.getTokenCache().getAccountByHomeId(this.homeAccountId);
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

    initClient(commonOptions: Configuration): void {
        const clientConfig = {
            ...commonOptions,
            auth: {
                ...commonOptions.auth,
                clientId: this.appClientId,
                clientSecret: this.appKey,
            },
        };
        this.msalClient = new ConfidentialClientApplication(clientConfig);
    }

    acquireMsalToken(): Promise<TokenType | null> {
        return this.msalClient.acquireTokenByClientCredential({
            scopes: this.scopes,
        });
    }

    context(): Record<string, any> {
        return { ...super.context(), clientId: this.appClientId };
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

    initClient(commonOptions: Configuration): void {
        const clientConfig = {
            ...commonOptions,
            auth: {
                ...commonOptions.auth,
                clientId: this.appClientId,
                clientCertificate: {
                    thumbprint: this.certThumbprint,
                    privateKey: this.certPrivateKey,
                    x5c: this.certX5c,
                },
            },
        };
        this.msalClient = new ConfidentialClientApplication(clientConfig);
    }

    acquireMsalToken(): Promise<TokenType | null> {
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
