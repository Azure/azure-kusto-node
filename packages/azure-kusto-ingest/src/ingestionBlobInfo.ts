// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { v4 as uuidv4 } from "uuid";
import { BlobDescriptor } from "./descriptors";
import IngestionProperties, { ReportLevel, ReportMethod } from "./ingestionProperties";
import { IngestionStatusInTableDescription } from "./ingestionResult";

export class IngestionBlobInfo {
    BlobPath: string;
    RawDataSize: number | null;
    DatabaseName: string | null;
    TableName: string | null;
    RetainBlobOnSuccess: boolean;
    FlushImmediately: boolean;
    IgnoreSizeLimit: boolean;
    ReportLevel: ReportLevel | null;
    ReportMethod: ReportMethod | null;
    SourceMessageCreationTime: Date;
    Id: string;
    AdditionalProperties: { [additional: string]: any };
    IngestionStatusInTable: IngestionStatusInTableDescription | null = null;
    ApplicationForTracing?: string | null = null;
    ClientVersionForTracing?: string | null = null;

    constructor(blobDescriptor: BlobDescriptor, ingestionProperties: IngestionProperties, authContext: string | null = null) {
        this.BlobPath = blobDescriptor.path;
        this.RawDataSize = blobDescriptor.size;
        this.DatabaseName = ingestionProperties.database ?? null;
        this.TableName = ingestionProperties.table ?? null;
        this.RetainBlobOnSuccess = true;
        this.FlushImmediately = ingestionProperties.flushImmediately ?? false;
        this.IgnoreSizeLimit = false;
        this.ReportLevel = ingestionProperties.reportLevel ?? null;
        this.ReportMethod = ingestionProperties.reportMethod ?? null;
        this.SourceMessageCreationTime = new Date();
        this.Id = blobDescriptor.sourceId || uuidv4();
        this.ApplicationForTracing = ingestionProperties.applicationForTracing;
        this.ClientVersionForTracing = ingestionProperties.clientVersionForTracing;

        const additionalProperties = ingestionProperties.additionalProperties || {};
        additionalProperties.authorizationContext = authContext;

        const tags: string[] = [];
        if (ingestionProperties.additionalTags) {
            tags.concat(ingestionProperties.additionalTags);
        }
        if (ingestionProperties.dropByTags) {
            tags.concat(ingestionProperties.dropByTags.map((t) => "drop-by:" + t));
        }
        if (ingestionProperties.ingestByTags) {
            tags.concat(ingestionProperties.ingestByTags.map((t) => "ingest-by:" + t));
        }

        if (tags && tags.length > 0) {
            additionalProperties.tags = tags;
        }

        if (ingestionProperties.ingestIfNotExists) {
            additionalProperties.ingestIfNotExists = ingestionProperties.ingestIfNotExists;
        }

        if (ingestionProperties.ingestionMappingColumns && ingestionProperties.ingestionMappingColumns.length > 0) {
            // server expects a string
            additionalProperties.ingestionMapping = JSON.stringify(ingestionProperties.ingestionMappingColumns.map((m) => m.toApiMapping()));
        }

        if (ingestionProperties.ingestionMappingReference) {
            additionalProperties.ingestionMappingReference = ingestionProperties.ingestionMappingReference;
        }

        if (ingestionProperties.ingestionMappingKind) {
            additionalProperties.ingestionMappingType = ingestionProperties.ingestionMappingKind;
        }

        if (ingestionProperties.validationPolicy) {
            additionalProperties.ValidationPolicy = ingestionProperties.validationPolicy;
        }

        if (ingestionProperties.format) {
            additionalProperties.format = ingestionProperties.format;
        }
        if (ingestionProperties.ignoreFirstRecord) {
            additionalProperties.ignoreFirstRecord = ingestionProperties.ignoreFirstRecord;
        }

        this.AdditionalProperties = additionalProperties;
    }
}

export default IngestionBlobInfo;
