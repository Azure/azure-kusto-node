// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import KustoIngestClient from "./ingestClient";

import streamingIngestClient from "./streamingIngestClient";

import managedStreamingIngestClient from "./managedStreamingIngestClient";

import KustoIngestStatusQueues from "./status";

import {
    IngestionResult,
    OperationStatus,
    IngestionStatus,
    IngestionStatusInTableDescription
} from "./ingestionResult"
import {
    DataFormat,
    IngestionMappingKind,
    ReportLevel,
    ReportMethod,
    ValidationImplications,
    ValidationOptions,
    ValidationPolicy,
    dataFormatMappingKind,
} from "./ingestionProperties";

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
import { BlobDescriptor, CompressionType, StreamDescriptor } from "./descriptors";
import { FileDescriptor } from "./fileDescriptor";

export { Transformation as ColumnMappingTransformation } from "./columnMappings";
export { IngestionProperties } from "./ingestionProperties";
export {
    KustoIngestClient as IngestClient,
    KustoIngestStatusQueues as IngestStatusQueues,
    managedStreamingIngestClient as ManagedStreamingIngestClient,
    streamingIngestClient as StreamingIngestClient,
};

/**
 * @deprecated - import directly instead. Export const is not exporting type.
 */
export const IngestionDescriptors = {
    BlobDescriptor,
    FileDescriptor,
    StreamDescriptor,
};

export {
    ApacheAvroColumnMapping,
    AvroColumnMapping,
    BlobDescriptor,
    ColumnMapping,
    CompressionType,
    ConstantTransformation,
    CsvColumnMapping,
    DataFormat,
    FieldTransformation,
    FileDescriptor,
    IngestionMappingKind,
    JsonColumnMapping,
    OrcColumnMapping,
    ParquetColumnMapping,
    ReportLevel,
    ReportMethod,
    SStreamColumnMapping,
    StreamDescriptor,
    ValidationImplications,
    ValidationOptions,
    ValidationPolicy,
    W3CLogFileMapping,
    dataFormatMappingKind,
    IngestionResult,
    OperationStatus,
    IngestionStatus,
    IngestionStatusInTableDescription
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
    ColumnMapping
};

export { IngestionPropertiesValidationError } from "./errors";
// eslint-disable-next-line no-console
