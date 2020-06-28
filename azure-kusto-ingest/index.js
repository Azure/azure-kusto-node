// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const client = require("./source/ingestClient");
const streamingIngestClient = require("./source/streamingIngestClient");
const KustoIngestStatusQueues = require("./source/status");
const {
    IngestionProperties,
    JsonColumnMapping,
    CsvColumnMapping,
    ValidationPolicy,
    ReportLevel,
    ReportMethod,
    ValidationImplications,
    ValidationOptions,
    DataFormat,
    IngestionMappingType
} = require("./source/ingestionProperties");

const {
    BlobDescriptor,
    FileDescriptor,
    StreamDescriptor,
    CompressionType
} = require("./source/descriptors");

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
