// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import fs from "fs";
import Utils, { Authentication, Ingestion, Queries } from "./Utils";
import Console from "console";
import KustoClient from "azure-kusto-data/src/client";
import IngestClient, { KustoIngestClient } from "azure-kusto-ingest/src/ingestClient";
import { DataFormat } from "azure-kusto-ingest";
import readline from "readline";
import { dataFormatMappingKind } from "azure-kusto-ingest/src/ingestionProperties";
import { v4 as uuidv4 } from "uuid";

enum SourceType {
    LocalFileSource = "localfilesource",
    BlobSource = "blobsource",
}

export enum AuthenticationModeOptions {
    UserPrompt = "UserPrompt",
    ManagedIdentity = "ManagedIdentity",
    AppKey = "AppKey",
    AppCertificate = "AppCertificate",
}

interface ConfigData {
    sourceType: SourceType;
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
    certificatePath: string;
    certificatePassword: string;
    applicationId: string;
    tenantId: string;
    authenticationMode: AuthenticationModeOptions;
    waitForUser: boolean;
    ignoreFirstRecord: boolean;
    waitForIngestSeconds: number;
    batchingPolicy: string;
}

// TODO (config):
//  If this quickstart app was downloaded from OneClick, kusto_sample_config.json should be pre-populated with your cluster's details.
//  If this quickstart app was downloaded from GitHub, edit kusto_sample_config.json and modify the cluster URL and database fields appropriately.
const CONFIG_FILE_NAME = "source/kusto_sample_config.json";

class SampleApp {
    private static step = 1;
    private static waitForUser: boolean;

    public static async start() {
        Console.log("Kusto sample app is starting...");

        const config = await this.loadConfigs(CONFIG_FILE_NAME);
        this.waitForUser = config.waitForUser;
        if (config.authenticationMode === AuthenticationModeOptions.UserPrompt) {
            await this.waitForUserToProceed(
                "You will be prompted *twice* for credentials during this script. Please return to the console after" + " authenticating."
            );
        }
        const kustoConnectionString = await Authentication.generateConnectionString(
            config.kustoUri,
            config.authenticationMode,
            config.certificatePath,
            config.certificatePassword,
            config.applicationId,
            config.tenantId
        );
        const ingestConnectionString = await Authentication.generateConnectionString(
            config.ingestUri,
            config.authenticationMode,
            config.certificatePath,
            config.certificatePassword,
            config.applicationId,
            config.tenantId
        );

        // Tip: Avoid creating a new Kusto/ingest client for each use.Instead, create the clients once and reuse them.
        if (!kustoConnectionString || !ingestConnectionString) {
            Utils.errorHandler("Connection String error. Please validate your configuration file.");
        } else {
            const kustoClient = new KustoClient(kustoConnectionString);
            const ingestClient = new KustoIngestClient(ingestConnectionString);

            await this.preIngestionQuerying(config, kustoClient);

            if (config.ingestData) {
                await this.ingestion(config, kustoClient, ingestClient);
            }

            if (config.queryData) {
                await this.postIngestionQuerying(kustoClient, config.databaseName, config.tableName, config.ingestData);
            }
        }
        Console.log("\nKusto sample app done");
    }

    /**
     * Loads JSON configuration file, and sets the metadata in place.
     *
     * @param configFilePath Configuration file path.
     * @return ConfigJson object, allowing access to the metadata fields.
     */
    private static async loadConfigs(configFilePath: string): Promise<ConfigJson> {
        try {
            const config: ConfigJson = JSON.parse(await fs.promises.readFile(configFilePath, "utf8"));
            if (!config.databaseName || !config.tableName || !config.tableSchema || !config.kustoUri || !config.ingestUri || !config.data) {
                Utils.errorHandler(`File '${configFilePath}' is missing required fields`);
            }
            return config;
        } catch (ex: any) {
            Utils.errorHandler(`Couldn't read config file: '${configFilePath}'`, ex);
        }
    }

    /**
     * First phase, pre ingestion - will reach the provided DB with several control commands and a query based on the configuration file.
     *
     * @param config ConfigJson object containing the SampleApp configuration
     * @param kustoClient Client to run commands
     */
    private static async preIngestionQuerying(config: ConfigJson, kustoClient: KustoClient) {
        if (config.useExistingTable) {
            if (config.alterTable) {
                // Tip: Usually table was originally created with a schema appropriate for the data being ingested, so this wouldn't be needed.
                // Learn More: For more information about altering table schemas, see:
                // https://docs.microsoft.com/azure/data-explorer/kusto/management/alter-table-command
                await this.waitForUserToProceed(`Alter-merge existing table '${config.databaseName}.${config.tableName}' to align with the provided schema`);
                await this.alterMergeExistingTableToProvidedSchema(kustoClient, config.databaseName, config.tableName, config.tableSchema);
            }
            if (config.queryData) {
                // Learn More: For more information about Kusto Query Language (KQL), see: https://docs.microsoft.com/azure/data-explorer/write-queries
                await this.waitForUserToProceed(`Get existing row count in '${config.databaseName}.${config.tableName}'`);
                await this.queryExistingNumberOfRows(kustoClient, config.databaseName, config.tableName);
            }
        } else {
            // Tip: This is generally a one-time configuration
            // Learn More: For more information about creating tables, see: https://docs.microsoft.com/azure/data-explorer/one-click-table
            await this.waitForUserToProceed(`Creating table '${config.databaseName}.${config.tableName}'`);
            await this.createNewTable(kustoClient, config.databaseName, config.tableName, config.tableSchema);
        }

        // Learn More: Kusto batches data for ingestion efficiency. The default batching policy ingests data when one of the following conditions are met:
        //   1) More than 1,000 files were queued for ingestion for the same table by the same user
        //   2) More than 1GB of data was queued for ingestion for the same table by the same user
        //   3) More than 5 minutes have passed since the first file was queued for ingestion for the same table by the same user
        //  For more information about customizing the ingestion batching policy, see:
        // https://docs.microsoft.com/azure/data-explorer/kusto/management/batchingpolicy
        // TODO: Change if needed. Disabled to prevent an existing batching policy from being unintentionally changed
        if (false && config.batchingPolicy != null) {
            await this.waitForUserToProceed(`Alter the batching policy for table '${config.databaseName}.${config.tableName}'`);
            await this.alterBatchingPolicy(kustoClient, config.databaseName, config.tableName, config.batchingPolicy);
        }
    }

    /**
     * Alter-merges the given existing table to provided schema.
     *
     * @param kustoClient Client to run commands
     * @param databaseName DB name
     * @param tableName Table name
     * @param tableSchema Table schema
     */
    private static async alterMergeExistingTableToProvidedSchema(kustoClient: KustoClient, databaseName: string, tableName: string, tableSchema: string) {
        const command = `.alter-merge table ${tableName} ${tableSchema}`;
        await Queries.executeCommand(kustoClient, databaseName, command, "Node_SampleApp_ControlCommand");
    }

    /**
     * Queries the data on the existing number of rows
     *
     * @param kustoClient Client to run commands
     * @param databaseName DB name
     * @param tableName Table name
     */
    private static async queryExistingNumberOfRows(kustoClient: KustoClient, databaseName: string, tableName: string) {
        const query = `${tableName} | count`;
        await Queries.executeCommand(kustoClient, databaseName, query, "Node_SampleApp_Query");
    }

    /**
     * Queries the first two rows of the table.
     *
     * @param kustoClient Client to run commands
     * @param databaseName DB name
     * @param tableName Table name
     * @private
     */
    private static async queryFirstTwoRows(kustoClient: KustoClient, databaseName: string, tableName: string) {
        const query = `${tableName} | take 2`;
        await Queries.executeCommand(kustoClient, databaseName, query, "Node_SampleApp_Query");
    }

    /**
     * Creates a new table.
     *
     * @param kustoClient Client to run commands
     * @param databaseName DB name
     * @param tableName Table name
     * @param tableSchema Table schema
     */
    private static async createNewTable(kustoClient: KustoClient, databaseName: string, tableName: string, tableSchema: string) {
        const command = `.create table ${tableName} ${tableSchema}`;
        await Queries.executeCommand(kustoClient, databaseName, command, "Node_SampleApp_ControlCommand");
    }

    /**
     * Alters the batching policy based on BatchingPolicy const.
     *
     * @param kustoClient Client to run commands
     * @param databaseName DB name
     * @param tableName Table name
     * @param batchingPolicy Ingestion batching policy
     */
    private static async alterBatchingPolicy(kustoClient: KustoClient, databaseName: string, tableName: string, batchingPolicy: string) {
        // Tip 1: Though most users should be fine with the defaults, to speed up ingestion, such as during development and in this sample app, we opt to
        // modify the default ingestion policy to ingest data after at most 10 seconds.
        // Tip 2: This is generally a one-time configuration.
        // Tip 3: You can also skip the batching for some files using the Flush-Immediately property, though this option should be used with care as it is
        // inefficient.
        const command = `.alter table ${tableName} policy ingestionbatching @'${batchingPolicy}'`;
        await Queries.executeCommand(kustoClient, databaseName, command, "Node_SampleApp_ControlCommand");
    }

    /**
     * Second phase - The ingestion process.
     *
     * @param config ConfigJson object containing the SampleApp configuration
     * @param kustoClient Client to run commands
     * @param ingestClient Client to ingest data
     * @private
     */
    private static async ingestion(config: ConfigJson, kustoClient: KustoClient, ingestClient: KustoIngestClient) {
        for (const dataFile of config.data) {
            const dfVal: string = dataFile.format.toLowerCase();
            let dataFormat: DataFormat;
            if (Object.values(DataFormat).some((val: string) => val === dfVal)) {
                dataFormat = dfVal as DataFormat;
            } else {
                Utils.errorHandler(`Invalid data format: ${dfVal}`);
            }
            const mappingName = dataFile.mappingName;

            // Tip: This is generally a one-time configuration. Learn More: For more information about providing inline mappings and mapping references,
            // see: https://docs.microsoft.com/azure/data-explorer/kusto/management/mappings
            await this.createIngestionMappings(
                dataFile.useExistingMapping,
                kustoClient,
                config.databaseName,
                config.tableName,
                mappingName,
                dataFile.mappingValue,
                dataFormat
            );
            // Learn More: For more information about ingesting data to Kusto in C#,
            // see: https://docs.microsoft.com/en-us/azure/data-explorer/net-sdk-ingest-data
            await this.ingestData(dataFile, dataFormat, ingestClient, config.databaseName, config.tableName, mappingName, config.ignoreFirstRecord);
        }
        await Ingestion.waitForIngestionToComplete(config.waitForIngestSeconds);
    }

    /**
     * Creates Ingestion Mappings (if required) based on given values.
     *
     * @param useExistingMapping Flag noting if we should the existing mapping or create a new one
     * @param kustoClient Client to run commands
     * @param databaseName DB name
     * @param tableName Table name
     * @param mappingName Desired mapping name
     * @param mappingValue Values of the new mappings to create
     * @param dataFormat Given data format
     * @returns True if Ingestion Mappings exists (whether by us, or the already existing one)
     */
    private static async createIngestionMappings(
        useExistingMapping: boolean,
        kustoClient: KustoClient,
        databaseName: string,
        tableName: string,
        mappingName: string,
        mappingValue: string,
        dataFormat: DataFormat
    ): Promise<void> {
        if (useExistingMapping || !mappingValue) {
            return;
        }
        const ingestionMappingKind = dataFormatMappingKind(dataFormat);
        await this.waitForUserToProceed(`Create a '${ingestionMappingKind}' mapping reference named '${mappingName}'`);
        mappingName = mappingName ? mappingName : "DefaultQuickstartMapping" + uuidv4().substring(0, 4);

        const command = `.create-or-alter table ${tableName} ingestion ${ingestionMappingKind.toLowerCase()} mapping '${mappingName}' '${mappingValue}'`;
        await Queries.executeCommand(kustoClient, databaseName, command, "Node_SampleApp_ControlCommand");
    }

    /**
     * Ingest data from given source.
     *
     * @param dataFile Given data source
     * @param dataFormat Given data format
     * @param ingestClient Client to ingest data
     * @param databaseName DB name
     * @param tableName Table name
     * @param mappingName Desired mapping name
     * @param ignoreFirstRecord Flag noting whether to ignore the first record in the table
     */
    private static async ingestData(
        dataFile: ConfigData,
        dataFormat: DataFormat,
        ingestClient: IngestClient,
        databaseName: string,
        tableName: string,
        mappingName: string,
        ignoreFirstRecord: boolean
    ) {
        const sourceType = dataFile.sourceType.toLowerCase();
        const sourceUri = dataFile.dataSourceUri;
        mappingName = mappingName ? mappingName : "DefaultQuickstartMapping" + uuidv4().substring(0, 4);
        await this.waitForUserToProceed(`Ingest '${sourceUri}' from '${sourceType}'`);

        // Tip: When ingesting json files, if each line represents a single-line json, use MULTIJSON format even if the file only contains one line.
        // If the json contains whitespace formatting, use SINGLEJSON. In this case, only one data row json object is allowed per file.
        dataFormat = dataFormat === DataFormat.JSON ? DataFormat.MULTIJSON : dataFormat;

        // Tip: Kusto's Node SDK can ingest data from files, blobs and open streams.See the SDK's samples and the E2E tests in azure.kusto.ingest for
        // additional references.
        switch (sourceType) {
            case SourceType.LocalFileSource:
                await Ingestion.ingestFromFile(ingestClient, databaseName, tableName, sourceUri, dataFormat, mappingName, ignoreFirstRecord);
                break;
            case SourceType.BlobSource:
                await Ingestion.ingestFromBlob(ingestClient, databaseName, tableName, sourceUri, dataFormat, mappingName, ignoreFirstRecord);
                break;
            default:
                Utils.errorHandler(`Unknown source '${sourceType}' for file '${sourceUri}'`);
                break;
        }
    }

    /**
     * Third and final phase - simple queries to validate the hopefully successful run of the script.
     *
     * @param kustoClient Client to run commands
     * @param databaseName DB name
     * @param tableName Table name
     * @param ingestData Flag noting whether any data was ingested by the script
     * @private
     */
    private static async postIngestionQuerying(kustoClient: KustoClient, databaseName: string, tableName: string, ingestData: boolean) {
        const optionalPostIngestionPrompt = ingestData ? "post-ingestion " : "";

        await this.waitForUserToProceed(`Get ${optionalPostIngestionPrompt}row count for '${databaseName}.${tableName}':`);
        await this.queryExistingNumberOfRows(kustoClient, databaseName, tableName);

        await this.waitForUserToProceed(`Get sample (2 records) of ${optionalPostIngestionPrompt}data:`);
        await this.queryFirstTwoRows(kustoClient, databaseName, tableName);
    }

    /**
     * Handles UX on prompts and flow of program
     *
     * @param promptMsg Prompt to display to user
     */
    private static async waitForUserToProceed(promptMsg: string): Promise<any> {
        Console.log(`\nStep ${this.step}: ${promptMsg}`);
        this.step++;
        if (this.waitForUser) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            return new Promise((resolve) =>
                rl.question("Press ENTER to proceed with this operation...", (ans) => {
                    rl.close();
                    resolve(ans);
                })
            );
        }
    }
}

void SampleApp.start();
