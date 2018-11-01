const KeywordMapping = Object.freeze({
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
    },
});

const getPropName = (key) => {
    let _key = key.trim().toLowerCase();

    for (let keyword of Object.keys(KeywordMapping)) {
        let k = KeywordMapping[keyword];
        if (k.validNames.indexOf(_key) >= 0) {
            return k.propName;
        }
    }
    throw new Error(key);
};

module.exports = class KustoConnectionStringBuilder {
    constructor(connectionString) {
        if (!connectionString || connectionString.trim().length === 0) throw new Error("Missing connection string");

        if (!!connectionString && connectionString.split(";")[0].indexOf("=") === -1) {
            connectionString = "Data Source=" + connectionString;
        }

        this[KeywordMapping.authorityId.propName] = "common";

        let params = connectionString.split(";");
        for (let i = 0; i < params.length; i++) {
            let kvp = params[i].split("=");
            this[getPropName(kvp[0])] = kvp[1].trim();
        }
    }

    static withAadUserPasswordAuthentication(connectionString, userId, password, authorityId) {
        if (!userId || userId.trim().length == 0) throw new Error("Invalid user");
        if (!password || password.trim().length == 0) throw new Error("Invalid password");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb[KeywordMapping.aadUserId.propName] = userId;
        kcsb[KeywordMapping.password.propName] = password;
        kcsb[KeywordMapping.authorityId.propName] = authorityId || "common";

        return kcsb;
    }

    static withAadApplicationKeyAuthentication(connectionString, aadAppId, appKey, authorityId) {
        if (!aadAppId || aadAppId.trim().length == 0) throw new Error("Invalid app id");
        if (!appKey || appKey.trim().length == 0) throw new Error("Invalid app key");

        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb[KeywordMapping.applicationClientId.propName] = aadAppId;
        kcsb[KeywordMapping.applicationKey.propName] = appKey;
        kcsb[KeywordMapping.authorityId.propName] = authorityId || "common";

        return kcsb;
    }

    static withAadApplicationCertificateAuthentication(connectionString, aadAppId, certificate, thumbprint, authorityId) {
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


    static withAadDeviceAuthentication(connectionString, authCallback) {
        const kcsb = new KustoConnectionStringBuilder(connectionString);
        kcsb.AuthorizationCallback = authCallback;

        return kcsb;
    }
};