// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// We want all the Kusto table models in this file
/* tslint:disable:max-classes-per-file */

import moment from "moment";

export enum WellKnownDataSet {
    PrimaryResult = "PrimaryResult",
    QueryCompletionInformation = "QueryCompletionInformation",
    TableOfContents = "TableOfContents",
    QueryProperties = "QueryProperties"
}

const ValueParser: { [fromString: string]: (typeof moment | typeof moment.duration) } = {
    datetime: moment,
    timespan: moment.duration,
    DateTime: moment,
    TimeSpan: moment.duration,
}

export interface Table {
    TableKind?: string;
    TableName: string;
    TableId?: number;
    Columns: Column[];
    Rows: any[][];
}

interface Column {
    ColumnName: string,
    ColumnType?: string,
    DateType?: string
}


export class KustoResultRow {
    columns: KustoResultColumn[];
    raw: any;

    [column: string]: any;

    constructor(columns: KustoResultColumn[], row: { [ord: number]: any }) {
        this.columns = columns.sort((a, b) => a.ordinal - b.ordinal);
        this.raw = row;

        for (const col of this.columns) {
            const parse = ValueParser[col.type as string];

            this[col.name as string] = parse ? parse(row[col.ordinal]) : row[col.ordinal];
        }
    }

    * values() {
        // tslint:disable-next-line:forin
        for (const item in this.rows) {
            yield item;
        }
    }

    getValueAt(index: number) {
        return this[this.columns[index].name as string];
    }

    toJSON() {
        const obj: any = {};

        for (const col of this.columns) {
            obj[col.name as string] = this[col.name as string];
        }

        return obj;
    }

    toString() {
        return JSON.stringify(this.toJSON());
    }
}

export class KustoResultColumn {
    name: string | null
    type: string | null;
    ordinal: number;

    constructor(columnObj: { ColumnName?: string, ColumnType?: string, DateType?: string }, ordinal: number) {
        this.name = columnObj.ColumnName ?? null;
        // TODO: should validate type? should coarse value to type?
        this.type = (columnObj.ColumnType || columnObj.DateType) ?? null;
        this.ordinal = ordinal;
    }
}

export class KustoResultTable {
    name: string;
    id?: number;
    kind?: string;
    columns: KustoResultColumn[];
    readonly _rows: any[];

    [row: number]: any;

    constructor(tableObj: Table) {
        this.name = tableObj.TableName;
        if (tableObj.TableId !== undefined) {
            this.id = tableObj.TableId;
        }

        if (tableObj.TableKind) {
            this.kind = tableObj.TableKind;
        }

        this.columns = tableObj.Columns.map((item, index) => new KustoResultColumn(item, index));
        this._rows = tableObj.Rows;

        if (this._rows && this._rows.length > 0) {
            for (let i = 0; i < tableObj.Rows.length; i++) {
                Object.defineProperty(this, i, {get: () => new KustoResultRow(this.columns, this._rows[i])});
            }
        }

    }

    * rows() {
        for (const row of this._rows) {
            yield new KustoResultRow(this.columns, row);
        }
    }

    toJSON() {
        const table: any = {};

        table.name = this.name;
        table.data = [];
        for (const row of this.rows()) {
            table.data.push(row.toJSON());
        }

        return table;
    }

    toString() {
        return JSON.stringify(this.toJSON());
    }
}
