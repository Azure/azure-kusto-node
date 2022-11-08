// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import client from "./src/ingestClient";

import streamingIngestClient from "./src/streamingIngestClient";

import managedStreamingIngestClient from "./src/managedStreamingIngestClient";

import KustoIngestStatusQueues from "./src/status";

import {
    DataFormat,
    IngestionMappingKind,
    ReportLevel,
    ReportMethod,
    ValidationImplications,
    ValidationOptions,
    ValidationPolicy,
} from "./src/ingestionProperties";

import { BlobDescriptor, CompressionType, StreamDescriptor } from "./src/descriptors";
import { FileDescriptor } from "./src/fileDescriptor";
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
} from "./src/columnMappings";

export { Transformation as ColumnMappingTransformation } from "./src/columnMappings";

export const IngestClient = client;
export const StreamingIngestClient = streamingIngestClient;
export const ManagedStreamingIngestClient = managedStreamingIngestClient;
export const IngestStatusQueues = KustoIngestStatusQueues;
export { IngestionProperties } from "./src/ingestionProperties";
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

export { IngestionPropertiesValidationError } from "./src/errors";
