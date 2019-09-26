
const DataFormat = Object.freeze({
    CSV: "csv",
    TSV: "tsv",
    SCSV: "scsv",
    SOHSV: "sohsv",
    PSV: "psv",
    TXT: "txt",
    JSON: "json",
    SINGLEJSON: "singlejson",
    AVRO: "avro",
    PARQUET: "parquet",
});

module.exports.DataFormat = DataFormat;

const IngestionMappingType = Object.freeze({
    CSV: "Csv",
    PARQUET: "Parquet",
    AVRO: "Avro",
    JSON: "Json"
});

module.exports.IngestionMappingType = IngestionMappingType;

const ValidationOptions = Object.freeze({
    DoNotValidate: 0,
    ValidateCsvInputConstantColumns: 1,
    ValidateCsvInputColumnLevelOnly: 2
});

module.exports.ValidationOptions = ValidationOptions;

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
    constructor({     
        database = null,
        table = null,
        format = null,
        ingestionMapping = null,
        ingestionMappingReference = null,
        ingestionMappingType = null,
        additionalTags = null,
        ingestIfNotExists = null,
        ingestByTags = null,
        dropByTags = null,
        flushImmediately = null,
        reportLevel = null,
        reportMethod = null,
        validationPolicy = null,
        additionalProperties = null
    }) {
        if (ingestionMapping && ingestionMappingReference) throw new Error("Both mapping and a mapping reference detected");

        this.database = database;
        this.table = table;
        this.format = format;
        this.ingestionMapping = ingestionMapping;
        this.ingestionMappingType = ingestionMappingType;
        this.ingestionMappingReference = ingestionMappingReference; 
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

    validate() {

        if (!this.flushImmediately) this.flushImmediately = false;
        if (!this.reportLevel) this.reportLevel = ReportLevel.DoNotReport;
        if (!this.reportMethod) this.reportMethod = ReportMethod.Queue;

        if (!this.database) throw new Error("Must define a target database");        
        if (!this.table) throw new Error("Must define a target table");        
        if (!this.format) throw new Error("Must define a data format");
        if (this.ingestionMapping && this.ingestionMappingReference)
            throw new Error("Both mapping and a mapping reference detected");
        if (!this.ingestionMapping && !this.ingestionMappingReference && this.format === DataFormat.JSON) 
            throw new Error("Json must have a mapping defined");
    }

    merge(extraProps) {
        const merged = new IngestionProperties(this);
        
        for (let key of Object.keys(extraProps)) {
            if (extraProps[key] != null) {
                merged[key] = extraProps[key];
            }
        }
        
        return merged; 
    }
};
