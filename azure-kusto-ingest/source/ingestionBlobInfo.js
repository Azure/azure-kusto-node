// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const uuidv4 = require("uuid/v4");
const moment = require("moment");

module.exports = class IngestionBlobInfo {
    constructor(blobDescriptor, ingestionProperties, authContext) {
        this.BlobPath = blobDescriptor.path;
        this.RawDataSize = blobDescriptor.size;
        this.DatabaseName = ingestionProperties.database;
        this.TableName = ingestionProperties.table;
        this.RetainBlobOnSuccess = true;
        this.FlushImmediately = !!ingestionProperties.flushImmediately;
        this.IgnoreSizeLimit = false;
        this.ReportLevel = ingestionProperties.reportLevel;
        this.ReportMethod = ingestionProperties.reportMethod;
        this.SourceMessageCreationTime = moment.utc();
        this.Id = blobDescriptor.sourceId || uuidv4();

        const additionalProperties = ingestionProperties.additionalProperties || {};
        additionalProperties.authorizationContext = authContext;

        const tags = [];
        if (ingestionProperties.additionalTags) {
            tags.concat(ingestionProperties.additionalTags);
        }
        if (ingestionProperties.dropByTags) {
            tags.concat(ingestionProperties.dropByTags.map(t => "drop-by:" + t));
        }
        if (ingestionProperties.ingestByTags) {
            tags.concat(ingestionProperties.ingestByTags.map(t => "ingest-by:" + t));
        }

        if (tags && tags.length > 0) {
            additionalProperties.tags = tags;
        }

        if (ingestionProperties.ingestIfNotExists) {
            additionalProperties.ingestIfNotExists = ingestionProperties.ingestIfNotExists;
        }

        if (ingestionProperties.ingestionMapping && ingestionProperties.ingestionMapping.length > 0) {
            // server expects a string
            additionalProperties["ingestionMapping"] = JSON.stringify(ingestionProperties.ingestionMapping);
        }

        if (ingestionProperties.ingestionMappingReference) {
            additionalProperties["ingestionMappingReference"] = ingestionProperties.ingestionMappingReference;
        }

        if (ingestionProperties.validationPolicy) {
            additionalProperties.ValidationPolicy = ingestionProperties.validationPolicy;
        }

        if (ingestionProperties.format) {
            additionalProperties.format = ingestionProperties.format;
        }

        this.AdditionalProperties = additionalProperties;
    }
};
