// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { AzureCliCredential, ManagedIdentityCredential, ClientSecretCredential, ClientCertificateCredential, ClientCertificateCredentialOptions, ClientCertificatePEMCertificate, DeviceCodeCredential, DeviceCodeInfo } from "@azure/identity";
import { TokenCredential } from "@azure/core-auth";
import { InteractiveBrowserCredential } from "@azure/identity";
import { CloudInfo, CloudSettings } from "./cloudSettings";

export declare type TokenResponse = {
    tokenType: string;
    accessToken: string;
};

export interface TokenType {
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
export abstract class CloudSettingsTokenProvider extends TokenProviderBase {
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
            clientId:this.cloudInfo.KustoClientAppId,
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
 * Acquire a token from  Device Login flow
 */
export class DeviceLoginTokenProvider extends AzureIdentityProvider {
    constructor(kustoUri: string, private deviceCodeCallback?: (response: DeviceCodeInfo) => void, authorityId?: string) {
        super(kustoUri, authorityId, undefined);
    }

    getCredential(): TokenCredential {
        return new DeviceCodeCredential(
            {
                tenantId: this.authorityId,
                clientId: this.cloudInfo.KustoClientAppId,
                userPromptCallback: this.deviceCodeCallback
            }
        );
    }

}

/**
 * Acquire a token from MSAL using application certificate
 * Passing the public certificate is optional and will result in Subject Name & Issuer Authentication
 */
export class ApplicationCertificateTokenProvider extends AzureIdentityProvider {
    constructor (
        kustoUri: string,
        private appClientId: string,
        private certPrivateKey: string,
        private sendX5c?: boolean,
        authorityId?: string
    ) {
        super(kustoUri, authorityId!);
    }

    getCredential(): TokenCredential {
        return new ClientCertificateCredential(
            this.authorityId!,
            this.appClientId!,
            {
                certificate: this.certPrivateKey
            } as ClientCertificatePEMCertificate,
            {
                sendCertificateChain: this.sendX5c
            } as ClientCertificateCredentialOptions,
        );
    }
}


/**
 * Acquire a token from MSAL with application id and Key
 */
 export class ApplicationKeyTokenProvider extends AzureIdentityProvider {
    constructor(kustoUri: string, private appClientId: string, private appKey: string, authorityId: string) {
        super(kustoUri, authorityId);
    }

    getCredential(): TokenCredential {
        return new ClientSecretCredential(
            this.authorityId!, // The tenant ID in Azure Active Directory
            this.appClientId, // The app registration client Id in the AAD tenant
            this.appKey // The app registration secret for the registered application
          );
    }

    context(): Record<string, any> {
        return { ...super.context(), clientId: this.appClientId };
    }
}
