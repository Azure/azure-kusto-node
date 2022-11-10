// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import client from "./ingestClient";

import streamingIngestClient from "./streamingIngestClient";

import managedStreamingIngestClient from "./managedStreamingIngestClient";

import KustoIngestStatusQueues from "./status";

import {
    DataFormat,
    IngestionMappingKind,
    ReportLevel,
    ReportMethod,
    ValidationImplications,
    ValidationOptions,
    ValidationPolicy,
} from "./ingestionProperties";

import { BlobDescriptor, CompressionType, StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor";
import {
    ApacheAvroColumnMapping,
    AvroColumnMapping,
    ColumnMapping,
    ConstantTransformation,
    CsvColumnMapping,
    FieldTransformation,
    JsonColumnMapping,
    OrcColumnMapping,
    ParquetColumnMapping,
    SStreamColumnMapping,
    W3CLogFileMapping,
} from "./columnMappings";

export { Transformation as ColumnMappingTransformation } from "./columnMappings";

export const IngestClient = client;
export const StreamingIngestClient = streamingIngestClient;
export const ManagedStreamingIngestClient = managedStreamingIngestClient;
export const IngestStatusQueues = KustoIngestStatusQueues;
export { IngestionProperties } from "./ingestionProperties";
export const IngestionDescriptors = {
    BlobDescriptor,
    FileDescriptor,
    StreamDescriptor,
};

export {
    JsonColumnMapping,
    CsvColumnMapping,
    AvroColumnMapping,
    ParquetColumnMapping,
    OrcColumnMapping,
    W3CLogFileMapping,
    ValidationPolicy,
    ReportLevel,
    ReportMethod,
    ValidationImplications,
    ValidationOptions,
    DataFormat,
    IngestionMappingKind,
    CompressionType,
    ApacheAvroColumnMapping,
    SStreamColumnMapping,
    ConstantTransformation,
    FieldTransformation,
    ColumnMapping,
};

/**
 * @deprecated - import directly instead
 */
export const IngestionPropertiesEnums = {
    JsonColumnMapping,
    CsvColumnMapping,
    AvroColumnMapping,
    ParquetColumnMapping,
    OrcColumnMapping,
    W3CLogFileMapping,
    ValidationPolicy,
    ReportLevel,
    ReportMethod,
    ValidationImplications,
    ValidationOptions,
    DataFormat,
    /**
     * @deprecated - use IngestionMappingKind instead
     */
    IngestionMappingType: IngestionMappingKind,
    IngestionMappingKind,
    CompressionType,
    ApacheAvroColumnMapping,
    SStreamColumnMapping,
    ConstantTransformation,
    FieldTransformation,
    ColumnMapping,
};

export { IngestionPropertiesValidationError } from "./errors";

import {KustoConnectionStringBuilder} from "azure-kusto-data"
import {Client} from "azure-kusto-data"
const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication("https://devdevon.westeurope.dev.kusto.windows.net","a","b","C");
const cli = new Client(kcsb);
cli.execute("fast","TestTable2").then(resp=>console.log(resp)).catch(e=>console.log(e))
