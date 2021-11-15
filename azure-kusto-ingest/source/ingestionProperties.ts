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

interface MappingProperties {
    Field?: string;
    Path?: string;
    Ordinal?: string;
    ConstantValue?: string;
    Transform?: string;
}

interface ApiColumnMapping {
    Column: string,
    DataType?: string,
    Properties?: MappingProperties
}

abstract class ColumnMapping {
    constructor(readonly columnName: string, readonly cslDataType?: string, readonly Properties?: MappingProperties) {
    }

    public abstract mappingType(): IngestionMappingType;

    public toApiMapping(): ApiColumnMapping {
        return {
            Column: this.columnName,
            DataType: this.cslDataType,
            Properties: this.Properties
        };
    }
}

export class CsvColumnMapping extends ColumnMapping {
    /**
     * @deprecated Use the factory methods instead.
     */
    protected constructor(readonly columnName: string, readonly cslDataType?: string, readonly ordinal?: string, constantValue?: string) {
        super(columnName, cslDataType, { Ordinal: ordinal, ConstantValue: constantValue });
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
    constructor(readonly columnName: string, readonly jsonPath?: string, cslDataType: string | null = null, constantValue?: string, transform?: string) {
        super(columnName, cslDataType ?? undefined, { Path: jsonPath, ConstantValue: constantValue, Transform: transform });
    }

    public static withPath(columnName: string, path: string, cslDataType?: string, transform?: string): JsonColumnMapping {
        return new JsonColumnMapping(columnName, path, cslDataType, transform);
    }

    public static withConstantValue(columnName: string, constantValue: string, cslDataType?: string): JsonColumnMapping {
        return new JsonColumnMapping(columnName, undefined, cslDataType, constantValue);
    }

    public static withTransform(columnName: string, transform: string, cslDataType?: string): JsonColumnMapping {
        return new JsonColumnMapping(columnName, undefined, cslDataType, undefined, transform);
    }

    mappingType = (): IngestionMappingType => IngestionMappingType.JSON;
}

export class AvroColumnMapping extends ColumnMapping {
    private constructor(readonly columnName: string, cslDataType?: string, path?: string, field?: string, constantValue?: string, transform?: string) {
        super(columnName, cslDataType ?? undefined, { Path: path, Field: field, ConstantValue: constantValue, Transform: transform });
    }

    public static withPath(columnName: string, path: string, cslDataType?: string, transform?: string): AvroColumnMapping {
        return new AvroColumnMapping(columnName, cslDataType, path, undefined, transform);
    }

    public static withField(columnName: string, field: string, cslDataType?: string, transform?: string): AvroColumnMapping {
        return new AvroColumnMapping(columnName, cslDataType, undefined, field, transform);
    }

    public static withConstantValue(columnName: string, constantValue: string, cslDataType?: string): AvroColumnMapping {
        return new AvroColumnMapping(columnName, cslDataType, undefined, undefined, constantValue);
    }

    public static withTransform(columnName: string, transform: string, cslDataType?: string): AvroColumnMapping {
        return new AvroColumnMapping(columnName, cslDataType, undefined, undefined, undefined, transform);
    }

    mappingType = (): IngestionMappingType => IngestionMappingType.AVRO;
}

export class ParquetColumnMapping extends ColumnMapping {
    private constructor(readonly columnName: string, cslDataType?: string, path?: string, field?: string, constantValue?: string, transform?: string) {
        super(columnName, cslDataType ?? undefined, { Path: path, Field: field, ConstantValue: constantValue, Transform: transform });
    }

    public static withPath(columnName: string, path: string, cslDataType?: string, transform?: string): ParquetColumnMapping {
        return new ParquetColumnMapping(columnName, cslDataType, path, undefined, transform);
    }

    public static withField(columnName: string, field: string, cslDataType?: string, transform?: string): ParquetColumnMapping {
        return new ParquetColumnMapping(columnName, cslDataType, undefined, field, transform);
    }

    public static withConstantValue(columnName: string, constantValue: string, cslDataType?: string): ParquetColumnMapping {
        return new ParquetColumnMapping(columnName, cslDataType, undefined, undefined, constantValue);
    }

    public static withTransform(columnName: string, transform: string, cslDataType?: string): ParquetColumnMapping {
        return new ParquetColumnMapping(columnName, cslDataType, undefined, undefined, undefined, transform);
    }

    mappingType = (): IngestionMappingType => IngestionMappingType.PARQUET;
}

export class OrcColumnMapping extends ColumnMapping {
    private constructor(readonly columnName: string, cslDataType?: string, path?: string, field?: string, constantValue?: string, transform?: string) {
        super(columnName, cslDataType ?? undefined, { Path: path, Field: field, ConstantValue: constantValue, Transform: transform });
    }

    public static withPath(columnName: string, path: string, cslDataType?: string, transform?: string): OrcColumnMapping {
        return new OrcColumnMapping(columnName, cslDataType, path, undefined, transform);
    }

    public static withField(columnName: string, field: string, cslDataType?: string, transform?: string): OrcColumnMapping {
        return new OrcColumnMapping(columnName, cslDataType, undefined, field, transform);
    }

    public static withConstantValue(columnName: string, constantValue: string, cslDataType?: string): OrcColumnMapping {
        return new OrcColumnMapping(columnName, cslDataType, undefined, undefined, constantValue);
    }

    public static withTransform(columnName: string, transform: string, cslDataType?: string): OrcColumnMapping {
        return new OrcColumnMapping(columnName, cslDataType, undefined, undefined, undefined, transform);
    }

    mappingType = (): IngestionMappingType => IngestionMappingType.ORC;
}

export class W3CLogFileMapping extends ColumnMapping {
    private constructor(readonly columnName: string, cslDataType?: string, field?: string, constantValue?: string, transform?: string) {
        super(columnName, cslDataType ?? undefined, { Field: field, ConstantValue: constantValue, Transform: transform });
    }

    public static withField(columnName: string, field: string, cslDataType?: string, transform?: string): W3CLogFileMapping {
        return new W3CLogFileMapping(columnName, cslDataType, field, transform);
    }

    public static withConstantValue(columnName: string, constantValue: string, cslDataType?: string): W3CLogFileMapping {
        return new W3CLogFileMapping(columnName, cslDataType, undefined, constantValue);
    }

    public static withTransform(columnName: string, transform: string, cslDataType?: string): W3CLogFileMapping {
        return new W3CLogFileMapping(columnName, cslDataType, undefined, undefined, transform);
    }

    mappingType = (): IngestionMappingType => IngestionMappingType.ORC;
}


class IngestionPropertiesFields {
    database?: string | null = null;
    table?: string | null = null;
    format?: string | null = null;
    ingestionMapping?: ColumnMapping[] | null = null;
    ingestionMappingReference?: string | null = null;
    ingestionMappingType?: string | null = null;
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