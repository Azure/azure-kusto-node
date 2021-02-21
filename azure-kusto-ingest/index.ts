// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import client from "./source/ingestClient";

import streamingIngestClient from "./source/streamingIngestClient";

import KustoIngestStatusQueues from "./source/status";

import {
    CsvColumnMapping, DataFormat, IngestionMappingType,
    JsonColumnMapping,
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
export const IngestStatusQueues = KustoIngestStatusQueues;
export {IngestionProperties} from "./source/ingestionProperties"
export const IngestionDescriptors = {
    BlobDescriptor,
    FileDescriptor,
    StreamDescriptor
};
export const IngestionPropertiesEnums = {
    JsonColumnMapping,
    CsvColumnMapping,
    ValidationPolicy,
    ReportLevel,
    ReportMethod,
    ValidationImplications,
    ValidationOptions,
    DataFormat,
    IngestionMappingType,
    CompressionType
};
