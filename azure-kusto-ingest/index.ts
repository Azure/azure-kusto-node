// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import client from "./source/ingestClient";

import streamingIngestClient from "./source/streamingIngestClient";

import KustoIngestStatusQueues from "./source/status";

import {
    CsvColumnMapping, DataFormat, IngestionMappingType,
    IngestionProperties,
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


module.exports = {
    IngestClient: client,
    StreamingIngestClient: streamingIngestClient,
    IngestStatusQueues: KustoIngestStatusQueues,
    IngestionProperties,
    IngestionDescriptors: {
        BlobDescriptor,
        FileDescriptor,
        StreamDescriptor
    },
    IngestionPropertiesEnums: {
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
    }
};
