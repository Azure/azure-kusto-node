// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DeviceCodeResponse } from "@azure/msal-common";
import { KeyOfType } from "./typeUtilts";

interface MappingType {
    mappedTo: string,
    validNames: string[]
}

// This type gurantess that we don't have properties in KeywordMapping that don't exist in KustoConnectionStringBuilder
type KeywordMappingRecordType = Partial<Record<keyof KustoConnectionStringBuilder, MappingType>>;

const KeywordMapping: KeywordMappingRecordType = Object.freeze<Readonly<KeywordMappingRecordType>>({
    dataSource: {
        mappedTo: "Data Source",
        validNames: ["data source", "addr", "address", "network address", "server"]
    },
    aadUserId: {
        mappedTo: "AAD User ID",
        validNames: ["aad user id"]
    },
    password: {
        mappedTo: "Password",
        validNames: ["password", "pwd"]
    },
    applicationClientId: {
        mappedTo: "Application Client Id",
        validNames: ["application client id", "appclientid"]
    },
    msiClientId: {
        mappedTo: "Msi Client Id",
        validNames: ["msi client id", "msiclientid"]
    },
    applicationKey: {
        mappedTo: "Application Key",
        validNames: ["application key", "appkey"]
    },
    applicationCertificatePrivateKey: {
        mappedTo: "application Certificate PrivateKey",
        validNames: ["application Certificate PrivateKey"]
    },
    applicationCertificateThumbprint: {
        mappedTo: "Application Certificate Thumbprint",
        validNames: ["application certificate thumbprint"]
    },
    applicationCertificateX5c: {
        mappedTo: "Application Certificate x5c",
        validNames: ["application certificate x5c"]
    },
    authorityId: {
        mappedTo: "Authority Id",
        validNames: ["authority id", "authorityid", "authority", "tenantid", "tenant", "tid"]
    },
    loginHint: {
        mappedTo: "Login Hint",
        validNames: ["login hint"]
    }
});

const getPropName = (key: string): string => {
    const _key = key.trim().toLowerCase();

    for (const keyword of Object.keys(KeywordMapping)) {
        const k = KeywordMapping[keyword as keyof KustoConnectionStringBuilder];
        if (!k) {
            continue;
        }
        if (k.validNames.indexOf(_key) >= 0) {
            return keyword;
        }
    }
    throw new Error(key);
};


export class KustoConnectionStringBuilder {
    dataSource?: string;
    aadUserId?: string;
    password?: string;
    applicationClientId?: string;
    msiClientId?: string;
    applicationKey?: string;
    applicationCertificatePrivateKey?: string;
    applicationCertificateThumbprint?: string;
    applicationCertificateX5c?: string;
    authorityId: string = "common";
    deviceCodeCallback?: (response: DeviceCodeResponse) => void;
    loginHint?: string;
    timeoutMs?: number;
    deviceCallback?: boolean;
    interactiveLogin?: boolean;
    accessToken?: string;
    azLoginIdentity?: boolean;
    managedIdentity?: boolean;

    constructor(connectionString: string) {
        if (!connectionString || connectionString.trim().length === 0) throw new Error("Missing connection string");

        if (connectionString.endsWith("/") || connectionString.endsWith("\\")) {
            connectionString = connectionString.slice(0, -1);
        }

        if (!!connectionString && connectionString.split(";")[0].indexOf("=") === -1) {
            connectionString = "Data Source=" + connectionString;
        }

        const params = connectionString.split(";");
        for (const item of params) {
            const kvp = item.split("=");
            const propName = getPropName(kvp[0]) as KeyOfType<KustoConnectionStringBuilder, string>;
            this[propName] = kvp[1].trim();
        }
    }

    static fromExisting(other: KustoConnectionStringBuilder): KustoConnectionStringBuilder {
        return Object.assign({}, other);
    }

    static withAadUserPasswordAuthentication(connectionString: string, userId: string, password: string, authorityId?: string) {
        if (!userId || userId.trim().length === 0) throw new Error("Invalid user");
        if (!password || password.trim().length === 0) throw new Error("Invalid password");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadUserId = userId;
        kcsb.password = password;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }

        return kcsb;
    }

    static withAadApplicationKeyAuthentication(connectionString: string, aadAppId: string, appKey: string, authorityId?: string) {
        if (!aadAppId || aadAppId.trim().length === 0) throw new Error("Invalid app id");
        if (!appKey || appKey.trim().length === 0) throw new Error("Invalid app key");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.applicationClientId = aadAppId;
        kcsb.applicationKey = appKey;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }


        return kcsb;
    }

    static withAadApplicationCertificateAuthentication(connectionString: string, aadAppId: string, applicationCertificatePrivateKey: string, applicationCertificateThumbprint: string,  authorityId?: string, applicationCertificateX5c?: string) {
        if (!aadAppId || aadAppId.trim().length === 0) throw new Error("Invalid app id");
        if (!applicationCertificatePrivateKey || applicationCertificatePrivateKey.trim().length === 0) throw new Error("Invalid certificate");
        if (!applicationCertificateThumbprint || applicationCertificateThumbprint.trim().length === 0) throw new Error("Invalid thumbprint");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.applicationClientId = aadAppId;
        kcsb.applicationCertificatePrivateKey = applicationCertificatePrivateKey;
        kcsb.applicationCertificateThumbprint = applicationCertificateThumbprint;
        kcsb.applicationCertificateX5c = applicationCertificateX5c;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }

        return kcsb;
    }


    static withAadDeviceAuthentication(connectionString: string, authorityId: string = "common", deviceCodeCallback?: (response: DeviceCodeResponse) => void) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.authorityId = authorityId;
        kcsb.deviceCodeCallback = deviceCodeCallback;
        kcsb.deviceCallback = true

        return kcsb;
    }

    static withAadManagedIdentities(connectionString: string, authorityId?: string, msiClientId?: string, timeoutMs?: number) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }
        kcsb.msiClientId = msiClientId;
        kcsb.timeoutMs = timeoutMs;
        kcsb.managedIdentity = true;

        return kcsb;
    }

    static withAzLoginIdentity(connectionString: string,authorityId?: string, clientId?: string, timeoutMs?: number, ) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);

        kcsb.azLoginIdentity = true;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }
        kcsb.applicationClientId = clientId;
        kcsb.timeoutMs = timeoutMs;


        return kcsb;
    }

    static withAccessToken(connectionString: string, accessToken?: string) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);

        kcsb.accessToken = accessToken;

        return kcsb;
    }

    static withInteractiveLogin(connectionString: string, authorityId?: string, clientId?: string, timeoutMs?: number, loginHint?: string) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);

        kcsb.interactiveLogin = true;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }
        kcsb.loginHint = loginHint;
        kcsb.applicationClientId = clientId;
        kcsb.timeoutMs = timeoutMs;

        return kcsb;
    }
}

export default KustoConnectionStringBuilder;