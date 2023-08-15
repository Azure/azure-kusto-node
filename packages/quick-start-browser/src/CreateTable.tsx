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
    const [schema, setSchema] = React.useState<CreateTableState>({ tableSchema });
    const onTableCreateClick = () => {
        setSchema({ ongoing: true, tableSchema });
        const command = `.create table ${tableName} ${schema.tableSchema}`;
        queryClient
            .executeMgmt(databaseName, command)
            .then((_) => {
                setSchema({ ongoing: false, tableSchema });
                setTableCreated(true);
            })
            .catch((e) => {
                setSchema({ ongoing: false, tableSchema, err: e });
            });
    };
    return tableCreated ? (
        <p>Table created successfully{String.fromCharCode(10003)}</p>
    ) : (
        <div style={{ paddingTop: 10 }}>
            <InputText
                label="Table schema"
                onChange={(_, data: string) => {
                    setSchema({ tableSchema: data });
                }}
                defaultValue={tableSchema || ""}
            />
            <Button disabled={schema.ongoing || !schema.tableSchema} onClick={onTableCreateClick}>
                Create table
            </Button>
        </div>
    );
};
