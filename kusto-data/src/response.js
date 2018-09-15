const { KustoResultTable, WellKnownDataSet } = require("./models");

class KustoResponseDataSet {
    constructor(tables) {
        let _tables = tables;

        if (!Array.isArray(tables)) {
            _tables = [tables];
        }

        this.tables = [];
        this.tableNames = [];
        this.primaryResults = []
        for (let table of _tables) {
            let resultTable = new KustoResultTable(table);
            this.tables.push(resultTable);
            this.tableNames.push(resultTable.name);

            if (resultTable.kind === WellKnownDataSet.PrimaryResult) {
                this.primaryResults.push(resultTable);
            } else if (resultTable === WellKnownDataSet.QueryCompletionInformation) {
                this.statusTable = resultTable;
            }
        }
    }

    getErrorsCount() {
        // TODO: this is bad code, since there is no way of 
        // knowing function will be implemented, and versions are not related 
        // (inherticne is the wrong way to go here)        
        if (this.statusTable.length == 0) return 0;

        let minLevel = 4;
        let errors = 0;
        const errorColumn = this.constructor.getErrorColumn();
        for (let row in this.statusTable) {
            // TODO: minlevel of what? severity? verbosity?
            // TODO: this is really odd logic, fix this later
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
        for (let row in this.statusTable.rows()) {
            if (row[errorColumn] < 4) {
                result.push(`Please provide the following data to Kusto: CRID=${row[cridColumn]} Description: ${row[statusColumn]}`);
            }
        }
        return result;
    }
}

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
        super(data["Tables"]);
        // TODO : this is a bad idea, takes control away from the constructor
        if (this.tables.length <= 2) {
            this.tables[0].kind = WellKnownDataSet.PrimaryResult;
            this.tables[0].id = 0;

            if (this.tablesCount == 2) {
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
                this.tables[i].kind = this.getTablesKinds()[toc[i]["Kind"]];
            }
        }
    }
};

module.exports.KustoResponseDataSetV2 = class KustoResponseDataSetV2 extends KustoResponseDataSet {
    static getStatusColumn() { return "Payload"; }
    static getErrorColumn() { return "Level"; }
    static getCridColumn() { return "ClientRequestId"; }

    constructor(data) {
        super(data.filter(t => t.FrameType === "DataTable"));
    }
};