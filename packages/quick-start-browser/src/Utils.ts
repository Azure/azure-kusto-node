// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { DataFormat } from "azure-kusto-ingest";

export const dataFormatMappingKind = (dataFormat: DataFormat): any => {
    switch (dataFormat.toLowerCase()) {
        case DataFormat.JSON:
            return "Json";
        case DataFormat.SINGLEJSON:
            return "Json";
        case DataFormat.MULTIJSON:
            return "Json";
        case DataFormat.AVRO:
            return "Avro";
        case DataFormat.PARQUET:
            return "Parquet";
        case DataFormat.SSTREAM:
            return "Sstream";
        case DataFormat.ORC:
            return "Orc";
        case DataFormat.APACHEAVRO:
            return "ApacheAvro";
        case DataFormat.W3CLogFile:
            return "W3CLogFile";
        default:
            return "Csv";
    }
};
