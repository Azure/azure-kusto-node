// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum DataFormat {
    CSV = "csv",
    TSV = "tsv",
    SCSV = "scsv",
    SOHSV = "sohsv",
    PSV = "psv",
    TXT = "txt",
    JSON = "json",
    SINGLEJSON = "singlejson",
    AVRO = "avro",
    PARQUET = "parquet",
    TSVE = "tsve",
    ORC = "orc"
}

export enum IngestionMappingType {
    CSV = "Csv",
    PARQUET = "Parquet",
    AVRO = "Avro",
    JSON = "Json",
    ORC = "orc"
}

export enum ValidationOptions {
    DoNotValidate = 0,
    ValidateCsvInputConstantColumns = 1,
    ValidateCsvInputColumnLevelOnly = 2
}


export enum ValidationImplications {
    Fail = 0,
    BestEffort = 1
}


export class ValidationPolicy {
    constructor(readonly validationOptions: ValidationOptions = ValidationOptions.DoNotValidate, readonly validationImplications: ValidationImplications = ValidationImplications.BestEffort) {
    }
}

export enum ReportLevel {
    FailuresOnly = 0,
    DoNotReport = 1,
    FailuresAndSuccesses = 2
}

export enum ReportMethod {
    Queue = 0
}

class ColumnMapping {
}

export class CsvColumnMapping extends ColumnMapping {
    constructor(readonly columnName: string, readonly cslDataType: string, readonly ordinal: string) {
        super();
    }
}

export class JsonColumnMapping extends ColumnMapping {
    constructor(readonly columnName: string, readonly jsonPath: string, readonly cslDataType: string | null = null) {
        super();
    }
}

class IngestionPropertiesFields {
    database: string | null = null;
    table: string | null = null;
    format: string | null = null;
    ingestionMapping: string | null = null;
    ingestionMappingReference: string | null = null;
    ingestionMappingType: string | null = null;
    additionalTags: string | null = null;
    ingestIfNotExists: string | null = null;
    ingestByTags: string[] | null = null;
    dropByTags: string[] | null = null;
    flushImmediately: boolean | null = null;
    reportLevel: ReportLevel | null = null;
    reportMethod: ReportMethod | null = null;
    validationPolicy: string | null = null;
    additionalProperties: {[any:string] : any} | null = null;
}

export class IngestionProperties extends IngestionPropertiesFields {

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
                }: IngestionPropertiesFields) {
        super();
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

    [extraProps: string] : any;

    merge(extraProps: any) {
        const merged = new IngestionProperties(this);

        for (let key of Object.keys(extraProps)) {
            if (extraProps[key] != null) {
                merged[key] = extraProps[key];
            }
        }

        return merged;
    }
}

export default IngestionProperties;
