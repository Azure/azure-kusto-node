const uuidv4 = require("uuidv4");
const moment = require("moment");

module.exports = class IngestionBlobInfo {
    constructor(blob, ingestionProperties, authContext) {
        this.properties = {};
        this.properties.BlobPath = blob.path;
        this.properties.RawDataSize = blob.size;
        this.properties.DatabaseName = ingestionProperties.database;
        this.properties.TableName = ingestionProperties.table;
        this.properties.RetainBlobOnSuccess = true;
        this.properties.FlushImmediately = ingestionProperties.flushdImmediately;
        this.properties.IgnoreSizeLimit = false;
        this.properties.ReportLevel = ingestionProperties.reportLevel.value;
        this.properties.ReportMethod = ingestionProperties.report_method.value;
        this.properties.SourceMessageCreationTime = moment.utc();
        this.properties.Id = uuidv4();

        let additionalProperties = ingestionProperties.additionalProperties || {};
        additionalProperties.authorizationContext = authContext;

        let tags = [];
        if (ingestionProperties.additionalTags) {
            tags.concat(ingestionProperties.additionalTags);
        }
        if (ingestionProperties.dropByTags) {
            tags.concat(ingestionProperties.dropByTags.map(t => "drop-by:" + t));
        }
        if (ingestionProperties.ingestByTags) {
            tags.concat(ingestionProperties.ingestByTags.map(t => "ingest-by:" + t));
        }

        additionalProperties.tage = tags;
        additionalProperties.ingestIfNotExists = ingestionProperties.ingestdIfNotExists;
        additionalProperties[ingestionProperties.getMappingFormat() + "Mapping"] = ingestionProperties.mapping;
        additionalProperties[ingestionProperties.getMappingFormat() + "MappingReference"] = ingestionProperties.mappingReference;
        additionalProperties.ValidationPolicy = ingestionProperties.validationPolicy;
        additionalProperties.format = ingestionProperties.format.name;
        
        this.properties.AdditionalProperties = additionalProperties;
    }

    toJson() {
        return JSON.stringify(this.properties);
    }
};
