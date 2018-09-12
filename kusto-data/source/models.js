const moment = require("moment");

const WellKnownDataSet = {
    PrimaryResult: "PrimaryResult",
    QueryCompletionInformation: "QueryCompletionInformation",
    TableOfContents: "TableOfContents",
    QueryProperties: "QueryProperties"
};

module.exports.WellKnownDataSet = WellKnownDataSet;

const RowConverters = {
    datetime: moment,
    timespan: moment.duration,
    DateTime: moment,
    TimeSpan: moment.duration,
};

class KustoResultRow {
    constructor(columns, row) {
        this.columns = columns.sort((a, b) => a.ordianl - b.ordianl);
        this.row = row;

        for (let col of this.columns) {
            let value = this.row[col.ordinal];
            let convertor = RowConverters[col.type];

            if (convertor) {
                value = convertor(value);
            }

            this[col.name] = value;
        }
    }

    * values() {
        for (let item in this.rows) {
            yield item;
        }
    }

    getValueAt(index) {
        let col = this.columns[index];
        let value = this.row[col.ordianl];

        let convertor = RowConverters[col.type];
        if (convertor) {
            return convertor(value);
        }

        return value;
    }

    toJson() {
        let obj = {};

        for (let col of this.columns) {
            obj[col.name] = this[col.name];
        }

        return obj;
    }

    toString() {
        JSON.stringify(this.toJson());
    }
}

module.exports.KustoResultRow = KustoResultRow;

class KustoResultColumn {
    constructor(columnObj, ordianl) {
        this.name = columnObj.ColumnName;
        this.type = columnObj.ColumnType || columnObj.DateType;
        this.ordinal = ordianl;
    }
}

module.exports.KustoResultColumn = KustoResultColumn;

module.exports.KustoResultTable = class KustoResultTable {
    constructor(tableObj) {
        this.name = tableObj.TableName;
        this.id = tableObj.TableId;
        this.kind = tableObj.TableKind;
        this.columns = tableObj.Columns.map((item, index) => new KustoResultColumn(item, index));
        this._rows = tableObj.Rows;
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