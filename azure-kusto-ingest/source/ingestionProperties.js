const deprecate = require("util").deprecate;
const noop = () => {};

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
        database,
        table,
        dataFormat,
        ingestionMapping = null,
        ingestionMappingReference = null,
        ingestionMappingType = null,
        additionalTags = null,
        ingestIfNotExists = null,
        ingestByTags = null,
        dropByTags = null,
        flushImmediately = false,
        reportLevel = ReportLevel.DoNotReport,
        reportMethod = ReportMethod.Queue,
        validationPolicy = null,
        additionalProperties = null
    }) {
        if (mapping) {
            deprecate(noop, "mapping will be deprecated in the next major version. \
                                    Please use ingestionMapping instead");
        }

        if (mappingReference) {
            deprecate(noop, "mappingReference will be deprecated in the next major version. \
                                    Please use ingestionMappingReference instead");
        }

        // Validate
        if (!database) throw new Error("Must define a target database");        
        if (!table) throw new Error("Must define a target table");        
        if (!dataFormat) throw new Error("Must define a data format");
        if (mapping && ingestionMapping) throw new Error("Duplicate mappings detected");
        if (mappingReference && ingestionMappingReference) throw new Error("Duplicate mapping references detected");

        var mappingExists = !!mapping || !!ingestionMapping;
        if (mappingExists && (mappingReference || ingestionMappingReference)) throw new Error("Both mapping and a mapping reference detected");
        if (!mapping && !mappingReference && dataFormat === DataFormat.JSON) throw new Error("Json must have a mapping defined");

        this.database = database;
        this.table = table;
        this.format = dataFormat;
        this.ingestionMapping = ingestionMapping ? ingestionMapping : mapping;
        this.ingestionMappingType = ingestionMappingType;
        this.ingestionMappingReference = ingestionMappingReference ? ingestionMappingReference : mappingReference; 
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
        if (!this.database) throw new Error("Must define a target database");        
        if (!this.table) throw new Error("Must define a target table");        
        if (!this.format) throw new Error("Must define a data format");
        if (this.mapping && this.ingestionMapping) throw new Error("Duplicate mappings detected");
        if (this.mappingReference && this.ingestionMappingReference) throw new Error("Duplicate mapping references detected");

        var mappingExists = !!this.mapping || !!this.ingestionMapping;
        if (mappingExists && (this.mappingReference || this.ingestionMappingReference)) throw new Error("Both mapping and a mapping reference detected");
        if (!this.mapping && !this.mappingReference && this.format === DataFormat.JSON) throw new Error("Json must have a mapping defined");
    }

    merge(extraProps) {
        let merged = new IngestionProperties();

        for (let key of Object.keys(this)) {
            if (this[key] != null) {
                merged[key] = this[key];
            }
        } 

        for (let key of Object.keys(extraProps)) {
            if (extraProps[key] != null) {
                merged[key] = extraProps[key];
            }
        }

        return merged;
    }
};
