import { Button } from "@fluentui/react-components";
import { Client } from "azure-kusto-data";
import React from "react";
import { InputText } from "./InputText";

interface CreateTableProps {
    tableCreated: boolean;
    tableSchema: string;
    tableName: string;
    queryClient: Client;
    databaseName: string;
    setTableCreated: (b: boolean) => void;
}

interface CreateTableState {
    ongoing?: boolean;
    tableSchema: string;
    err?: Error;
}

export const CreateTable: React.FunctionComponent<CreateTableProps> = ({
    tableCreated,
    tableName,
    tableSchema,
    queryClient,
    databaseName,
    setTableCreated,
}) => {
    const [state, setState] = React.useState<CreateTableState>({ tableSchema });
    return tableCreated ? (
        <p>Table created successfully{String.fromCharCode(10003)}</p>
    ) : (
        <div style={{ paddingTop: 10 }}>
            <InputText
                label="Table schema"
                onChange={(_, data: string) => {
                    setState({ tableSchema: data });
                }}
                defaultValue={tableSchema || ""}
            />
            <Button
                disabled={state.ongoing || !state.tableSchema}
                onClick={() => {
                    setState({ ongoing: true, tableSchema });
                    const command = `.create table ${tableName} ${state.tableSchema}`;
                    queryClient
                        .executeMgmt(databaseName, command)
                        .then((_) => {
                            setState({ ongoing: false, tableSchema });
                            setTableCreated(true);
                        })
                        .catch((e) => {
                            setState({ ongoing: false, tableSchema, err: e });
                        });
                }}
            >
                Create table
            </Button>
        </div>
    );
};
