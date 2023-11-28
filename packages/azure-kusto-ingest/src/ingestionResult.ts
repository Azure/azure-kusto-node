// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { v4 as uuidv4 } from "uuid";
import { StatusMessage } from "./status";
import { TableClient, TableEntity } from "@azure/data-tables";
import { ExponentialRetry } from "./retry";
export interface IngestionResult
{
    /// <summary>
    /// Retrieves the detailed ingestion status of the
    /// ingestion source with the given sourceId.
    /// </summary>
    // GetIngestionStatusBySourceId(sourceId: string): IngestionStatus;

    /// <summary>
    /// Retrieves the detailed ingestion status of
    /// all data ingestion operations into Kusto associated with this IKustoIngestionResult instance.
    /// </summary>
    getIngestionStatusCollection() : Promise<IngestionStatus>;
}

export const putRecordInTable = async (
    tableClient: TableClient,
    database: string,
    blobPath: string,
    table: string,
    partitionKey: string,
    rowKey: string,
    error?: string
): Promise<void> => {
    const status = error !== undefined ? 'Failed' : 'Pending';
    const blobBasePath = blobPath.split(/[?;]/)[0];
    const timestamp = Date.now();
    const entity: TableEntity<IngestionStatus> = {
        partitionKey,
        rowKey,
        Timestamp: timestamp.toString(),
        Status: status,
        IngestionSourceId: rowKey,
        IngestionSourcePath: blobBasePath,
        Database: database,
        Table: table,
        UpdatedOn: timestamp.toString(),
        Details: error || '',
    };
    const retry = new ExponentialRetry(3, 1, 1);
    while (retry.shouldTry()) {
        try {
            await tableClient.createEntity(entity);
        } catch (ex) {
            await retry.backoff();
        }
    }
   
} 
export type OperationStatus = "Pending" | "Succeeded" | "Failed" | "Queued" | "Skipped" |"PartiallySucceeded"

export class TableReportIngestionResult implements IngestionResult {
    tableClient: TableClient;
    
    public constructor(private ingestionStatusInTableDescription: IngestionStatusInTableDescription) {
        this.tableClient = this.clientFromSas(ingestionStatusInTableDescription.tableConnectionString)
    }
  
    public async getIngestionStatusCollection(): Promise<IngestionStatus> {
            const t =  await this.tableClient.getEntity(this.ingestionStatusInTableDescription.partitionKey,this.ingestionStatusInTableDescription.rowKey);
            return t as unknown as IngestionStatus;
    }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.



export class IngestionStatusInTableDescription {
	constructor(public tableConnectionString: string, public partitionKey: string, public rowKey: string){

    }
}

export interface IngestionStatus {
    Timestamp: string;
    Status: OperationStatus;
    IngestionSourceId: string;
    IngestionSourcePath: string;
    Database: string;
    Table: string;
    UpdatedOn: string;
    Details: string;
}

/// <summary>
/// This class represents an ingestion status.
/// </summary>
/// <remarks>
/// Any change to this class must be made in a backwards/forwards-compatible manner.
/// </remarks>
// public class IngestionStatus {
//     /// <summary>
//     /// The updated status of the ingestion. The ingestion status will be 'Pending'
//     /// during the ingestion's process
//     /// and will be updated as soon as the ingestion completes.
//     /// </summary>
//     public OperationStatus status;
//     private Map<String, Object> ingestionInfo = new HashMap<>();

//     public String getStatus() {
//         return status.toString();
//     }

//     public void setStatus(String s) {
//         if (s != null) {
//             setStatus(OperationStatus.valueOf(s));
//         }
//     }

//     public void setStatus(OperationStatus st) {
//         status = st;
//         ingestionInfo.put("Status", st);
//     }

//     /// <summary>
//     /// A unique identifier representing the ingested source. Can be supplied during
//     /// the ingestion execution.
//     /// </summary>
//     public UUID ingestionSourceId;

//     public UUID getIngestionSourceId() {
//         return ingestionSourceId;
//     }

//     public void setIngestionSourceId(UUID id) {
//         ingestionSourceId = id;
//         ingestionInfo.put("IngestionSourceId", id);
//     }

//     /// <summary>
//     /// The URI of the blob, potentially including the secret needed to access
//     /// the blob. This can be a file system URI (on-premises deployments only),
//     /// or an Azure Blob Storage URI (including a SAS key or a semicolon followed
//     /// by the account key)
//     /// </summary>
//     public String ingestionSourcePath;

//     public String getIngestionSourcePath() {
//         return ingestionSourcePath;
//     }

//     public void setIngestionSourcePath(String path) {
//         ingestionSourcePath = path;
//         ingestionInfo.put("IngestionSourcePath", ingestionSourcePath);
//     }

//     /// <summary>
//     /// The name of the database holding the target table.
//     /// </summary>
//     public String database;

//     public String getDatabase() {
//         return database;
//     }

//     public void setDatabase(String db) {
//         database = db;
//         ingestionInfo.put("Database", database);
//     }

//     /// <summary>
//     /// The name of the target table into which the data will be ingested.
//     /// </summary>
//     public String table;

//     public String getTable() {
//         return table;
//     }

//     public void setTable(String t) {
//         table = t;
//         ingestionInfo.put("Table", table);
//     }

//     /// <summary>
//     /// The last updated time of the ingestion status.
//     /// </summary>
//     public Instant updatedOn;

//     public Instant getUpdatedOn() {
//         return updatedOn;
//     }

//     public void setUpdatedOn(Instant lastUpdated) {
//         updatedOn = lastUpdated;
//         ingestionInfo.put("UpdatedOn", updatedOn);
//     }

//     /// <summary>
//     /// The ingestion's operation Id.
//     /// </summary>
//     public UUID operationId;

//     public UUID getOperationId() {
//         return operationId;
//     }

//     public void setOperationId(UUID id) {
//         operationId = id;
//     }

//     /// <summary>
//     /// The ingestion's activity Id.
//     /// </summary>
//     public UUID activityId;

//     public UUID getActivityId() {
//         return activityId;
//     }

//     public void setActivityId(UUID id) {
//         activityId = id;
//     }

//     public String errorCodeString;

//     /// <summary>
//     /// In case of a failure - indicates the failure's error code. TODO: Deprecate next major version
//     /// </summary>
//     public IngestionErrorCode errorCode;

//     public String getErrorCode() {
//         return errorCodeString;
//     }

//     public void setErrorCode(String code) {
//         errorCodeString = code;
//         try {
//             errorCode = code == null ? IngestionErrorCode.Unknown : IngestionErrorCode.valueOf(code);
//         } catch (IllegalArgumentException ex) {
//             errorCode = IngestionErrorCode.Misc;
//         }
//     }

//     /// <summary>
//     /// In case of a failure - indicates the failure's status.
//     /// </summary>
//     public IngestionFailureInfo.FailureStatusValue failureStatus;

//     public String getFailureStatus() {
//         return (failureStatus != null ? failureStatus : IngestionFailureInfo.FailureStatusValue.Unknown).toString();
//     }

//     public void setFailureStatus(String status) {
//         if (status != null) {
//             failureStatus = IngestionFailureInfo.FailureStatusValue.valueOf(status);
//         }
//     }

//     /// <summary>
//     /// In case of a failure - indicates the failure's details.
//     /// </summary>
//     public String details;

//     public String getDetails() {
//         return details;
//     }

//     public void setDetails(String d) {
//         details = d;
//     }

//     /// <summary>
//     /// In case of a failure - indicates whether or not the failures originate from
//     /// an Update Policy.
//     /// </summary>
//     public boolean originatesFromUpdatePolicy;

//     public boolean getOriginatesFromUpdatePolicy() {
//         return originatesFromUpdatePolicy;
//     }

//     public void setOriginatesFromUpdatePolicy(boolean fromUpdatePolicy) {
//         originatesFromUpdatePolicy = fromUpdatePolicy;
//     }

//     public IngestionStatus() {
//     }

//     public Map<String, Object> getEntityProperties() {
//         return ingestionInfo;
//     }

//     public static IngestionStatus fromEntity(TableEntity tableEntity) {
//         IngestionStatus ingestionStatus = new IngestionStatus();
//         Object ingestionSourceId = tableEntity.getProperty("IngestionSourceId");
//         ingestionStatus.setIngestionSourceId(ingestionSourceId == null ? null : (UUID) ingestionSourceId);

//         ingestionStatus.setDatabase((String) tableEntity.getProperty("Database"));
//         ingestionStatus.setTable((String) tableEntity.getProperty("Table"));

//         Object operationId = tableEntity.getProperty("OperationId");
//         ingestionStatus.setOperationId(ingestionSourceId == null ? null : (UUID) operationId);

//         Object status = tableEntity.getProperty("Status");
//         if (status instanceof String) {
//             ingestionStatus.setStatus((String) status);
//         } else {
//             ingestionStatus.setStatus((OperationStatus) status);
//         }

//         Object activityId = tableEntity.getProperty("ActivityId");
//         ingestionStatus.setActivityId(ingestionSourceId == null ? null : (UUID) activityId);

//         ingestionStatus.setFailureStatus((String) tableEntity.getProperty("FailureStatus"));

//         Object originatesFromUpdatePolicy = tableEntity.getProperty("OriginatesFromUpdatePolicy");
//         ingestionStatus.setOriginatesFromUpdatePolicy(originatesFromUpdatePolicy != null && (boolean) originatesFromUpdatePolicy);
//         ingestionStatus.setIngestionSourcePath((String) tableEntity.getProperty("IngestionSourcePath"));

//         Object errorCode = tableEntity.getProperty("ErrorCode");
//         if (errorCode != null) {
//             ingestionStatus.setErrorCode((String) errorCode);
//         }

//         ingestionStatus.setDetails((String) tableEntity.getProperty("Details"));

//         Object updatedOn = tableEntity.getProperty("UpdatedOn");
//         if (updatedOn instanceof OffsetDateTime) {
//             ingestionStatus.setUpdatedOn(((OffsetDateTime) updatedOn).toInstant());
//         } else {
//             ingestionStatus.setUpdatedOn((Instant) updatedOn);
//         }

//         return ingestionStatus;
//     }
// }
