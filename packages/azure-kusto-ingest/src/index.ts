// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import KustoIngestClient from "./ingestClient.js";

import streamingIngestClient from "./streamingIngestClient.js";

import managedStreamingIngestClient from "./managedStreamingIngestClient.js";

import KustoIngestStatusQueues from "./status.js";

import { type IngestionResult, OperationStatus, type IngestionStatus, IngestionStatusInTableDescription } from "./ingestionResult.js";
import {
    DataFormat,
    IngestionMappingKind,
    ReportLevel,
    ReportMethod,
    ValidationImplications,
    ValidationOptions,
    ValidationPolicy,
    dataFormatMappingKind,
} from "./ingestionProperties.js";

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
} from "./columnMappings.js";
import { BlobDescriptor, CompressionType, StreamDescriptor } from "./descriptors.js";
import { FileDescriptor } from "./fileDescriptor.js";

export type { Transformation as ColumnMappingTransformation } from "./columnMappings.js";
export { IngestionProperties } from "./ingestionProperties.js";
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
    type IngestionResult,
    OperationStatus,
    type IngestionStatus,
    IngestionStatusInTableDescription,
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

export { IngestionPropertiesValidationError } from "./errors.js";
// eslint-disable-next-line no-console
