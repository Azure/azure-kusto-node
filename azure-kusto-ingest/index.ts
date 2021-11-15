// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import client from "./source/ingestClient";

import streamingIngestClient from "./source/streamingIngestClient";

import managedStreamingIngestClient from "./source/managedStreamingIngestClient";

import KustoIngestStatusQueues from "./source/status";

import {
    AvroColumnMapping, CsvColumnMapping, JsonColumnMapping, ParquetColumnMapping, OrcColumnMapping, W3CLogFileMapping,
    DataFormat, IngestionMappingType,
    ReportLevel,
    ReportMethod,
    ValidationImplications,
    ValidationOptions,
    ValidationPolicy
} from "./source/ingestionProperties";


import {
    BlobDescriptor,
    CompressionType,
    FileDescriptor,
    StreamDescriptor
} from "./source/descriptors";

export const IngestClient = client;
export const StreamingIngestClient = streamingIngestClient;
export const ManagedStreamingIngestClient = managedStreamingIngestClient;
export const IngestStatusQueues = KustoIngestStatusQueues;
export { IngestionProperties } from "./source/ingestionProperties"
export const IngestionDescriptors = {
    BlobDescriptor,
    FileDescriptor,
    StreamDescriptor
};
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
    IngestionMappingType,
    CompressionType
};
