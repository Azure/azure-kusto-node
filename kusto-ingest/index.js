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
    DataFormat
} = require("./source/IngestionProperties");

module.exports = {
    IngestClient: client,
    IngestStatusQueues: KustoIngestStatusQueues,
    IngestionProperties,
    IngestionPropertiesEnums: {
        JsonColumnMapping,
        CsvColumnMapping,
        ValidationPolicy,
        ReportLevel,
        ReportMethod,
        ValidationImplications,
        ValidationOptions,
        DataFormat
    }
};
