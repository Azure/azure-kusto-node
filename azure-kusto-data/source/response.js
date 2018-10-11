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
        if (!this.statusTable || this.statusTable.length == 0) return 0;

        let minLevel = 4;
        let errors = 0;
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

        return errors;
    }

    getExceptions() {
        if (this.statusTable.length == 0) return [];

        const result = [];
        const errorColumn = this.constructor.getErrorColumn();
        const cridColumn = this.constructor.getCridColumn();
        const statusColumn = this.constructor.getStatusColumn();
        for (let row of this.statusTable.rows()) {
            if (row[errorColumn] < 4) {
                result.push(`Please provide the following data to Kusto: CRID=${row[cridColumn]} Description: ${row[statusColumn]}`);
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
        let tables = data.Tables;
        
        if (tables.length <= 2) {
            tables[0].TableKind = WellKnownDataSet.PrimaryResult;
            tables[0].TableId = 0;

            if (tables.length == 2) {
                tables[1].TableKind = WellKnownDataSet.QueryProperties;
                tables[1].TableId = 1;
            }
        } else {
            const toc = tables[tables.length - 1];
            toc.TableKind = WellKnownDataSet.TableOfContents;
            toc.TableId = tables.length - 1;
            for (let i = 0; i < tables.length - 1; i++) {
                tables[i].TableName = toc[i]["Name"];
                tables[i].TableId = toc[i]["Id"];
                tables[i].TableKind = KustoResponseDataSetV1.getTablesKinds()[toc[i]["Kind"]];
            }
        }

        super(tables);

        this.version = "1.0";
    }
};

// TODO: should only expose 1 response type, versioning should be handled internally
module.exports.KustoResponseDataSetV2 = class KustoResponseDataSetV2 extends KustoResponseDataSet {
    static getStatusColumn() { return "Payload"; }
    static getErrorColumn() { return "Level"; }
    static getCridColumn() { return "ClientRequestId"; }

    constructor(data) {
        super(data.filter(t => t.FrameType === "DataTable"));

        this.version = "2.0";
    }
};