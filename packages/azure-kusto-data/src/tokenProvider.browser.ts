// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.


import { DeviceCodeResponse } from "@azure/msal-common";
import { TokenCredential } from "@azure/core-auth";
import { AzureIdentityProvider, MsalTokenProvider, TokenType } from "./tokenProviderBase";
import { PublicClientApplication } from "@azure/msal-browser";

export class MsiTokenProvider extends AzureIdentityProvider {
    constructor(kustoUri: string, protected clientId?: string, authorityId?: string, timeoutMs?: number) {
        super(kustoUri, authorityId, timeoutMs);
        throw new Error("MsiTokenProvider is not supported for browsers.");
    }
    
    getCredential(): TokenCredential {
        throw new Error("Method not implemented.");
    }
}

export class AzCliTokenProvider extends AzureIdentityProvider {
    getCredential(): TokenCredential {
        throw new Error("AzCliTokenProvider is not supported for browsers.");
    }
}


/**
 * Acquire a token from MSAL with Device Login flow
 */
 export class DeviceLoginTokenProvider extends MsalTokenProvider {
    homeAccountId?: string;
    msalClient!: PublicClientApplication;

    constructor(kustoUri: string, _deviceCodeCallback: (response: DeviceCodeResponse) => void, authorityId: string) {
        super(kustoUri, authorityId, undefined);
        throw new Error("DeviceLoginTokenProvider is not supported for browsers.");
    }
    
    initClient(): void {
        throw new Error("Method not implemented.");
    }
    acquireTokenWithCloudSettings(): Promise<TokenType | null> {
        throw new Error("Method not implemented.");
    }
}


/**
 * Acquire a token from MSAL with application id and Key
 */
 export class ApplicationKeyTokenProvider extends MsalTokenProvider {
    constructor(kustoUri: string, _appClientId: string, _appKey: string, authorityId: string) {
        super(kustoUri, authorityId, _appClientId);
        throw new Error("ApplicationKeyTokenProvider is not supported for browsers.");
    }

    initClient(): void {
        throw new Error("Method not implemented.");
    }
    acquireTokenWithCloudSettings(): Promise<TokenType | null> {
        throw new Error("Method not implemented.");
    }
}


/**
 * Acquire a token from MSAL using application certificate
 * Passing the public certificate is optional and will result in Subject Name & Issuer Authentication
 */
 export class ApplicationCertificateTokenProvider extends MsalTokenProvider {
    constructor(
        kustoUri: string,
        appClientId: string,
        _certThumbprint: string,
        _certPrivateKey: string,
        _certX5c?: string,
        authorityId?: string
    ) {
        super(kustoUri, authorityId!, appClientId);
        throw new Error("ApplicationCertificateTokenProvider is not supported for browsers.");
    }

    initClient(): void {
        throw new Error("Method not implemented.");
    }
    acquireTokenWithCloudSettings(): Promise<TokenType | null> {
        throw new Error("Method not implemented.");
    }
}
