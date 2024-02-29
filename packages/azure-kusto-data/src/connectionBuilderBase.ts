// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DeviceCodeInfo, InteractiveBrowserCredentialInBrowserOptions, InteractiveBrowserCredentialNodeOptions, TokenCredential } from "@azure/identity";
import { KeyOfType } from "./typeUtilts";
import { ClientDetails } from "./clientDetails";

interface MappingType {
    mappedTo: string;
    validNames: string[];
    isSecret?: boolean;
    isBool?: boolean;
}

type KcsbMappedKeys = KeyOfType<KustoConnectionStringBuilderBase, string | boolean | undefined>;

// This type gurantess that we don't have properties in KeywordMapping that don't exist in KustoConnectionStringBuilder
type KeywordMappingRecordType = Partial<Record<KcsbMappedKeys, MappingType>>;

export const KeywordMapping: KeywordMappingRecordType = Object.freeze<Readonly<KeywordMappingRecordType>>({
    dataSource: {
        mappedTo: "Data Source",
        validNames: ["data source", "addr", "address", "network address", "server"],
    },
    aadFederatedSecurity: {
        mappedTo: "AAD Federated Security",
        validNames: ["aad federated security", "federated security", "federated", "fed", "aadfed"],
        isBool: true,
    },
    initialCatalog: {
        mappedTo: "Initial Catalog",
        validNames: ["initial catalog", "database"],
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
    applicationKey: {
        mappedTo: "Application Key",
        validNames: ["application key", "appkey"],
        isSecret: true,
    },
    applicationCertificatePrivateKey: {
        mappedTo: "Application Certificate PrivateKey",
        validNames: ["Application Certificate PrivateKey"],
        isSecret: true,
    },
    applicationCertificateSendX5c: {
        mappedTo: "Application Certificate x5c",
        validNames: ["application certificate x5c", "Application Certificate Send Public Certificate", "Application Certificate SendX5c", "SendX5c"],
        isBool: true,
    },
    authorityId: {
        mappedTo: "Authority Id",
        validNames: ["authority id", "authorityid", "authority", "tenantid", "tenant", "tid"],
    },
});

const getPropName = (key: string): [string, MappingType] => {
    const _key = key.trim().toLowerCase();

    for (const keyword of Object.keys(KeywordMapping)) {
        const k = KeywordMapping[keyword as KcsbMappedKeys];
        if (!k) {
            continue;
        }
        if (k.validNames.map((n) => n.trim().toLowerCase()).indexOf(_key) >= 0) {
            return [keyword, k];
        }
    }
    throw new Error("Failed to get prop: " + key);
};

export abstract class KustoConnectionStringBuilderBase {
    static readonly DefaultDatabaseName = "NetDefaultDB";
    static readonly SecretReplacement = "****";

    dataSource?: string;
    aadFederatedSecurity?: boolean;
    initialCatalog?: string;
    aadUserId?: string;
    password?: string;
    applicationClientId?: string;
    msiClientId?: string;
    applicationKey?: string;
    applicationCertificatePrivateKey?: string;
    applicationCertificateSendX5c?: boolean;
    authorityId: string = "organizations";
    deviceCodeCallback?: (response: DeviceCodeInfo) => void;
    tokenProvider?: () => Promise<string>;
    timeoutMs?: number;
    accessToken?: string;
    useDeviceCodeAuth?: boolean;
    useUserPromptAuth?: boolean;
    useAzLoginAuth?: boolean;
    useManagedIdentityAuth?: boolean;
    interactiveCredentialOptions?: InteractiveBrowserCredentialNodeOptions | InteractiveBrowserCredentialInBrowserOptions;
    tokenCredential?: TokenCredential;

    // discarded from to mapped names for security
    applicationCertificatePath?: string;
    public applicationNameForTracing: string | null = null;
    public userNameForTracing: string | null = null;

    constructor(connectionString: string) {
        if (connectionString.trim().length === 0) throw new Error("Missing connection string");

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
                this[mappingTypeName as KeyOfType<KustoConnectionStringBuilderBase, boolean | undefined>] = kvp[1].trim().toLowerCase() === "true";
            } else {
                this[mappingTypeName as KeyOfType<KustoConnectionStringBuilderBase, string | undefined>] = kvp[1]?.trim();
            }
        }

        if (!this.initialCatalog) {
            this.initialCatalog = KustoConnectionStringBuilderBase.DefaultDatabaseName;
        }
    }

    public clientDetails(): ClientDetails {
        return new ClientDetails(this.applicationNameForTracing, this.userNameForTracing);
    }

    /**
     * Sets the connector details for tracing purposes.
     *
     * @param name  The name of the connector
     * @param version  The version of the connector
     * @param appName? The name of the containing application
     * @param appVersion?? The version of the containing application
     * @param sendUser Whether to send the username
     * @param overrideUser?? Override the username ( if sendUser is True )
     * @param additionalFields? Additional fields to add to the header
     */
    public setConnectorDetails(
        name: string,
        version: string,
        appName?: string,
        appVersion?: string,
        sendUser: boolean = false,
        overrideUser?: string,
        additionalFields?: [string, string][]
    ): void {
        const clientDetails = ClientDetails.setConnectorDetails(name, version, appName, appVersion, sendUser, overrideUser, additionalFields);

        this.applicationNameForTracing = clientDetails.applicationNameForTracing;
        this.userNameForTracing = clientDetails.userNameForTracing;
    }

    toString(removeSecrets: boolean = true): string {
        return Object.entries(KeywordMapping)
            .map(([key, mappingType]) => {
                const value = this[key as KcsbMappedKeys];
                if (!mappingType || value === undefined) {
                    return "";
                }
                if (mappingType.isSecret && removeSecrets) {
                    return `${mappingType.mappedTo}=${KustoConnectionStringBuilderBase.SecretReplacement}`;
                }

                return `${mappingType.mappedTo}=${value.toString()}`;
            })
            .filter((x) => x !== "")
            .join(";");
    }

    static fromExisting(other: KustoConnectionStringBuilderBase): KustoConnectionStringBuilderBase {
        return Object.assign({}, other);
    }
}
