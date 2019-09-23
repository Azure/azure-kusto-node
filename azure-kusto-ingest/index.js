const client = require("./source/ingestClient");
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
    StreamDescriptor
} = require("./source/descriptors");

module.exports = {
    IngestClient: client,
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
        IngestionMappingType
    }
};
