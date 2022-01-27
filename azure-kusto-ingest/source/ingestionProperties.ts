// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// TODO: split this file when we merge the new ColumnMappings
/* tslint:disable:max-classes-per-file */

import { IngestionPropertiesValidationError } from "./errors";

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
}

export enum ReportLevel {
    FailuresOnly = 0,
    DoNotReport = 1,
    FailuresAndSuccesses = 2
}

export enum ReportMethod {
    Queue = 0
}

export enum FieldTransformation {
    PropertyBagArrayToDictionary = "PropertyBagArrayToDictionary",
    DateTimeFromUnixSeconds = "DateTimeFromUnixSeconds",
    DateTimeFromUnixMilliseconds = "DateTimeFromUnixMilliseconds",
    DateTimeFromUnixMicroseconds = "DateTimeFromUnixMicroseconds",
    DateTimeFromUnixNanoseconds = "DateTimeFromUnixNanoseconds",
}

export enum ConstantTransformation {
    SourceLocation = "SourceLocation",
    SourceLineNumber = "SourceLineNumber",
}

export type Transformation = FieldTransformation | ConstantTransformation;

interface MappingProperties {
    Field?: string;
    Path?: string;
    Ordinal?: number;
    ConstValue?: string;
    Transform?: Transformation;
}

type MappingPropertiesStrings = {
    [key in keyof MappingProperties]: string
}

interface ApiColumnMapping {
    Column: string,
    DataType?: string,
    Properties?: MappingPropertiesStrings
}

abstract class ColumnMapping {
    protected constructor(readonly columnName: string, readonly cslDataType?: string, readonly Properties?: MappingProperties) {
    }

    public abstract mappingKind: IngestionMappingKind;

    public toApiMapping(): ApiColumnMapping {
        const result: ApiColumnMapping = {
            Column: this.columnName,
        }
        if (this.cslDataType) {
            result.DataType = this.cslDataType;
        }

        if (this.Properties) {
            result.Properties = {};
            for (const key in this.Properties) {
                if (this.Properties.hasOwnProperty(key)) {
                    const typedKey = key as keyof MappingProperties;
                    const property = this.Properties[typedKey];

                    // We don't do if (property) because we '0' is a legitimate value
                    if (property !== undefined && property !== null) {
                        result.Properties[typedKey] = property.toString();
                    }
                }
            }
        }
        return result;
    }
}

export class CsvColumnMapping extends ColumnMapping {
    /**
     * @deprecated Use the factory methods instead.
     */
    protected constructor(readonly columnName: string, readonly cslDataType?: string, readonly ordinal?: string, constantValue?: string) {
        super(columnName, cslDataType, { Ordinal: ordinal === undefined ? undefined : parseInt(ordinal, 10), ConstValue: constantValue });
    }

    public static withOrdinal(columnName: string, ordinal: number, cslDataType?: string): CsvColumnMapping {
        return new CsvColumnMapping(columnName, cslDataType, ordinal.toString());
    }

    public static withConstantValue(columnName: string, constantValue: string, cslDataType?: string): CsvColumnMapping {
        return new CsvColumnMapping(columnName, cslDataType, undefined, constantValue);
    }

    mappingKind = IngestionMappingKind.CSV;
}

export class JsonColumnMapping extends ColumnMapping {
    /**
     * @deprecated Use the factory methods instead.
     */
    constructor(readonly columnName: string, readonly jsonPath?: string, cslDataType: string | null = null, constantValue?: string, transform?: Transformation) {
        super(columnName, cslDataType ?? undefined, { Path: jsonPath, ConstValue: constantValue, Transform: transform });
    }

    public static withPath(columnName: string, path: string, cslDataType?: string, transform?: FieldTransformation): JsonColumnMapping {
        return new JsonColumnMapping(columnName, path, cslDataType, undefined, transform);
    }

    public static withConstantValue(columnName: string, constantValue: string, cslDataType?: string): JsonColumnMapping {
        return new JsonColumnMapping(columnName, undefined, cslDataType, constantValue);
    }

    public static withTransform(columnName: string, transform: ConstantTransformation, cslDataType?: string): JsonColumnMapping {
        return new JsonColumnMapping(columnName, undefined, cslDataType, undefined, transform);
    }

    mappingKind = IngestionMappingKind.JSON;
}

export class AvroColumnMapping extends ColumnMapping {
    private constructor(readonly columnName: string, cslDataType?: string, path?: string, field?: string, constantValue?: string, transform?: Transformation) {
        super(columnName, cslDataType ?? undefined, { Path: path, Field: field, ConstValue: constantValue, Transform: transform });
    }

    public static withPath(columnName: string, path: string, cslDataType?: string, transform?: FieldTransformation): AvroColumnMapping {
        return new AvroColumnMapping(columnName, cslDataType, path, undefined, undefined, transform);
    }

    public static withField(columnName: string, field: string, cslDataType?: string, transform?: FieldTransformation): AvroColumnMapping {
        return new AvroColumnMapping(columnName, cslDataType, undefined, field, undefined, transform);
    }

    public static withConstantValue(columnName: string, constantValue: string, cslDataType?: string): AvroColumnMapping {
        return new AvroColumnMapping(columnName, cslDataType, undefined, undefined, constantValue);
    }

    public static withTransform(columnName: string, transform: ConstantTransformation, cslDataType?: string): AvroColumnMapping {
        return new AvroColumnMapping(columnName, cslDataType, undefined, undefined, undefined, transform);
    }

    mappingKind = IngestionMappingKind.AVRO;
}

export class ApacheAvroColumnMapping extends ColumnMapping {
    private constructor(readonly columnName: string, cslDataType?: string, path?: string, field?: string, constantValue?: string, transform?: Transformation) {
        super(columnName, cslDataType ?? undefined, { Path: path, Field: field, ConstValue: constantValue, Transform: transform });
    }

    public static withPath(columnName: string, path: string, cslDataType?: string, transform?: FieldTransformation): ApacheAvroColumnMapping {
        return new ApacheAvroColumnMapping(columnName, cslDataType, path, undefined, undefined, transform);
    }

    public static withField(columnName: string, field: string, cslDataType?: string, transform?: FieldTransformation): ApacheAvroColumnMapping {
        return new ApacheAvroColumnMapping(columnName, cslDataType, undefined, field, undefined, transform);
    }

    public static withConstantValue(columnName: string, constantValue: string, cslDataType?: string): ApacheAvroColumnMapping {
        return new ApacheAvroColumnMapping(columnName, cslDataType, undefined, undefined, constantValue);
    }

    public static withTransform(columnName: string, transform: ConstantTransformation, cslDataType?: string): ApacheAvroColumnMapping {
        return new ApacheAvroColumnMapping(columnName, cslDataType, undefined, undefined, undefined, transform);
    }

    mappingKind = IngestionMappingKind.APACHEAVRO;
}


export class SStreamColumnMapping extends ColumnMapping {
    private constructor(readonly columnName: string, cslDataType?: string, path?: string, field?: string, constantValue?: string, transform?: Transformation) {
        super(columnName, cslDataType ?? undefined, { Path: path, Field: field, ConstValue: constantValue, Transform: transform });
    }

    public static withPath(columnName: string, path: string, cslDataType?: string, transform?: FieldTransformation): SStreamColumnMapping {
        return new SStreamColumnMapping(columnName, cslDataType, path, undefined, undefined, transform);
    }

    public static withField(columnName: string, field: string, cslDataType?: string, transform?: FieldTransformation): SStreamColumnMapping {
        return new SStreamColumnMapping(columnName, cslDataType, undefined, field, undefined, transform);
    }

    public static withConstantValue(columnName: string, constantValue: string, cslDataType?: string): SStreamColumnMapping {
        return new SStreamColumnMapping(columnName, cslDataType, undefined, undefined, constantValue);
    }

    public static withTransform(columnName: string, transform: ConstantTransformation, cslDataType?: string): SStreamColumnMapping {
        return new SStreamColumnMapping(columnName, cslDataType, undefined, undefined, undefined, transform);
    }

    mappingKind = IngestionMappingKind.SSTREAM;
}

export class ParquetColumnMapping extends ColumnMapping {
    private constructor(readonly columnName: string, cslDataType?: string, path?: string, field?: string, constantValue?: string, transform?: Transformation) {
        super(columnName, cslDataType ?? undefined, { Path: path, Field: field, ConstValue: constantValue, Transform: transform });
    }

    public static withPath(columnName: string, path: string, cslDataType?: string, transform?: FieldTransformation): ParquetColumnMapping {
        return new ParquetColumnMapping(columnName, cslDataType, path, undefined, undefined, transform);
    }

    public static withField(columnName: string, field: string, cslDataType?: string, transform?: FieldTransformation): ParquetColumnMapping {
        return new ParquetColumnMapping(columnName, cslDataType, undefined, field, undefined, transform);
    }

    public static withConstantValue(columnName: string, constantValue: string, cslDataType?: string): ParquetColumnMapping {
        return new ParquetColumnMapping(columnName, cslDataType, undefined, undefined, constantValue);
    }

    public static withTransform(columnName: string, transform: ConstantTransformation, cslDataType?: string): ParquetColumnMapping {
        return new ParquetColumnMapping(columnName, cslDataType, undefined, undefined, undefined, transform);
    }

    mappingKind = IngestionMappingKind.PARQUET;
}

export class OrcColumnMapping extends ColumnMapping {
    private constructor(readonly columnName: string, cslDataType?: string, path?: string, field?: string, constantValue?: string, transform?: Transformation) {
        super(columnName, cslDataType ?? undefined, { Path: path, Field: field, ConstValue: constantValue, Transform: transform });
    }

    public static withPath(columnName: string, path: string, cslDataType?: string, transform?: FieldTransformation): OrcColumnMapping {
        return new OrcColumnMapping(columnName, cslDataType, path, undefined, undefined, transform);
    }

    public static withField(columnName: string, field: string, cslDataType?: string, transform?: FieldTransformation): OrcColumnMapping {
        return new OrcColumnMapping(columnName, cslDataType, undefined, field, undefined, transform);
    }

    public static withConstantValue(columnName: string, constantValue: string, cslDataType?: string): OrcColumnMapping {
        return new OrcColumnMapping(columnName, cslDataType, undefined, undefined, constantValue);
    }

    public static withTransform(columnName: string, transform: ConstantTransformation, cslDataType?: string): OrcColumnMapping {
        return new OrcColumnMapping(columnName, cslDataType, undefined, undefined, undefined, transform);
    }

    mappingKind = IngestionMappingKind.ORC;
}

export class W3CLogFileMapping extends ColumnMapping {
    private constructor(readonly columnName: string, cslDataType?: string, field?: string, constantValue?: string, transform?: Transformation) {
        super(columnName, cslDataType ?? undefined, { Field: field, ConstValue: constantValue, Transform: transform });
    }

    public static withField(columnName: string, field: string, cslDataType?: string, transform?: FieldTransformation): W3CLogFileMapping {
        return new W3CLogFileMapping(columnName, cslDataType, field, undefined, transform);
    }

    public static withConstantValue(columnName: string, constantValue: string, cslDataType?: string): W3CLogFileMapping {
        return new W3CLogFileMapping(columnName, cslDataType, undefined, constantValue);
    }

    public static withTransform(columnName: string, transform: ConstantTransformation, cslDataType?: string): W3CLogFileMapping {
        return new W3CLogFileMapping(columnName, cslDataType, undefined, undefined, transform);
    }

    mappingKind = IngestionMappingKind.W3CLOGFILE;
}




export class IngestionProperties{
    database?: string;
    table?: string;
    format: DataFormat = DataFormat.CSV;
    ingestionMappingColumns?: ColumnMapping[];
    ingestionMappingReference?: string;
    ingestionMappingKind?: IngestionMappingKind;
    additionalTags?: string | null;
    ingestIfNotExists?: string | null;
    ingestByTags?: string[] | null;
    dropByTags?: string[] | null;
    flushImmediately: boolean = false;
    reportLevel: ReportLevel = ReportLevel.DoNotReport;
    reportMethod: ReportMethod = ReportMethod.Queue;
    validationPolicy?: string | null;
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

export const MappingRequiredFormats = Object.freeze([DataFormat.JSON, DataFormat.SINGLEJSON, DataFormat.AVRO, DataFormat.ORC])