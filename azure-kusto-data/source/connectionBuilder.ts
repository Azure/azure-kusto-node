// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DeviceCodeResponse } from "@azure/msal-common";
import { KeyOfType } from "./typeUtilts";

interface MappingType {
    mappedTo: string,
    validNames: string[],
    isSecret?: boolean,
    isBool?: boolean,
}

type KcsbMappedKeys = KeyOfType<KustoConnectionStringBuilder, string | boolean | undefined>;

// This type gurantess that we don't have properties in KeywordMapping that don't exist in KustoConnectionStringBuilder
type KeywordMappingRecordType = Partial<Record<KcsbMappedKeys, MappingType>>;

const KeywordMapping: KeywordMappingRecordType = Object.freeze<Readonly<KeywordMappingRecordType>>({
    dataSource: {
        mappedTo: "Data Source",
        validNames: ["data source", "addr", "address", "network address", "server"],
    },
    aadFederatedSecurity: {
        mappedTo: "AAD Federated Security",
        validNames: ["aad federated security", "federated security", "federated", "fed", "aadfed"],
        isBool: true,
    },
    aadUserId: {
        mappedTo: "AAD User ID",
        validNames: ["aad user id"],
    },
    password: {
        mappedTo: "Password",
        validNames: ["password", "pwd"],
        isSecret: true,
    },
    applicationClientId: {
        mappedTo: "Application Client Id",
        validNames: ["application client id", "appclientid"],
    },
    msiClientId: {
        mappedTo: "Msi Client Id",
        validNames: ["msi client id", "msiclientid"],
    },
    applicationKey: {
        mappedTo: "Application Key",
        validNames: ["application key", "appkey"],
        isSecret: true,
    },
    applicationCertificatePrivateKey: {
        mappedTo: "application Certificate PrivateKey",
        validNames: ["application Certificate PrivateKey"],
        isSecret: true,
    },
    applicationCertificateThumbprint: {
        mappedTo: "Application Certificate Thumbprint",
        validNames: ["application certificate thumbprint"],
    },
    applicationCertificateX5c: {
        mappedTo: "Application Certificate x5c",
        validNames: ["application certificate x5c"],
    },
    authorityId: {
        mappedTo: "Authority Id",
        validNames: ["authority id", "authorityid", "authority", "tenantid", "tenant", "tid"],
    },
    loginHint: {
        mappedTo: "Login Hint",
        validNames: ["login hint"],
    },
});

const getPropName = (key: string): [string, MappingType] => {
    const _key = key.trim().toLowerCase();

    for (const keyword of Object.keys(KeywordMapping)) {
        const k = KeywordMapping[keyword as KcsbMappedKeys];
        if (!k) {
            continue;
        }
        if (k.validNames.indexOf(_key) >= 0) {
            return [keyword, k];
        }
    }
    throw new Error(key);
};


export class KustoConnectionStringBuilder {
    static readonly SecretReplacement = "****";

    dataSource?: string;
    aadFederatedSecurity?: boolean;
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
    accessToken?: string;
    isDeviceCode?: boolean;
    isInteractiveLogin?: boolean;
    isAzLoginIdentity?: boolean;
    isManagedIdentity?: boolean;

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
            const [mappingTypeName, mappingType] = getPropName(kvp[0]);
            if (mappingType.isBool) {
                this[mappingTypeName as KeyOfType<KustoConnectionStringBuilder, boolean | undefined>] = kvp[1].trim().toLowerCase() === "true";
            } else {
                this[mappingTypeName as KeyOfType<KustoConnectionStringBuilder, string | undefined>] = kvp[1]?.trim();
            }
        }
    }


    toString(removeSecrets: boolean = true): string {
        return Object.entries(KeywordMapping).map(([key, mappingType]) => {
            const value = this[key as KcsbMappedKeys];
            if (!mappingType || value === undefined) {
                return "";
            }
            if (mappingType.isSecret && removeSecrets) {
                return `${mappingType.mappedTo}=${KustoConnectionStringBuilder.SecretReplacement}`;
            }

            return `${mappingType.mappedTo}=${value.toString()}`;
        }).filter(x => x !== "").join(";");
    }


    static fromExisting(other: KustoConnectionStringBuilder): KustoConnectionStringBuilder {
        return Object.assign({}, other);
    }

    static withAadUserPasswordAuthentication(connectionString: string, userId: string, password: string, authorityId?: string) {
        if (!userId || userId.trim().length === 0) throw new Error("Invalid user");
        if (!password || password.trim().length === 0) throw new Error("Invalid password");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;
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
        kcsb.aadFederatedSecurity = true;
        kcsb.applicationClientId = aadAppId;
        kcsb.applicationKey = appKey;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }


        return kcsb;
    }

    static withAadApplicationCertificateAuthentication(connectionString: string, aadAppId: string, applicationCertificatePrivateKey: string, applicationCertificateThumbprint: string, authorityId?: string, applicationCertificateX5c?: string) {
        if (!aadAppId || aadAppId.trim().length === 0) throw new Error("Invalid app id");
        if (!applicationCertificatePrivateKey || applicationCertificatePrivateKey.trim().length === 0) throw new Error("Invalid certificate");
        if (!applicationCertificateThumbprint || applicationCertificateThumbprint.trim().length === 0) throw new Error("Invalid thumbprint");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;
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
        kcsb.aadFederatedSecurity = true;
        kcsb.authorityId = authorityId;
        kcsb.deviceCodeCallback = deviceCodeCallback;
        kcsb.isDeviceCode = true

        return kcsb;
    }

    static withAadManagedIdentities(connectionString: string, authorityId?: string, msiClientId?: string, timeoutMs?: number) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }
        kcsb.msiClientId = msiClientId;
        kcsb.timeoutMs = timeoutMs;
        kcsb.isManagedIdentity = true;

        return kcsb;
    }

    static withAzLoginIdentity(connectionString: string, authorityId?: string, clientId?: string, timeoutMs?: number,) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;

        kcsb.isAzLoginIdentity = true;
        if (authorityId) {
            kcsb.authorityId = authorityId;
        }
        kcsb.applicationClientId = clientId;
        kcsb.timeoutMs = timeoutMs;


        return kcsb;
    }

    static withAccessToken(connectionString: string, accessToken?: string) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;

        kcsb.accessToken = accessToken;

        return kcsb;
    }

    static withInteractiveLogin(connectionString: string, authorityId?: string, clientId?: string, timeoutMs?: number, loginHint?: string) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.aadFederatedSecurity = true;

        kcsb.isInteractiveLogin = true;
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