const { KustoResultTable, WellKnownDataSet } = require("./models");

class KustoResponseDataSet {
    constructor(tables) {
        let _tables = tables;

        if (!Array.isArray(tables)) {
            _tables = [tables];
        }

        this.tables = [];
        this.tableNames = [];
        this.primaryResults = [];
        for (let table of _tables) {
            let resultTable = new KustoResultTable(table);
            this.tables.push(resultTable);
            this.tableNames.push(resultTable.name);

            if (resultTable.kind === WellKnownDataSet.PrimaryResult) {
                this.primaryResults.push(resultTable);
            } else if (resultTable.kind === WellKnownDataSet.QueryCompletionInformation) {
                this.statusTable = resultTable;
            }
        }
    }

    getErrorsCount() {
        let errors = 0;

        if (this.statusTable && this.statusTable._rows.length != 0) {
            let minLevel = 4;

            const errorColumn = this.constructor.getErrorColumn();
            for (let row of this.statusTable.rows()) {
                if (row[errorColumn] < 4) {
                    if (row[errorColumn] < minLevel) {
                        minLevel = row[errorColumn];
                        errors = 1;
                    } else if (row[errorColumn] == minLevel) {
                        errors += 1;
                    }
                }
            }
        }
        if (this.dataSetCompletion && this.dataSetCompletion["HasErrors"]) {
            errors += 1;
        }

        return errors;
    }

    getExceptions() {
        const result = [];
        if (this.statusTable && this.statusTable._rows.length != 0) {

            const errorColumn = this.constructor.getErrorColumn();
            const cridColumn = this.constructor.getCridColumn();
            const statusColumn = this.constructor.getStatusColumn();
            for (let row of this.statusTable.rows()) {
                if (row[errorColumn] < 4) {
                    result.push(`Please provide the following data to Kusto: CRID=${row[cridColumn]} Description: ${row[statusColumn]}`);
                }
            }
        }
        if (this.dataSetCompletion && this.dataSetCompletion["HasErrors"]) {
            for (let row of this.dataSetCompletion["OneApiErrors"]) {
                result.push( row["error"]["@message"]);
            }
        }
        return result;
    }
}

// TODO: should only expose 1 response type, versioning should be handled internally
module.exports.KustoResponseDataSetV1 = class KustoResponseDataSetV1 extends KustoResponseDataSet {
    static getStatusColumn() { return "StatusDescription"; }
    static getCridColumn() { return "ClientActivityId"; }
    static getErrorColumn() { return "Severity"; }

    static getTablesKinds() {
        return {
            "QueryResult": WellKnownDataSet.PrimaryResult,
            "QueryProperties": WellKnownDataSet.QueryProperties,
            "QueryStatus": WellKnownDataSet.QueryCompletionInformation,
        };
    }

    constructor(data) {
        super(data.Tables);

        if (this.tables.length <= 2) {
            if (this.tables[0].kind === undefined) {
                this.tables[0].kind = WellKnownDataSet.PrimaryResult;
                this.primaryResults.push(this.tables[0]);
            }

            this.tables[0].id = 0;

            if (this.tables.length == 2) {
                this.tables[1].kind = WellKnownDataSet.QueryProperties;
                this.tables[1].id = 1;
            }
        } else {
            const toc = this.tables[this.tables.length - 1];
            toc.kind = WellKnownDataSet.TableOfContents;
            toc.id = this.tables.length - 1;
            for (let i = 0; i < this.tables.length - 1; i++) {
                this.tables[i].name = toc[i]["Name"];
                this.tables[i].id = toc[i]["Id"];
                this.tables[i].kind = KustoResponseDataSetV1.getTablesKinds()[toc[i]["Kind"]];
            }
        }

        this.version = "1.0";
    }
};

// TODO: should only expose 1 response type, versioning should be handled internally
module.exports.KustoResponseDataSetV2 = class KustoResponseDataSetV2 extends KustoResponseDataSet {
    static getStatusColumn() { return "Payload"; }
    static getErrorColumn() { return "Level"; }
    static getCridColumn() { return "ClientRequestId"; }

    constructor(data) {
        let dataTables = [];
        let dataSetHeader;
        let dataSetCompletion;
        data.forEach(frame => {
            switch (frame.FrameType) {
                case "DataTable":
                    dataTables.push(frame);
                    break;
                case "DataSetHeader":
                    dataSetHeader = frame;
                    break;
                case "DataSetCompletion":
                    dataSetCompletion = frame;
                    break;
            }
        });

        super(dataTables);
        this.dataSetHeader = dataSetHeader;
        this.dataSetCompletion = dataSetCompletion;
        this.version = "2.0";
    }
};
