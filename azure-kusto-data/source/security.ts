// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.


import {AuthenticationContext, TokenResponse, UserCodeInfo} from "adal-node";
import acquireManagedIdentityToken from "./managedIdentitiesClient";
import azLoginIdentityToken from "./azLoginIdentityClient";
import KustoConnectionStringBuilder from "./connectionBuilder";

enum AuthenticationMethod {
    username = 0,
    appKey = 1,
    appCertificate = 2,
    deviceLogin = 3,
    managedIdentities = 4,
    azLogin = 5,
    accessToken = 6,
}

interface UsernameMethod {
    authMethod: AuthenticationMethod.username;
    clientId: string;
    username: string;
    password: string;
}

interface AppKeyMethod {
    authMethod: AuthenticationMethod.appKey;
    clientId: string;
    clientSecret: string;
}

interface AppCertificateMethod {
    authMethod: AuthenticationMethod.appCertificate;
    clientId: string;
    certificate: string;
    thumbprint: string;
}

interface AppManagedIdentityMethod {
    authMethod: AuthenticationMethod.managedIdentities;
    msiEndpoint: string;
    msiSecret: string;
    msiClientId: string;
}

interface AzLoginMethod {
    authMethod: AuthenticationMethod.azLogin;
}

interface AccessTokenMethod {
    authMethod: AuthenticationMethod.accessToken;
    accessToken: string;
}

interface DeviceLoginMethod {
    authMethod: AuthenticationMethod.deviceLogin;
    clientId: string;
    authCallback: (info: UserCodeInfo) => void;
}

type Method =
    UsernameMethod
    | AppKeyMethod
    | AppCertificateMethod
    | AppManagedIdentityMethod
    | AzLoginMethod
    | AccessTokenMethod
    | DeviceLoginMethod;

export class AadHelper {
    token: {};
    kustoCluster: string;
    adalContext: AuthenticationContext;
    method: Method;

    constructor(kcsb: KustoConnectionStringBuilder) {
        this.token = {};

        const authority = kcsb.authorityId || "common";
        let url;

        if (!kcsb.dataSource) {
            throw new Error("Invalid string builder - missing dataSource");
        }

        // support node compatibility
        try {
            url = new URL(kcsb.dataSource); // CHANGE
        } catch (e) {
            const URL = require("url").URL;
            url = new URL(kcsb.dataSource);
        }

        const aadAuthorityUri = process.env.AadAuthorityUri;
        const fullAuthorityUri = aadAuthorityUri ?
            aadAuthorityUri + (aadAuthorityUri.endsWith("/") ? "" : "/") + authority
            : `https://login.microsoftonline.com/${authority}`;

        this.kustoCluster = `${url.protocol}//${url.hostname}`;
        this.adalContext = new AuthenticationContext(fullAuthorityUri);
        if (!!kcsb.aadUserId && !!kcsb.password) {
            this.method = {
                authMethod: AuthenticationMethod.username,
                clientId: "db662dc1-0cfe-4e1c-a843-19a68e65be58",
                username: kcsb.aadUserId,
                password: kcsb.password,
            }
        } else if (!!kcsb.applicationClientId && !!kcsb.applicationKey) {
            this.method = {
                authMethod: AuthenticationMethod.appKey,
                clientId: kcsb.applicationClientId,
                clientSecret: kcsb.applicationKey,
            }
        } else if (!!kcsb.applicationClientId &&
            !!kcsb.applicationCertificate && !!kcsb.applicationCertificateThumbprint) {
            this.method = {
                authMethod: AuthenticationMethod.appCertificate,
                clientId: kcsb.applicationClientId,
                certificate: kcsb.applicationCertificate,
                thumbprint: kcsb.applicationCertificateThumbprint
            }
        } else if (kcsb.managedIdentity) {
            this.method = {
                authMethod: AuthenticationMethod.managedIdentities,
                msiEndpoint: kcsb.msiEndpoint as string,
                msiSecret: kcsb.msiSecret as string,
                msiClientId: kcsb.msiClientId as string
            }
        } else if (kcsb.azLoginIdentity) {
            this.method = {authMethod: AuthenticationMethod.azLogin}
        } else if (kcsb.accessToken) {
            this.method = {
                authMethod: AuthenticationMethod.accessToken,
                accessToken: kcsb.accessToken as string
            }
        } else {
            this.method = {
                authMethod: AuthenticationMethod.deviceLogin,
                clientId: "db662dc1-0cfe-4e1c-a843-19a68e65be58",
                authCallback: kcsb.AuthorizationCallback as (info: UserCodeInfo) => void
            }
        }
    }

    _getAuthHeader(): Promise<string> {
        return new Promise((resolve, reject) => {
            this._getAuthHeaderWithCallback((error, authHeader) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(authHeader as string);
                }
            });
        });
    }

    _getAuthHeaderWithCallback(cb: (e: string | Error | null | undefined, token?: string) => any) {
        const resource = this.kustoCluster;
        const formatHeader = ({
                                  tokenType,
                                  accessToken
                              }: TokenResponse) => `${tokenType} ${accessToken}`;

        switch (this.method.authMethod) {
            case AuthenticationMethod.username:
                return this.adalContext.acquireTokenWithUsernamePassword(
                    resource, this.method.username, this.method.password, this.method.clientId, (err, tokenResponse) => {
                        return cb(err, tokenResponse && formatHeader(tokenResponse as TokenResponse));
                    }
                );
            case AuthenticationMethod.appKey:
                return this.adalContext.acquireTokenWithClientCredentials(
                    resource, this.method.clientId, this.method.clientSecret, (err, tokenResponse) => {
                        return cb(err, tokenResponse && formatHeader(tokenResponse as TokenResponse));
                    }
                );
            case AuthenticationMethod.appCertificate:
                return this.adalContext.acquireTokenWithClientCertificate(
                    resource, this.method.clientId, this.method.certificate, this.method.thumbprint, (err, tokenResponse) => {
                        return cb(err, tokenResponse && formatHeader(tokenResponse as TokenResponse));
                    }
                );
            case AuthenticationMethod.deviceLogin:
                return this.adalContext.acquireUserCode(resource, this.method.clientId, "", (err, tokenResponse) => {
                    this.method = (this.method as DeviceLoginMethod);
                    if (err) {
                        return cb(err);
                    } else {
                        if (this.method.authCallback) {
                            this.method.authCallback(tokenResponse);
                        } else {
                            // tslint:disable-next-line:no-console
                            console.log(tokenResponse.message);
                        }

                        return this.adalContext.acquireTokenWithDeviceCode(resource, this.method.clientId, tokenResponse, (innerError, innerResponse) => {
                            if (innerError) {
                                return cb(innerError);
                            }

                            return cb(innerError, innerResponse && formatHeader(innerResponse as TokenResponse));
                        });

                    }
                });
            case AuthenticationMethod.managedIdentities:
                return acquireManagedIdentityToken(
                    resource, this.method.msiEndpoint, this.method.msiClientId, this.method.msiSecret, (err, tokenResponse) => {
                        if (err) {
                            return cb(err);
                        }

                        return cb(err, tokenResponse && formatHeader(tokenResponse as TokenResponse));
                    }
                );
            case AuthenticationMethod.azLogin:
                return azLoginIdentityToken(resource, (err, tokenResponse) => {
                    if (err) {
                        return cb(err);
                    }

                    return cb(err, tokenResponse && formatHeader(tokenResponse as TokenResponse));
                });
            case AuthenticationMethod.accessToken:
                return cb(undefined, `Bearer ${this.method.accessToken}`);
            default:
                return cb("Couldn't Authenticate, something went wrong trying to choose authentication method");
        }

    }
};

export default AadHelper;