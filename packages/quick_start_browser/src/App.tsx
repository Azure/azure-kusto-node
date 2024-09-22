// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { Dropdown, FluentProvider, Option, Switch, Theme, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { Client, KustoConnectionStringBuilder } from "azure-kusto-data";
import { IngestClient } from "azure-kusto-ingest";
import { Buffer } from "buffer";
import React from "react";
import "./App.css";
import { CreateTable } from "./CreateTable";
import { IngestFlow } from "./IngestFlow";
import { QueryFlow } from "./QueryFlow";
import { ConfigJson, UpperFields } from "./UpperFields";
import logo from "./assets/download.png";
import myJson from "./kusto_sample_config.json" with {type: "json"};
if (!window.Buffer) {
    window.Buffer = Buffer;
}

type IngestOrQuery = "Ingest" | "Query";
const ingestQueryOptions = [{ text: "Query" }, { text: "Ingest" }];
interface State {
    ingestOrQuery: IngestOrQuery;
    tableCreated: boolean;
    theme: Theme;
    tenantId?: string;
}

function App() {
    const [config, setConfig] = React.useState<ConfigJson>(myJson as ConfigJson);
    const [state, setState] = React.useState<State>({ ingestOrQuery: "Query", tableCreated: false, theme: webDarkTheme });
    const queryClient = React.useMemo(() => {
        try {
            return config.applicationId && config.kustoUri
                ? new Client(
                      KustoConnectionStringBuilder.withUserPrompt(config.kustoUri, {
                          redirectUri: window.location.href,
                          clientId: config.applicationId,
                      })
                  )
                : null;
        } catch (error) {
            return null;
        }
    }, [config.kustoUri, config.applicationId]);

    const { ingestClient, ingestAdminClient } = React.useMemo(() => {
        try {
            if (config.applicationId && config.ingestUri) {
                const kcsb = KustoConnectionStringBuilder.withUserPrompt(config.ingestUri, {
                    redirectUri: window.location.href,
                    clientId: config.applicationId,
                });
                return { ingestClient: new IngestClient(kcsb), ingestAdminClient: new Client(kcsb) };
            }
        } catch (error) {}
        return { ingestClient: null, ingestAdminClient: null };
    }, [config.ingestUri, config.applicationId]);

    return (
        <FluentProvider theme={state.theme} style={{ padding: 20 }}>
            <Switch
                labelPosition="before"
                label="Dark Theme"
                onChange={(_, opt) => {
                    if (opt.checked) {
                        setState({ ...state, theme: webDarkTheme });
                    } else {
                        setState({ ...state, theme: webLightTheme });
                    }
                }}
                defaultChecked={true}
            />
            <div style={{ paddingTop: 20, paddingBottom: 50 }}>
                <span style={{ fontSize: 20, fontWeight: 500 }}>Azure Data Explorer Browser SDK Sample</span>
                <img src={logo} alt="Logo" className="logo center-items" />
            </div>
            <UpperFields
                config={config}
                setConfig={setConfig}
                tableCreated={state.tableCreated}
                setTenant={(tenantId: string) => setState({ ...state, tenantId })}
            ></UpperFields>
            <Switch
                disabled={state.tableCreated}
                labelPosition="before"
                label="Use existing table"
                onChange={(_, opt) => {
                    config.useExistingTable = opt.checked;
                    setConfig({ ...config });
                }}
                defaultChecked={config.useExistingTable}
            />
            {queryClient && config.useExistingTable === false && (
                <CreateTable
                    databaseName={config.databaseName}
                    queryClient={queryClient}
                    tableCreated={state.tableCreated}
                    tableName={config.tableName}
                    tableSchema={config.tableSchema}
                    setTableCreated={(tableCreated: boolean) => setState({ ...state, tableCreated })}
                ></CreateTable>
            )}
            <div style={{ display: "grid", maxWidth: 100 }}>
                <label style={{ width: "100", paddingTop: 10 }}>Flow</label>
                <Dropdown
                    style={{ width: "100", marginTop: 10, marginBottom: 10 }}
                    defaultValue={state.ingestOrQuery}
                    onOptionSelect={(_, option) => {
                        setState({ ...state, ingestOrQuery: option?.optionValue as IngestOrQuery });
                    }}
                >
                    {ingestQueryOptions.map((option) => (
                        <Option key={option.text} text={option.text}>
                            {option.text}
                        </Option>
                    ))}
                </Dropdown>
            </div>
            {state.ingestOrQuery === "Ingest" ? (
                <IngestFlow ingestClient={ingestClient} config={config} queryClient={queryClient} ingestAdminClient={ingestAdminClient}></IngestFlow>
            ) : (
                <QueryFlow
                    useExistingTable={config.useExistingTable}
                    database={config.databaseName}
                    table={config.tableName}
                    queryClient={queryClient}
                    tableCreated={state.tableCreated}
                ></QueryFlow>
            )}
        </FluentProvider>
    );
}

export default App;
