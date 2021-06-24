// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DeviceCodeResponse } from "@azure/msal-common";

interface MappingType {
    propName: string,
    mappedTo: string,
    validNames: string[]
}

const KeywordMapping: { [name: string]: MappingType } = Object.freeze({
    dataSource: {
        propName: "dataSource",
        mappedTo: "Data Source",
        validNames: ["data source", "addr", "address", "network address", "server"]
    },
    aadUserId: {
        propName: "aadUserId",
        mappedTo: "AAD User ID",
        validNames: ["aad user id"]
    },
    password: {
        propName: "password",
        mappedTo: "Password",
        validNames: ["password", "pwd"]
    },
    applicationClientId: {
        propName: "applicationClientId",
        mappedTo: "Application Client Id",
        validNames: ["application client id", "appclientid"]
    },
    applicationKey: {
        propName: "applicationKey",
        mappedTo: "Application Key",
        validNames: ["application key", "appkey"]
    },
    applicationCertificate: {
        propName: "applicationCertificate",
        mappedTo: "Application Certificate",
        validNames: ["application certificate"]
    },
    applicationCertificateThumbprint: {
        propName: "applicationCertificateThumbprint",
        mappedTo: "Application Certificate Thumbprint",
        validNames: ["application certificate thumbprint"]
    },
    authorityId: {
        propName: "authorityId",
        mappedTo: "Authority Id",
        validNames: ["authority id", "authorityid", "authority", "tenantid", "tenant", "tid"]
    }
});

const getPropName = (key: string): string => {
    const _key = key.trim().toLowerCase();

    for (const keyword of Object.keys(KeywordMapping)) {
        const k = KeywordMapping[keyword];
        if (k.validNames.indexOf(_key) >= 0) {
            return k.propName;
        }
    }
    throw new Error(key);
};

export class KustoConnectionStringBuilder {
    [prop: string]: string | boolean | ((info: DeviceCodeResponse) => void) |  undefined;
    dataSource?: string;
    aadUserId?: string;
    password?: string;
    applicationClientId?: string;
    applicationKey?: string;
    applicationCertificate?: string;
    applicationCertificateThumbprint?: string;
    authorityId?: string;
    deviceCodeCallback?: (response: DeviceCodeResponse) => void;

    constructor(connectionString: string) {
        if (!connectionString || connectionString.trim().length === 0) throw new Error("Missing connection string");

        if (connectionString.endsWith("/") || connectionString.endsWith("\\")) {
            connectionString = connectionString.slice(0, -1);
        }

        if (!!connectionString && connectionString.split(";")[0].indexOf("=") === -1) {
            connectionString = "Data Source=" + connectionString;
        }

        this[KeywordMapping.authorityId.propName] = "common";

        const params = connectionString.split(";");
        for (const item of params) {
            const kvp = item.split("=");
            this[getPropName(kvp[0])] = kvp[1].trim();
        }
    }

    static withAadUserPasswordAuthentication(connectionString: string, userId: string, password: string, authorityId?: string) {
        if (!userId || userId.trim().length == 0) throw new Error("Invalid user");
        if (!password || password.trim().length == 0) throw new Error("Invalid password");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb[KeywordMapping.aadUserId.propName] = userId;
        kcsb[KeywordMapping.password.propName] = password;
        kcsb[KeywordMapping.authorityId.propName] = authorityId || "common";

        return kcsb;
    }

    static withAadApplicationKeyAuthentication(connectionString: string, aadAppId: string, appKey: string, authorityId?: string) {
        if (!aadAppId || aadAppId.trim().length == 0) throw new Error("Invalid app id");
        if (!appKey || appKey.trim().length == 0) throw new Error("Invalid app key");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb[KeywordMapping.applicationClientId.propName] = aadAppId;
        kcsb[KeywordMapping.applicationKey.propName] = appKey;
        kcsb[KeywordMapping.authorityId.propName] = authorityId || "common";

        return kcsb;
    }

    static withAadApplicationCertificateAuthentication(connectionString: string, aadAppId: string, certificate: string, thumbprint: string, authorityId: string) {
        if (!aadAppId || aadAppId.trim().length == 0) throw new Error("Invalid app id");
        if (!certificate || certificate.trim().length == 0) throw new Error("Invalid certificate");
        if (!thumbprint || thumbprint.trim().length == 0) throw new Error("Invalid thumbprint");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb[KeywordMapping.applicationClientId.propName] = aadAppId;
        kcsb[KeywordMapping.applicationCertificate.propName] = certificate;
        kcsb[KeywordMapping.applicationCertificateThumbprint.propName] = thumbprint;
        kcsb[KeywordMapping.authorityId.propName] = authorityId || "common";

        return kcsb;
    }


    static withAadDeviceAuthentication(connectionString: string, authorityId: string, deviceCodeCallback?: (response: DeviceCodeResponse) => void) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb[KeywordMapping.authorityId.propName] = authorityId;
        kcsb.deviceCodeCallback = deviceCodeCallback;

        return kcsb;
    }

    // Notice: you can leave `msiEndpoint` and `clientId`
    static withAadManagedIdentities(connectionString: string, msiEndpoint?: string, clientId?: string) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.msiEndpoint = msiEndpoint;

        if (msiEndpoint == undefined) {
            if (process && process.env && process.env.MSI_ENDPOINT) {
                kcsb.msiEndpoint = process.env.MSI_ENDPOINT;
                kcsb.msiSecret = process.env.MSI_SECRET;
            } else {
                kcsb.msiEndpoint = "http://169.254.169.254/metadata/identity/oauth2/token";
            }
        }

        kcsb.msiClientId = clientId;
        kcsb.managedIdentity = true;

        return kcsb;
    }

    static withAzLoginIdentity(connectionString: string) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);

        kcsb.azLoginIdentity = true;

        return kcsb;
    }

    static withAccessToken(connectionString: string, accessToken?: string) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);

        kcsb.accessToken = accessToken;

        return kcsb;
    }
}

export default KustoConnectionStringBuilder;