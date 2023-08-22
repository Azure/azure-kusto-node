// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
export const GetTakeQuery = (query: string, count: number) => {
    return `${query} | take ${count}`;
};

export const GetAlterBatchingPolicyCommand = (table: string, batchingPolicy: string) => {
    return `.alter table ${table} policy ingestionbatching @"${batchingPolicy}"`;
};

export const GetCreateOrAlterTable = (table: string, ingestionMappingKind: string, mappingName: string, mappingValue: string) => {
    return `.create-or-alter table ${table} ingestion ${ingestionMappingKind.toLowerCase()} mapping '${mappingName}' '${mappingValue}'`;
};

export const GetRefreshPolicyCommand = (table: string, database: string) => {
    return `.refresh database '${database}' table '${table}' cache ingestionbatchingpolicy`;
}