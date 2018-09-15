
const DataFormat = Object.freeze({
    csv: "csv",
    tsv: "tsv",
    scsv: "scsv",
    sohsv: "sohsv",
    psv: "psv",
    txt: "txt",
    json: "json",
    singlejson: "singlejson",
    avro: "avro",
    parquet: "parquet",
});

module.exports.DataFormat = DataFormat;

const ValidationOptions = Object.freeze({
    DoNotValidate: 0,
    ValidateCsvInputConstantColumns: 1,
    ValidateCsvInputColumnLevelOnly: 2
});

module.exports.ValidationOptions = ValidationImplications;

let ValidationImplications = Object.freeze({
    Fail: 0,
    BestEffort: 1
});

module.exports.ValidationImplications = ValidationImplications;

module.exports.ValidationPolicy = class ValidationPolicy {
    constructor(validationOptions = ValidationOptions.DoNotValidate, validationImplications = ValidationImplications.BestEffort) {
        this.ValidationOptions = validationOptions;
        this.ValidationImplications = validationImplications;
    }
};

const ReportLevel = Object.freeze({
    FailuresOnly: 0,
    DoNotReport: 1,
    FailuresAndSuccesses: 2
});

module.exports.ReportLevel = ReportLevel;

const ReportMethod = Object.freeze({
    Queue: 0
});

module.exports.ReportMethod = ReportMethod;

class ColumnMapping { }

module.exports.CsvColumnMapping = class CsvColumnMapping extends ColumnMapping {
    constructor(columnName, cslDataType, ordinal) {
        super();
        this.Name = columnName;
        this.DataType = cslDataType;
        this.Ordinal = ordinal;
    }
};

module.exports.JsonColumnMapping = class JsonColumnMapping extends ColumnMapping {
    constructor(columnName, jsonPath, cslDataType = null) {
        super();
        this.column = columnName;
        this.path = jsonPath;
        this.datatype = cslDataType;
    }
};

module.exports.IngestionProperties = class IngestionProperties {
    constructor(
        database,
        table,
        dataFormat = DataFormat.csv,
        mapping = null,
        mappingReference = null,
        additionalTags = null,
        ingestIfNotExists = null,
        ingestByTags = null,
        dropByTags = null,
        flushImmediately = false,
        reportLevel = ReportLevel.DoNotReport,
        reportMethod = ReportMethod.Queue,
        validationPolicy = null,
        additionalProperties = null
    ) {
        if (mapping && mappingReference) throw new Error("Duplicate mapping detected");

        this.database = database;
        this.table = table;
        this.format = dataFormat;
        this.mapping = mapping;
        this.mappingReference = mappingReference;
        this.additionalTags = additionalTags;
        this.ingestIfNotExists = ingestIfNotExists;
        this.ingestByTags = ingestByTags;
        this.dropByTags = dropByTags;
        this.flushImmediately = flushImmediately;
        this.reportLevel = reportLevel;
        this.reportMethod = reportMethod;
        this.validationPolicy = validationPolicy;
        this.additionalProperties = additionalProperties;
    }

    // TODO: huh? why?
    getMappingFormat() {
        if (this.format == DataFormat.json || this.format == DataFormat.avro) {
            return this.format;
        }
        else {
            return DataFormat.csv;
        }
    }
};
