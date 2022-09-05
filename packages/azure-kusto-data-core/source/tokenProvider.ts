// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { InteractiveBrowserCredential } from "@azure/identity";
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
 * Token providers that require cloud settings to be configured - msal and azure identity
 */
abstract class CloudSettingsTokenProvider extends TokenProviderBase {
    protected cloudInfo!: CloudInfo;
    protected initialized: boolean;

    abstract initClient(): void;

    abstract acquireTokenWithCloudSettings(): Promise<TokenType | null>;

    additionalCloudSettingsInit(): void {}

    protected constructor(kustoUri: string) {
        super(kustoUri);
        this.initialized = false;
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
                this.additionalCloudSettingsInit();
                this.initClient();
            }
            this.initialized = true;
        }

        const token = await this.acquireTokenWithCloudSettings();
        if (token) {
            return { tokenType: token.tokenType, accessToken: token.accessToken };
        }
        throw new Error("Failed to get token from msal");
    }

    context(): Record<string, any> {
        return {
            ...super.context(),
            kustoUri: this.kustoUri,
        };
    }
}

export abstract class AzureIdentityProvider extends CloudSettingsTokenProvider {
    private credential!: TokenCredential;

    constructor(kustoUri: string, protected authorityId?: string, private timeoutMs?: number) {
        super(kustoUri);
    }

    initClient(): void {
        this.credential = this.getCredential();
    }

    async acquireTokenWithCloudSettings(): Promise<TokenType | null> {
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
        if (this.timeoutMs) {
            base = { ...base, timeoutMs: this.timeoutMs };
        }

        return base;
    }

    abstract getCredential(): TokenCredential;
}

/**
 * UserPromptProvider will pop up a login prompt to acquire a token.
 */
export class UserPromptProvider extends AzureIdentityProvider {
    // The default port is 80, which can lead to permission errors, so we'll choose another port
    readonly MinPort = 20000;
    readonly MaxPort = 65536;

    constructor(kustoUri: string, authorityId: string, timeoutMs?: number, private loginHint?: string) {
        super(kustoUri, authorityId, timeoutMs);
    }

    getCredential(): TokenCredential {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return new InteractiveBrowserCredential({
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
