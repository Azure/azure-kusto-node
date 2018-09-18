const client = require("./src/ingestClient");
const IngestStatusQueue = require("./src/statusQ");
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
} = require("./src/IngestionProperties");

module.exports = {
    IngestClient: client,
    IngestStatusQueue,
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
