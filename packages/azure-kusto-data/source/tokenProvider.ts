// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CloudInfo, CloudSettings } from "./cloudSettings";
import { TokenCredential } from "@azure/core-auth";
import { PublicClientApplication } from "@azure/msal-browser";
import { DeviceCodeResponse } from "@azure/msal-common";

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

    abstract initClient(): void;

    abstract acquireMsalToken(): Promise<TokenType | null>;

    protected constructor(kustoUri: string, authorityId: string) {
        super(kustoUri);
        this.initialized = false;
        this.authorityId = authorityId;
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
                this.initClient();
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
 * Acquire a token from MSAL with username and password
 */
export class UserPromptProvider extends MsalTokenProvider {
    homeAccountId?: string;
    msalClient!: PublicClientApplication;

    constructor(kustoUri: string, authorityId: string) {
        super(kustoUri, authorityId);
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
            const account = this.msalClient.getAccountByHomeId(this.homeAccountId);
            if (account) {
                token = await this.msalClient.acquireTokenSilent({
                    account,
                    scopes: this.scopes,
                });
            }
        }
        if (token == null) {
            token = await this.msalClient.acquireTokenPopup({
                scopes: this.scopes,
            });
            this.homeAccountId = token?.account?.homeAccountId;
        }
        return token;
    }

    context(): Record<string, any> {
        return {
            ...super.context(),
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
            const account = this.msalClient.getAccountByHomeId(this.homeAccountId);
            if (account) {
                token = await this.msalClient.acquireTokenSilent({
                    account,
                    scopes: this.scopes,
                });
            }
        }
        if (token == null) {
            token = await this.msalClient.acquireTokenByCode({
                scopes: this.scopes,
                // deviceCodeCallback: this.deviceCodeCallback,
            });
            this.homeAccountId = token?.account?.homeAccountId;
        }
        return token;
    }
}
