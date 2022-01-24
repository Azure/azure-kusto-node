// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

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

export enum IngestionMappingType {
    Unknown = "Unknown",
    CSV = "Csv",
    JSON = "Json",
    AVRO = "Avro",
    PARQUET = "Parquet",
    SSTREAM = "SStream",
    ORC = "orc",
    APACHEAVRO = "ApacheAvro",
    W3CLOGFILE = "W3CLogFile",
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
    constructor(readonly columnName: string, readonly cslDataType?: string, readonly Properties?: MappingProperties) {
    }

    public abstract mappingType(): IngestionMappingType;

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

    mappingType = (): IngestionMappingType => IngestionMappingType.CSV;
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

    mappingType = (): IngestionMappingType => IngestionMappingType.JSON;
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

    mappingType = (): IngestionMappingType => IngestionMappingType.AVRO;
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

    mappingType = (): IngestionMappingType => IngestionMappingType.PARQUET;
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

    mappingType = (): IngestionMappingType => IngestionMappingType.ORC;
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

    mappingType = (): IngestionMappingType => IngestionMappingType.W3CLOGFILE;
}


class IngestionPropertiesFields {
    database?: string | null = null;
    table?: string | null = null;
    format?: string | null = null;
    ingestionMapping?: ColumnMapping[] | null = null;
    ingestionMappingReference?: string | null = null;
    ingestionMappingType?: IngestionMappingType | string | null = null;
    additionalTags?: string | null = null;
    ingestIfNotExists?: string | null = null;
    ingestByTags?: string[] | null = null;
    dropByTags?: string[] | null = null;
    flushImmediately?: boolean | null = null;
    reportLevel?: ReportLevel | null = null;
    reportMethod?: ReportMethod | null = null;
    validationPolicy?: string | null = null;
    additionalProperties?: { [additional: string]: any } | null = null;
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
        if (this.ingestionMapping && this.ingestionMappingReference) {
            throw new Error("Both mapping and a mapping reference detected");
        }
        if (!this.ingestionMapping && !this.ingestionMappingReference && MappingRequiredFormats.includes(this.format as DataFormat)) {
            throw new Error(`Mapping reference required for format ${this.format}.`);
        }

        if (this.ingestionMapping && this.ingestionMapping.length > 0) {
            if (!this.ingestionMappingType) {
                this.ingestionMappingType = this.ingestionMapping[0].mappingType().toString();
            } else {
                if (this.ingestionMappingType.toString() !== this.ingestionMapping[0].mappingType().toString()) {
                    throw new Error(`Mapping type mismatch between ingestion mapping type (${this.ingestionMappingType}) and provided mapping object (${this.ingestionMapping[0].mappingType().toString()}).`);
                }
            }
        }

        if (this.ingestionMappingType) {
            if (this.format && (this.ingestionMappingType.toLowerCase() != this.format.toLowerCase())) {
                throw new Error(`Format (${this.format}) doesn't match Ingestion Mapping Type (${this.ingestionMappingType}).`);
            }
        }

        // TODO - should we throw an error when having mappings but not specifying the type? in c# it's a "warning"

    }

    [extraProps: string]: any;

    merge(extraProps: any) {
        const merged = new IngestionProperties(this);

        for (const key of Object.keys(extraProps)) {
            if (extraProps[key] != null) {
                merged[key] = extraProps[key];
            }
        }

        return merged;
    }
}

export default IngestionProperties;

export const MappingRequiredFormats = Object.freeze([DataFormat.JSON, DataFormat.SINGLEJSON, DataFormat.AVRO, DataFormat.ORC])