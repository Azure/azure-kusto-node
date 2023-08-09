import React from "react";

import {
    DataGrid,
    DataGridBody,
    DataGridCell,
    DataGridHeader,
    DataGridHeaderCell,
    DataGridRow,
    TableCellLayout,
    TableColumnDefinition,
    createTableColumn
} from "@fluentui/react-components";
import { KustoResultTable } from "azure-kusto-data/types/src/models";

type Row = any[];

const compare = (a:Row, b: Row, i:number): number => {
    return a[i] ? a[i].localeCompare(b[i]) : 0;
}

const createColumn = (columnId: string, index:number ) => {
    return createTableColumn<Row>({
        columnId,
        compare: (a, b) => compare(a,b,index),
        renderHeaderCell: () => {
            return columnId;
        },
        renderCell: (item) => {
            return (
                <TableCellLayout style={{minWidth:"100px"}}>
                {item[index]}
                </TableCellLayout>
            );
        },
    }) 
}

interface GridProps{
    items:Row[];
    columns:TableColumnDefinition<Row>[]
}

const Grid: React.FunctionComponent<GridProps> = ({items , columns}) => {
    let x = 0;
    return (
        <DataGrid
            items={items}
            columns={columns}
            sortable
            getRowId={(item:any) => (`${item}${x++}`)}
            focusMode="composite"
        >
            <DataGridHeader>
                <DataGridRow>
                {({ renderHeaderCell }) => (
                    <DataGridHeaderCell style={{minWidth:70}}>{renderHeaderCell()}</DataGridHeaderCell>
                )}
                </DataGridRow>
            </DataGridHeader>
            <DataGridBody<Row>>
                {({ item, rowId }) => (
                    <DataGridRow<Row>
                        key={rowId}
                    >
                        {({ renderCell }) => (
                        <DataGridCell>{renderCell(item)}</DataGridCell>
                        )}
                    </DataGridRow>
                )}
            </DataGridBody>
        </DataGrid>
    );
};

interface ResultTableProps{
    resultTable: KustoResultTable
}

export const ResultTable: React.FunctionComponent<ResultTableProps> = ({resultTable}) => {
    const columns: { columnKey: string, label: string }[] = resultTable.columns.map(c=>({ columnKey: c.name!, label:c.name! }))
    const items: Row[] =  resultTable._rows
    return (
        <Grid items={items} columns={columns.map((c,i)=>createColumn(c.columnKey,i))}/>
    )
}
