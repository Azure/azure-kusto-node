
const { AuthenticationContext } = require("adal-node");
const acquireManagedIdentityToken = require("./managedIdentitiesClient");

const AuthenticationMethod = Object.freeze({
    username: 0,
    appKey: 1,
    appCertificate: 2,
    deviceLogin: 3,
    managedIdentities: 4
});


module.exports = class AadHelper {
    constructor(kcsb) {
        this.token = {};

        const authority = kcsb.authorityId || "common";
        let url;

        // support node compatibility
        try {
            url = new URL(kcsb.dataSource);
        } catch (e) {
            const URL = require("url").URL;
            url = new URL(kcsb.dataSource);
        }

        const authContext = this._fetchAndValidateAadAuthorityUri() + authority;

        this.kustoCluster = `${url.protocol}//${url.hostname}`;
        this.adalContext = new AuthenticationContext(authContext);
        if (!!kcsb.aadUserId && !!kcsb.password) {
            this.authMethod = AuthenticationMethod.username;
            this.clientId = "db662dc1-0cfe-4e1c-a843-19a68e65be58";
            this.username = kcsb.aadUserId;
            this.password = kcsb.password;
        } else if (!!kcsb.applicationClientId && !!kcsb.applicationKey) {
            this.authMethod = AuthenticationMethod.appKey;
            this.clientId = kcsb.applicationClientId;
            this.clientSecret = kcsb.applicationKey;
        } else if (!!kcsb.applicationClientId &&
            !!kcsb.applicationCertificate && !!kcsb.applicationCertificateThumbprint) {
            this.authMethod = AuthenticationMethod.appCertificate;
            this.clientId = kcsb.applicationClientId;
            this.certificate = kcsb.applicationCertificate;
            this.thumbprint = kcsb.applicationCertificateThumbprint;
        } else if (kcsb.managedIdentity) {
            this.authMethod = AuthenticationMethod.managedIdentities;
            this.msiEndpoint = kcsb.msiEndpoint;
            this.msiSecret = kcsb.msiSecret;
            this.msiClientId = kcsb.msiClientId;
        } else {
            this.authMethod = AuthenticationMethod.deviceLogin;
            this.clientId = "db662dc1-0cfe-4e1c-a843-19a68e65be58";
            this.authCallback = kcsb.AuthorizationCallback;
        }
    }

    _fetchAndValidateAadAuthorityUri() {
        var aadAuthorityUri = process.env.AadAuthorityUri;

        if (!aadAuthorityUri) {
            return "https://login.microsoftonline.com/";
        }

        let uri;
        try {
            uri = new URL(aadAuthorityUri);
        } catch (e) {
            throw(`Invalid Environment Variable. Please set a valid AadAuthority https uri. aad_authority_uri: ${aadAuthorityUri}`);
        }

        if (uri.protocol != "https:" || !uri.host || (uri.pathname && uri.pathname != "/")) {
            throw(`Invalid Environment Variable. Please set a valid AadAuthority https uri. aad_authority_uri: ${aadAuthorityUri}`);
        }

        return aadAuthorityUri.endsWith("/") ?
            aadAuthorityUri
            : aadAuthorityUri + "/";
    }

    getAuthHeader(cb) {
        let resource = this.kustoCluster;
        let formatHeader = ({ tokenType, accessToken }) => `${tokenType} ${accessToken}`;

        switch (this.authMethod) {
            case AuthenticationMethod.username:
                return this.adalContext.acquireTokenWithUsernamePassword(
                    resource, this.username, this.password, this.clientId, (err, tokenResponse) => {
                        return cb(err, tokenResponse && formatHeader(tokenResponse));
                    }
                );
            case AuthenticationMethod.appKey:
                return this.adalContext.acquireTokenWithClientCredentials(
                    resource, this.clientId, this.clientSecret, (err, tokenResponse) => {
                        return cb(err, tokenResponse && formatHeader(tokenResponse));
                    }
                );
            case AuthenticationMethod.appCertificate:
                return this.adalContext.acquireTokenWithClientCertificate(
                    resource, this.clientId, this.certificate, this.thumbprint, (err, tokenResponse) => {
                        return cb(err, tokenResponse && formatHeader(tokenResponse));
                    }
                );
            case AuthenticationMethod.deviceLogin:
                return this.adalContext.acquireUserCode(resource, this.clientId, null, (err, tokenResponse) => {
                    if (err) {
                        return cb(err);
                    } else {
                        if (this.authCallback) {
                            this.authCallback(tokenResponse);
                        } else {
                            console.log(tokenResponse.message);
                        }

                        return this.adalContext.acquireTokenWithDeviceCode(resource, this.clientId, tokenResponse, (err, tokenResponse) => {
                            if (err) {
                                return cb(err);
                            }

                            return cb(err, tokenResponse && formatHeader(tokenResponse));
                        });

                    }
                });
            case AuthenticationMethod.managedIdentities:
                return acquireManagedIdentityToken(
                    resource, this.msiEndpoint, this.msiClientId, this.msiSecret, (err, tokenResponse) => {
                        if (err) {
                            return cb(err);
                        }

                        return cb(err, tokenResponse && formatHeader(tokenResponse));
                    }
                );
            default:
                return cb("Couldn't Authenticate, something went wrong trying to choose authentication method");
        }

    }
};
