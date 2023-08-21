import { Link } from "@fluentui/react-components";
import React from "react";
import { InputText } from "./InputText";

interface UpperFieldsProps {
    tableCreated: boolean;
    config: ConfigJson;
    setConfig: (c: ConfigJson) => void;
    setTenant: (tenantId: string) => void;
}

export enum AuthenticationModeOptions {
    UserPrompt = "UserPrompt",
    ManagedIdentity = "ManagedIdentity",
    AppKey = "AppKey",
    AppCertificate = "AppCertificate",
}

enum SourceType {
    LocalFileSource = "localfilesource",
    BlobSource = "blobsource",
    NoSource = "nosource",
}

export interface ConfigData {
    sourceType: SourceType;
    dataSourceUri: string;
    format: string;
    useExistingMapping: boolean;
    mappingName: string;
    mappingValue: string;
}

export interface ConfigJson {
    kustoUri: string;
    ingestUri: string;
    databaseName: string;
    tableName: string;
    useExistingTable: boolean;
    alterTable: boolean;
    queryData: boolean;
    ingestData: boolean;
    tableSchema: string;
    data: ConfigData[];
    certificatePath: string;
    certificatePassword: string;
    applicationId: string;
    tenantId: string;
    authenticationMode: AuthenticationModeOptions;
    waitForUser: boolean;
    ignoreFirstRecord: boolean;
    waitForIngestSeconds: number;
    batchingPolicy: string;
}

export const UpperFields: React.FunctionComponent<UpperFieldsProps> = ({ config, setConfig, tableCreated }) => {
    const appIdMissing = !config.applicationId;
    const locationToPrint = `(${window.location.href})`;
    return (
        <>
            <InputText
                label="Target cluster uri"
                onChange={(_, data: string) => {
                    config.kustoUri = data;
                    setConfig({ ...config });
                }}
                value={config.kustoUri || ""}
            />
            <InputText
                label="Target ingest uri"
                onChange={(_, data: string) => {
                    config.ingestUri = data;
                    setConfig({ ...config });
                }}
                value={config.ingestUri || ""}
            />
            <InputText
                label="Target database"
                onChange={(_, data: string) => {
                    config.databaseName = data;
                    setConfig({ ...config });
                }}
                value={config.databaseName || ""}
            />
            <InputText
                disabled={tableCreated}
                label="Target table"
                onChange={(_, data: string) => {
                    config.tableName = data;
                    setConfig({ ...config });
                }}
                value={config.tableName || ""}
            />
            <InputText
                required={true}
                label="App id (See Note)"
                onChange={(_, data: string) => {
                    config.applicationId = data;
                    setConfig({ ...config });
                }}
                value={config.applicationId || ""}
                error={appIdMissing ? "Application Id is required" : undefined}
            />
            <p style={{ marginBottom: 0 }}>
                Note: This example uses @azure/identity InteractiveBrowserCredential. The authentication app id above should be granted admin consent to Azure
                Data Explorer and
            </p>
            <p style={{ marginBottom: 0, marginTop: 0 }}>
                allow the redirectUri of the url of this site {locationToPrint}, see steps
                <Link href="https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/identity/identity/test/manual/interactive-browser-credential">here</Link>.
            </p>
            {/* TODO - change link to our docs once done */}
            <p style={{ marginTop: 0 }}>
                Web app best practice is providing the user a login option, feeding the tokens yourself to the client via withTokenProvider builder (see JS
                comment)
            </p>
            {/* Usage for this flow is:
          const tokenProvider = () => Promise.resolve("some_token");
          const kcsbs = [KustoConnectionStringBuilder.withTokenProvider("localhost", tokenProvider)]; 
      */}
        </>
    );
};
