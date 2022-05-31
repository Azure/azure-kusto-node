// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

interface ConfigData {
    sourceType: string;
    dataSourceUri: string;
    format: string;
    useExistingMapping: boolean;
    mappingName: string;
    mappingValue: string;
}

interface ConfigJson {
    kustoUri: string;
    ingestUri: string;
    databaseName: string;
    tableName: string;
    useExistingTable: boolean;
    alterTable: boolean;
    queryData: boolean;
    ingestData: boolean;
    tableSchema: string;
    data: ConfigData[];
    CertificatePath: string;
    CertificatePassword: string;
    ApplicationId: string;
    TenantId: string;
}

// TODO (config):
//  If this quickstart app was downloaded from OneClick, kusto_sample_config.json should be pre-populated with your cluster's details.
//  If this quickstart app was downloaded from GitHub, edit kusto_sample_config.json and modify the cluster URL and database fields appropriately.
const CONFIG_FILE_NAME = "packages/quick_start/source/kusto_sample_config.json";

class SampleApp {
    private static step = 1;

}