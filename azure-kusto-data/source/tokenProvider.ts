// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as msal from "@azure/msal-node";
import { DeviceCodeResponse } from "@azure/msal-common";
import { AzureCliCredentials } from "@azure/ms-rest-nodeauth";
import { ManagedIdentityCredential } from "@azure/identity";
import { CloudSettings, CloudInfo } from "./cloudSettings"

export declare type TokenResponse = {
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

    abstract name: string;
    abstract acquireToken(): Promise<TokenResponse>;

    constructor(kustoUri: string) {
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
    context = { "authority": this.name };
    name = "CallbackTokenProvider";
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
    context = { "authority": this.name };
    name = "CallbackTokenProvider";
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


// MSI Token Provider obtains a token from the MSI endpoint
// The args parameter is a dictionary conforming with the ManagedIdentityCredential initializer API arguments
export class MsiTokenProvider extends TokenProviderBase {
    context = { "authority": this.name };
    name = "CallbackTokenProvider";
    clientId: string;
    managedIdentityCredential!: ManagedIdentityCredential;

    constructor(kustoUri: string, clientId: string) {
        super(kustoUri);
        this.clientId = clientId;
    }

    init(): void {
        return;
    }

    async acquireToken(): Promise<TokenResponse> {
        if (this.managedIdentityCredential == null) {
            this.managedIdentityCredential = new ManagedIdentityCredential(this.clientId);
        }
        const msiToken = await this.managedIdentityCredential.getToken(this.kustoUri);
        if (msiToken?.token != null) {
            return { tokenType: BEARER_TYPE, accessToken: msiToken.token };
        }
        throw new Error(`"Failed to obtain MSI token for '${this.kustoUri}' with '${this.clientId}'`)
    }
}

/**
 * AzCli Token Provider obtains a refresh token from the AzCli cache and uses it to authenticate with MSAL
 */
export class AzCliTokenProvider extends TokenProviderBase {
    context = { "authority": this.name };
    name = "CallbackTokenProvider";
    azureCliCredentials!: AzureCliCredentials;

    constructor(kustoUri: string) {
        super(kustoUri);
    }

    async acquireToken(): Promise<TokenResponse> {
        if (this.azureCliCredentials == null) {
            this.azureCliCredentials = await AzureCliCredentials.create({ resource: this.kustoUri });
        }
        return this.azureCliCredentials.getToken();
    }
}

/**
 * Acquire a token from MSAL using cache
 */
abstract class MsalTokenProvider extends TokenProviderBase {
    msalClient!: msal.ClientApplication;
    cloudInfo!: CloudInfo;
    authorityId?: string;
    initialized: boolean;
    abstract initClient(): void;
    abstract acquireMsalToken(): Promise<msal.AuthenticationResult | null>;

    constructor(kustoUri: string, authorityId?: string) {
        super(kustoUri);
        this.initialized = false;
        this.authorityId = authorityId;
    }

    async acquireToken(): Promise<TokenResponse> {
        if (!this.initialized) {
            if (this.cloudInfo != null) {
                this.cloudInfo = await CloudSettings.getInstance().getCloudInfoForCluster(this.kustoUri);
                let resourceUri = this.cloudInfo.kustoServiceResourceId;
                if (this.cloudInfo.loginMfaRequired) {
                    resourceUri = resourceUri.replace(".kusto.", ".kustomfa.")
                }
                this.scopes = [resourceUri + "/.default"]
                this.initClient();
            }
            this.initialized = true;
        }

        let token;
        const tokenCache = this.msalClient.getTokenCache();
        if (tokenCache != null) {
            const accounts = await tokenCache.getAllAccounts();
            if (accounts.length > 0) {
                token = await this.msalClient.acquireTokenSilent({ scopes: this.scopes, account: accounts[0] });
            }
        }
        if (token == null) {
            token = await this.acquireMsalToken();
        }
        if (token != null) {
            return { tokenType: token.tokenType, accessToken: token.accessToken }
        }
        throw new Error("Failed to get token from msal");
    }
}

/**
 * Acquire a token from MSAL with username and password
 */
export class UserPassTokenProvider extends MsalTokenProvider {
    name = "UserPassTokenProvider";
    msalClient!: msal.PublicClientApplication;
    userName: string;
    password: string;

    constructor(kustoUri: string, userName: string, password: string, authorityId?: string) {
        super(kustoUri, authorityId);
        this.userName = userName;
        this.password = password;
    }

    initClient(): void {
        const clientConfig = {
            auth: {
                clientId: this.cloudInfo.kustoClientAppId,
                authority: CloudSettings.getAuthorityUri(this.cloudInfo, this.authorityId),
            }
        };
        this.msalClient = new msal.PublicClientApplication(clientConfig);
    }

    acquireMsalToken(): Promise<msal.AuthenticationResult | null> {
        return this.msalClient.acquireTokenByUsernamePassword({ scopes: this.scopes, username: this.userName, password: this.password });
    }
}

/**
 * Acquire a token from MSAL with Device Login flow
 */
export class DeviceLoginTokenProvider extends MsalTokenProvider {
    name = "DeviceLoginTokenProvider";
    msalClient!: msal.PublicClientApplication;
    deviceCodeCallback: (response: DeviceCodeResponse) => void;

    constructor(kustoUri: string, deviceCodeCallback: (response: DeviceCodeResponse) => void, authorityId?: string) {
        super(kustoUri, authorityId);
        this.deviceCodeCallback = deviceCodeCallback;
    }

    initClient(): void {
        const clientConfig = {
            auth: {
                clientId: this.cloudInfo.kustoClientAppId,
                authority: CloudSettings.getAuthorityUri(this.cloudInfo, this.authorityId),
            }
        };
        this.msalClient = new msal.PublicClientApplication(clientConfig);
    }

    acquireMsalToken(): Promise<msal.AuthenticationResult | null> {
        return this.msalClient.acquireTokenByDeviceCode({ scopes: this.scopes, deviceCodeCallback: this.deviceCodeCallback });

    }
}

/**
 * Acquire a token from MSAL with application Id and Key
 */
export class ApplicationKeyTokenProvider extends MsalTokenProvider {
    name = "ApplicationKeyTokenProvider";
    msalClient!: msal.ConfidentialClientApplication;
    appClientId: string;
    appKey: string;

    constructor(kustoUri: string, appClientId: string, appKey: string, authorityId?: string) {
        super(kustoUri, authorityId);
        this.appClientId = appClientId;
        this.appKey = appKey;
    }

    initClient(): void {
        const clientConfig = {
            auth: {
                clientId: this.appClientId,
                clientSecret: this.appKey,
                authority: CloudSettings.getAuthorityUri(this.cloudInfo, this.authorityId),
            }
        };
        this.msalClient = new msal.ConfidentialClientApplication(clientConfig);
    }

    acquireMsalToken(): Promise<msal.AuthenticationResult | null> {
        return this.msalClient.acquireTokenByClientCredential({ scopes: this.scopes });
    }
}

/**
 * Acquire a token from MSAL using application certificate
 * Passing the public certificate is optional and will result in Subject Name & Issuer Authentication
 */
export class ApplicationCertificateTokenProvider extends MsalTokenProvider {
    name = "ApplicationCertificateTokenProvider";
    appClientId: string;
    certThumbprint: string;
    certPrivateKey: string;
    msalClient!: msal.ConfidentialClientApplication;

    constructor(kustoUri: string, appClientId: string, certThumbprint: string, certPrivateKey: string, authorityId?: string) {
        super(kustoUri, authorityId);
        this.appClientId = appClientId;
        this.certThumbprint = certThumbprint;
        this.certPrivateKey = certPrivateKey;
    }

    initClient(): void {
        const clientConfig = {
            auth: {
                clientId: this.appClientId,
                authority: CloudSettings.getAuthorityUri(this.cloudInfo, this.authorityId),
                clientCertificate: {
                    thumbprint: this.certThumbprint,
                    privateKey: this.certPrivateKey
                }
            }
        };
        this.msalClient = new msal.ConfidentialClientApplication(clientConfig);
    }

    acquireMsalToken(): Promise<msal.AuthenticationResult | null> {
        return this.msalClient.acquireTokenByClientCredential({ scopes: this.scopes });
    }
}
