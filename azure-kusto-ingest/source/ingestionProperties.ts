// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// The main class is IngestionProperties, ValidationPolicy is a tiny class
/* tslint:disable:max-classes-per-file */

import { IngestionPropertiesValidationError } from "./errors";
import { ColumnMapping } from "./columnMappings";

export enum DataFormat {
    CSV = "csv",
    TSV = "tsv",
    SCSV = "scsv",
    SOHSV = "sohsv",
    PSV = "psv",
    TXT = "txt",
    RAW = "raw",
    TSVE = "tsve",
    JSON = "json",
    SINGLEJSON = "singlejson",
    MULTIJSON = "multijson",
    AVRO = "avro",
    PARQUET = "parquet",
    SSTREAM = "sstream",
    ORC = "orc",
    APACHEAVRO = "apacheavro",
    W3CLogFile = "w3clogfile",
}

export const MappingRequiredFormats = Object.freeze([DataFormat.JSON, DataFormat.SINGLEJSON, DataFormat.AVRO, DataFormat.ORC])

export enum IngestionMappingKind {
    CSV = "Csv",
    JSON = "Json",
    AVRO = "Avro",
    PARQUET = "Parquet",
    SSTREAM = "SStream",
    ORC = "orc",
    APACHEAVRO = "ApacheAvro",
    W3CLOGFILE = "W3CLogFile",
}

export function dataFormatMappingKind(dataFormat: DataFormat): IngestionMappingKind {
    switch (dataFormat) {
        case DataFormat.CSV:
            return IngestionMappingKind.CSV;
        case DataFormat.TSV:
            return IngestionMappingKind.CSV;
        case DataFormat.SCSV:
            return IngestionMappingKind.CSV;
        case DataFormat.SOHSV:
            return IngestionMappingKind.CSV;
        case DataFormat.PSV:
            return IngestionMappingKind.CSV;
        case DataFormat.TXT:
            return IngestionMappingKind.CSV;
        case DataFormat.RAW:
            return IngestionMappingKind.CSV;
        case DataFormat.TSVE:
            return IngestionMappingKind.CSV;
        case DataFormat.JSON:
            return IngestionMappingKind.JSON;
        case DataFormat.SINGLEJSON:
            return IngestionMappingKind.JSON;
        case DataFormat.MULTIJSON:
            return IngestionMappingKind.JSON;
        case DataFormat.AVRO:
            return IngestionMappingKind.AVRO;
        case DataFormat.PARQUET:
            return IngestionMappingKind.PARQUET;
        case DataFormat.SSTREAM:
            return IngestionMappingKind.SSTREAM;
        case DataFormat.ORC:
            return IngestionMappingKind.ORC;
        case DataFormat.APACHEAVRO:
            return IngestionMappingKind.APACHEAVRO;
        case DataFormat.W3CLogFile:
            return IngestionMappingKind.W3CLOGFILE;
        default:
            throw new IngestionPropertiesValidationError(`Unsupported data format: ${dataFormat}`);
    }
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
    toJSON(): Record<string, number> {
        return {
            ValidationOptions: this.validationOptions,
            ValidationImplications: this.validationImplications
        };
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

export class IngestionProperties{
    database?: string;
    table?: string;
    format: DataFormat = DataFormat.CSV;
    ingestionMappingColumns?: ColumnMapping[];
    ingestionMappingReference?: string;
    ingestionMappingKind?: IngestionMappingKind;
    additionalTags?: string;
    ingestIfNotExists?: string;
    ingestByTags?: string[];
    dropByTags?: string[];
    flushImmediately: boolean = false;
    reportLevel: ReportLevel = ReportLevel.DoNotReport;
    reportMethod: ReportMethod = ReportMethod.Queue;
    validationPolicy?: ValidationPolicy;
    additionalProperties?: { [additional: string]: any } | null;

    constructor(data: Partial<IngestionProperties>) {
        Object.assign(this, data);
    }

    validate() {
        if (!this.database) throw new IngestionPropertiesValidationError("Must define a target database");
        if (!this.table) throw new IngestionPropertiesValidationError("Must define a target table");
        if (!this.format) throw new IngestionPropertiesValidationError("Must define a data format");


        if (!this.ingestionMappingColumns && !this.ingestionMappingReference) {
            if (this.ingestionMappingKind) {
                throw new IngestionPropertiesValidationError("Cannot define ingestionMappingKind without either ingestionMappingColumns or" +
                    " ingestionMappingReference");
            }

            if (MappingRequiredFormats.includes(this.format as DataFormat)) {
                throw new IngestionPropertiesValidationError(`Mapping reference required for format '${this.format}'.`);
            }
        } else {
            const mappingKind = dataFormatMappingKind(this.format);
            if (this.ingestionMappingKind && this.ingestionMappingKind !== mappingKind) {
                throw new IngestionPropertiesValidationError(`Mapping kind '${this.ingestionMappingKind}' does not match format '${this.format}' (should be '${mappingKind}')`);
            }
            if (this.ingestionMappingColumns) {
                if (this.ingestionMappingReference) {
                    throw new IngestionPropertiesValidationError("Cannot define both ingestionMappingColumns and ingestionMappingReference");
                }

                if (this.ingestionMappingColumns.length === 0) {
                    throw new IngestionPropertiesValidationError("Must define at least one column mapping");
                }

                const wrongMappings = this.ingestionMappingColumns.filter(m => m.mappingKind !== mappingKind).map(m => `Mapping kind mismatch for column '${m.columnName}' - expected data format kind -  '${mappingKind}', but was '${m.mappingKind}'`);
                if (wrongMappings.length > 0) {
                    throw new IngestionPropertiesValidationError(`Invalid columns:\n${wrongMappings.join("\n")}`);
                }
            }
        }
    }

    merge(extraProps: IngestionProperties) {
        const merged = new IngestionProperties(this);

        for (const key of Object.keys(extraProps) as (keyof IngestionProperties)[]) {
            if ( extraProps[key]) {
                (<K extends keyof IngestionProperties>(k: K) => { merged[k] = extraProps[k]; })(key);
            }
        }

        return merged;
    }
}

export default IngestionProperties;

