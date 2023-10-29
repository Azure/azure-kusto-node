// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { Button, Dropdown, Link, Option, Spinner, Text } from "@fluentui/react-components";
import { Client } from "azure-kusto-data";
import { DataFormat, IngestClient, dataFormatMappingKind } from "azure-kusto-ingest";

import { tokens } from "@fluentui/react-theme";
import React from "react";
import { v4 } from "uuid";
import { BrowseFiles } from "./BrowseFiles";
import { GetAlterBatchingPolicyCommand, GetCreateOrAlterTable, GetRefreshPolicyCommand } from "./CslCommandsGenerator";
import { InputText, checkMark } from "./InputText";
import { ConfigData, ConfigJson } from "./UpperFields";

interface IngestFlowProps {
    ingestClient: IngestClient | null;
    config: ConfigJson;
    queryClient: Client | null;
    ingestAdminClient: Client | null;
}

type FileBlob = "File" | "Blob";
const fileBlobOptions = [{ text: "File" }, { text: "Blob" }];

interface IngestState {
    mappingSet?: boolean;
    file?: File;
    err?: Error;
    success?: boolean;
    ongoing?: boolean;
    configData: ConfigData;
    ignoreFirstRecord: boolean;
    btachingSet?: boolean;
    hasMappingValue: boolean;
    fileBlob?: "File" | "Blob";
}

export const IngestFlow: React.FunctionComponent<IngestFlowProps> = ({ ingestClient, config, queryClient, ingestAdminClient }) => {
    const [state, setState] = React.useState<IngestState>({
        configData: config.data[0] ?? ({} as ConfigData),
        ignoreFirstRecord: config.ignoreFirstRecord,
        hasMappingValue: !!config.data[0].mappingValue,
        fileBlob: "File",
    });
    const ingestFile = async () => {
        try {
            state.ongoing = true;
            state.err = undefined;
            setState({ ...state });
            if (config.batchingPolicy && !state.btachingSet) {
                const command = GetAlterBatchingPolicyCommand(config.tableName, config.batchingPolicy);
                await queryClient!.executeMgmt(config.databaseName, command);
                state.btachingSet = true;
                setState({ ...state });
                const commandRefresh = GetRefreshPolicyCommand(config.tableName, config.databaseName);
                await ingestAdminClient!.executeMgmt(config.databaseName, commandRefresh);
            }
            const mappingValue = state.configData.mappingValue;
            if (mappingValue && !state.mappingSet && !state.configData.useExistingMapping) {
                const ingestionMappingKind = dataFormatMappingKind(state.configData.format as DataFormat);
                const mappingName = state.configData.mappingName ? state.configData.mappingName : "DefaultQuickstartMapping" + v4().substring(0, 4);
                const command = GetCreateOrAlterTable(config.tableName, ingestionMappingKind, mappingName, mappingValue);
                await queryClient?.executeMgmt(config.databaseName, command);
            }
            if (state.fileBlob === "File") {
                await ingestClient?.ingestFromFile(state.file!, {
                    table: config.tableName,
                    database: config.databaseName,
                    ignoreFirstRecord: config.ignoreFirstRecord,
                    ingestionMappingReference: state.configData.mappingValue ? undefined : state.configData.mappingName,
                    format: state.configData.format as DataFormat,
                });
            } else {
                await ingestClient?.ingestFromBlob(state.configData.dataSourceUri!, {
                    table: config.tableName,
                    database: config.databaseName,
                    ignoreFirstRecord: config.ignoreFirstRecord,
                    ingestionMappingReference: state.configData.mappingValue ? undefined : state.configData.mappingName,
                });
            }
            setState({ ...state, success: true, ongoing: false, err: undefined });
        } catch (err: any) {
            setState({ ...state, err, success: false, ongoing: false });
        }
    };

    const canIngest = !ingestClient || !queryClient || (state.fileBlob === "File" ? !state?.file : !state.configData.dataSourceUri);
    return (
        <>
            {state.success ? (
                <>
                    <p>Ingestion was queued successfully{checkMark}.</p>
                    <p>
                        Go to query flow and refresh the query until new records appear. Alternatively go{" "}
                        {
                            <Link target="_blank" href={`${config.kustoUri}/${config.databaseName}?query=${config.tableName} | top 10 by ingestion_time()`}>
                                here
                            </Link>
                        }
                    </p>
                </>
            ) : (
                <>
                    <Dropdown
                        style={{ width: "100", marginTop: 10, marginBottom: 10 }}
                        defaultValue={"File"}
                        onOptionSelect={(_, option) => {
                            setState({ ...state, fileBlob: option?.optionValue as FileBlob });
                        }}
                    >
                        {fileBlobOptions.map((option) => (
                            <Option key={option.text} text={option.text}>
                                {option.text}
                            </Option>
                        ))}
                    </Dropdown>
                    <InputText
                        label="Format"
                        onChange={(_, data: string) => {
                            state.configData.format = data;
                            setState({ ...state });
                        }}
                        defaultValue={state.configData.format || "Csv"}
                    />
                    <InputText
                        label="Mapping name"
                        onChange={(_, data: string) => {
                            state.configData.mappingName = data;
                            setState({ ...state });
                        }}
                        defaultValue={state.configData.mappingName || ""}
                    />
                    {state.hasMappingValue && !state.configData.useExistingMapping && (
                        <InputText
                            label="Mapping value"
                            onChange={(_, data: string) => {
                                state.configData.mappingValue = data;
                                setState(state);
                            }}
                            defaultValue={state.configData.mappingValue || ""}
                        />
                    )}
                    {state.fileBlob === "File" ? (
                        <BrowseFiles
                            setFile={(file: File) => {
                                setState((prev) => ({ ...prev, file }));
                            }}
                            fileName={state?.file?.name}
                        />
                    ) : (
                        <InputText
                            label="Blob url"
                            onChange={(_, data: string) => {
                                state.configData.dataSourceUri = data;
                                setState({ ...state });
                            }}
                            defaultValue={state.configData.dataSourceUri || ""}
                        />
                    )}
                    {state.ongoing ? (
                        <>
                            <Spinner />
                            <p>Running query...</p>
                        </>
                    ) : (
                        <div>
                            <Button style={{ marginTop: 20 }} appearance="primary" disabled={canIngest} onClick={ingestFile}>
                                Ingest file
                            </Button>
                        </div>
                    )}
                    {state?.err && (
                        <Text style={{ color: tokens.colorPaletteRedForeground1 }}>
                            {`Error ${(state.err as any).response?.data?.error?.code ?? ""}: ${
                                (state.err as any).response?.data?.error["@message"] ?? state.err.message
                            }`}
                        </Text>
                    )}
                </>
            )}
        </>
    );
};
