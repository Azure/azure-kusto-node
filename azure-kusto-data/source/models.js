// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const moment = require("moment");

const WellKnownDataSet = {
    PrimaryResult: "PrimaryResult",
    QueryCompletionInformation: "QueryCompletionInformation",
    TableOfContents: "TableOfContents",
    QueryProperties: "QueryProperties"
};

module.exports.WellKnownDataSet = WellKnownDataSet;

const ValueParser = {
    datetime: moment,
    timespan: moment.duration,
    DateTime: moment,
    TimeSpan: moment.duration,
};

class KustoResultRow {
    constructor(columns, row) {
        this.columns = columns.sort((a, b) => a.ordinal - b.ordinal);
        this.raw = row;

        for (let col of this.columns) {
            let parse = ValueParser[col.type];

            this[col.name] = parse ? parse(row[col.ordinal]) : row[col.ordinal];
        }
    }

    * values() {
        for (let item in this.rows) {
            yield item;
        }
    }

    getValueAt(index) {
        return this[this.columns[index].name];
    }

    toJson() {
        let obj = {};

        for (let col of this.columns) {
            obj[col.name] = this[col.name];
        }

        return obj;
    }

    toString() {
        return JSON.stringify(this.toJson());
    }
}

module.exports.KustoResultRow = KustoResultRow;

class KustoResultColumn {
    constructor(columnObj, ordinal) {
        this.name = columnObj.ColumnName;
        // TODO: should validate type? should coarse value to type?
        this.type = columnObj.ColumnType || columnObj.DateType;
        this.ordinal = ordinal;
    }
}

module.exports.KustoResultColumn = KustoResultColumn;

module.exports.KustoResultTable = class KustoResultTable {
    constructor(tableObj) {
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
            for (let i = 0; i<tableObj.Rows.length; i++) {
                Object.defineProperty(this, i, { get: () => new KustoResultRow(this.columns, this._rows[i])});
            }
        }
        
    }

    * rows() {
        for (let row of this._rows) {
            yield new KustoResultRow(this.columns, row);
        }
    }

    toJson() {
        let table = {};

        table.name = this.name;
        table.data = [];
        for (let row of this.rows()) {
            table.data.push(row.toJson());
        }

        return table;
    }

    toString() {
        return JSON.stringify(this.toJson());
    }
};
