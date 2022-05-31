// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as Console from "console";
import * as fs from "fs";
import * as readline from "readline";
import KustoConnectionStringBuilder from "azure-kusto-data/source/connectionBuilder";
import KustoClient from "azure-kusto-data/source/client";
import IngestClient from "azure-kusto-ingest/source/ingestClient";
import ClientRequestProperties from "azure-kusto-data/source/clientRequestProperties";
import {v4 as uuidv4} from "uuid";
import {DataFormat, dataFormatMappingKind} from "azure-kusto-ingest/source/ingestionProperties";
import IngestionProperties from "azure-kusto-ingest/source/ingestionProperties";
import {BlobDescriptor, FileDescriptor} from "azure-kusto-ingest/source/descriptors";

// TODO (config - optional): Change the authentication method from "User Prompt" to any of the other options
//  Some of the auth modes require additional environment variables to be set in order to work (see usage in generate_connection_string below).
//  Managed Identity Authentication only works when running as an Azure service (webapp, function, etc.)
const AUTHENTICATION_MODE = "UserPrompt";  // Options: (UserPrompt|ManagedIdentity|AppKey|AppCertificate)

// TODO (config - optional): Toggle to False to execute this script "unattended"
const WAIT_FOR_USER = true;

// TODO (config):
//  If this quickstart app was downloaded from OneClick, kusto_sample_config.json should be pre-populated with your cluster's details.
//  If this quickstart app was downloaded from GitHub, edit kusto_sample_config.json and modify the cluster URL and database fields appropriately.
const CONFIG_FILE_NAME = "packages/quick_start/source/kusto_sample_config.json";
const BATCHING_POLICY = '{ "MaximumBatchingTimeSpan": "00:00:10", "MaximumNumberOfItems": 500, "MaximumRawDataSizeMB": 1024 }';
const WAIT_FOR_INGEST_SECONDS = 20;


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

class KustoSampleApp {
    private static step = 1;

    public static async start() {
        Console.log("Kusto sample app is starting...");
        const config = await this.loadConfigs(CONFIG_FILE_NAME);
        if (AUTHENTICATION_MODE === "UserPrompt") {
            await this.waitForUserToProceed("You will be prompted *twice* for credentials during this script. Please return to the console after authenticating.");
        }
        const kustoConnectionString = await this.generateConnectionString(config.kustoUri, AUTHENTICATION_MODE, config?.CertificatePath, config?.CertificatePassword,
            config?.ApplicationId, config?.TenantId);
        const ingestConnectionString = await this.generateConnectionString(config.ingestUri, AUTHENTICATION_MODE, config?.CertificatePath, config?.CertificatePassword,
            config?.ApplicationId, config?.TenantId);

        // Tip: Avoid creating a new Kusto/ingest client for each use.Instead, create the clients once and reuse them.
        if (!kustoConnectionString || !ingestConnectionString) {
            this.errorHandler(`Connection String error. Please validate your configuration file.`);
        } else {
            const kustoClient = new KustoClient(kustoConnectionString);
            const ingestClient = new IngestClient(ingestConnectionString);
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

            if (config.ingestData) {

                for (const dataFile of config.data) {
                    const dfVal: string = dataFile.format.toLowerCase();
                    let dataFormat: DataFormat;
                    if (Object.values(DataFormat).some((val: string) => val === dfVal)) {
                        dataFormat = dfVal as DataFormat;
                    } else {
                        this.errorHandler(`Invalid data format: ${dfVal}`);
                    }
                    const mappingName = dataFile.mappingName;

                    // Tip: This is generally a one-time configuration. Learn More: For more information about providing inline mappings and mapping references,
                    // see: https://docs.microsoft.com/azure/data-explorer/kusto/management/mappings
                    if (!await this.createIngestionMappings(dataFile.useExistingMapping, kustoClient, config.databaseName, config.tableName, mappingName, dataFile.mappingValue, dataFormat)) {
                        continue;
                    }
                    // Learn More: For more information about ingesting data to Kusto in C#,
                    // see: https://docs.microsoft.com/en-us/azure/data-explorer/net-sdk-ingest-data
                    await this.ingestAsync(dataFile, dataFormat, ingestClient, config.databaseName, config.tableName, mappingName);
                }
                await this.waitForIngestionToComplete();
            }
            if (config.queryData) {
                await this.executeValidationQueries(kustoClient, config.databaseName, config.tableName, config.ingestData);
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
                this.errorHandler(`File '${configFilePath}' is missing required fields`);
            }
            return config;
        } catch (ex: any) {
            this.errorHandler(`Couldn't read config file: '${configFilePath}'`, ex);
        }
    }

    /**
     * Generates Kusto Connection String based on given Authentication Mode.
     *
     * @param clusterUri Cluster to connect to.
     * @param authenticationMode User Authentication Mode, Options: (UserPrompt|ManagedIdentity|AppKey|AppCertificate)
     * @param CertificatePath Given certificate path
     * @param CertificatePassword Given certificate password
     * @param ApplicationId Given application id
     * @param TenantId Given tenant id
     * @returns A connection string to be used when creating a Client
     */
    private static generateConnectionString(clusterUri: string, authenticationMode: string, CertificatePath: string | undefined,
                                            CertificatePassword: string | undefined, ApplicationId: string | undefined, TenantId: string | undefined):
        Promise<KustoConnectionStringBuilder> | KustoConnectionStringBuilder {
        // Learn More: For additional information on how to authorize users and apps in Kusto see:
        // https://docs.microsoft.com/azure/data-explorer/manage-database-permissions
        switch (authenticationMode) {
            case "UserPrompt": {
                // Prompt user for credentials
                return KustoConnectionStringBuilder.withUserPrompt(clusterUri);
            }
            case "ManagedIdentity": {
                // Authenticate using a System-Assigned managed identity provided to an azure service, or using a User-Assigned managed identity.
                // For more information, see https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview
                // Connect using the system - or user-assigned managed identity (Azure service only)
                // TODO (config - optional): Managed identity client ID if you are using a user-assigned managed identity
                const clientId: string | undefined = process.env.MANAGED_IDENTITY_CLIENT_ID;
                return KustoConnectionStringBuilder.withAadManagedIdentities(clusterUri, clientId);
            }
            case "AppKey": {
                // Learn More: For information about how to procure an AAD Application,
                // see: https://docs.microsoft.com/azure/data-explorer/provision-azure-ad-app
                // TODO (config - optional): App ID & tenant, and App Key to authenticate with
                return this.createAppKeyConnectionString(clusterUri);
            }
            case "AppCertificate": {
                // Authenticate using a certificate file.
                return this.createAppCertificateConnectionString(clusterUri, CertificatePath, CertificatePassword, ApplicationId, TenantId);
            }
            default: {
                this.errorHandler(`Authentication mode '${authenticationMode}' is not supported`);
            }
        }
    }

    /**
     * Generates Kusto Connection String based on 'AppKey' Authentication Mode.
     *
     * @param clusterUri Url of cluster to connect to
     * @returns AppKey Kusto Connection String
     */
    private static createAppKeyConnectionString(clusterUri: string): KustoConnectionStringBuilder {
        const aadAppId: string | undefined = process.env.APP_ID;
        const appKey: string | undefined = process.env.APP_KEY;
        const authorityId: string | undefined = process.env.APP_TENANT;
        if (!aadAppId || !appKey || !authorityId) {
            this.errorHandler(`"Missing some required field/s in configuration file in order to authenticate using an app key."`);
        } else {
            return KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(clusterUri, aadAppId, appKey, authorityId);
        }
    }

    /**
     * Generates Kusto Connection String based on 'AppCertificate' Authentication Mode.
     *
     * @param clusterUri Url of cluster to connect to
     * @param CertificatePath Given certificate path
     * @param CertificatePassword Given certificate password
     * @param ApplicationId Given application id
     * @param TenantId Given tenant id
     * @returns AppCertificate Kusto Connection String
     */
    private static async createAppCertificateConnectionString(clusterUri: string, CertificatePath: string | undefined, CertificatePassword: string | undefined,
                                                              ApplicationId: string | undefined, TenantId: string | undefined): Promise<KustoConnectionStringBuilder> {
        const appId: string | undefined = process.env.APP_ID;
        const appTenant: string | undefined = process.env.APP_TENANT;
        const privateKeyPemFilePath: string | undefined = process.env.PRIVATE_KEY_PEM_FILE_PATH;
        const certThumbprint: string | undefined = process.env.CERT_THUMBPRINT;
        const publicCertFilePath: string | undefined = process.env.PUBLIC_CERT_FILE_PATH;

        if (!CertificatePath || !CertificatePassword || !ApplicationId || !TenantId || !appId) {
            this.errorHandler(`"Missing some required field/s in environment in order to authenticate using a certificate."`);
        } else {
            if (!privateKeyPemFilePath) {
                this.errorHandler(`"Failed to load PEM file from ${privateKeyPemFilePath}"`);
            } else {
                const pemCertificate: string = await fs.promises.readFile(privateKeyPemFilePath, "utf8")
                if (publicCertFilePath) {
                    const publicCertificate: string = await fs.promises.readFile(publicCertFilePath, "utf8")
                    return KustoConnectionStringBuilder.withAadApplicationCertificateAuthentication(clusterUri, appId, pemCertificate, publicCertificate, appTenant)
                }
                if (!certThumbprint) {
                    this.errorHandler(`"Missing required field: "certThumbprint" in environment in order to authenticate using a certificate."`);
                } else {
                    return KustoConnectionStringBuilder.withAadApplicationCertificateAuthentication(clusterUri, appId, pemCertificate, certThumbprint, appTenant)
                }
            }
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
        await this.executeCommand(kustoClient, databaseName, command, "Node_SampleApp_ControlCommand")
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
        await this.executeCommand(kustoClient, databaseName, query, "Node_SampleApp_Query")
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
        await this.executeCommand(kustoClient, databaseName, command, "Node_SampleApp_ControlCommand")

        // Learn More: Kusto batches data for ingestion efficiency. The default batching policy ingests data when one of the following conditions are met:
        //   1) More than 1,000 files were queued for ingestion for the same table by the same user
        //   2) More than 1GB of data was queued for ingestion for the same table by the same user
        //   3) More than 5 minutes have passed since the first file was queued for ingestion for the same table by the same user
        //  For more information about customizing the ingestion batching policy, see:
        // https://docs.microsoft.com/azure/data-explorer/kusto/management/batchingpolicy

        // TODO: Change if needed.
        // Disabled to prevent an existing batching policy from being unintentionally changed
        if (false) {
            await this.waitForUserToProceed(`Alter the batching policy for table '${databaseName}.${tableName}'`);
            await this.alterBatchingPolicy(kustoClient, databaseName, tableName);
        }
    }

    /**
     * Alters the batching policy based on BatchingPolicy const.
     *
     * @param kustoClient Client to run commands
     * @param databaseName DB name
     * @param tableName Table name
     */
    private static async alterBatchingPolicy(kustoClient: KustoClient, databaseName: string, tableName: string) {
        // Tip 1: Though most users should be fine with the defaults, to speed up ingestion, such as during development and in this sample app, we opt to
        // modify the default ingestion policy to ingest data after at most 10 seconds.
        // Tip 2: This is generally a one-time configuration.
        // Tip 3: You can also skip the batching for some files using the Flush-Immediately property, though this option should be used with care as it is
        // inefficient.
        const command = `.alter table ${tableName} policy ingestionbatching @'${BATCHING_POLICY}'`;
        await this.executeCommand(kustoClient, databaseName, command, "Node_SampleApp_ControlCommand")
    }

    /**
     * Executes a command using the kustoClient
     *
     * @param kustoClient Client to run commands
     * @param databaseName DB name
     * @param command The command to run. can either be management(control) command or query.
     * @param scope Working scope
     */
    private static async executeCommand(kustoClient: KustoClient, databaseName: string, command: string, scope: string) {
        try {
            const clientRequestProperties = this.createClientRequestProperties(scope);
            const responseDataSet = await kustoClient.execute(databaseName, command, clientRequestProperties);
            // Tip: Actual implementations wouldn't generally print the response from a control command.We print here to demonstrate what a sample of the
            // response looks like.
            Console.log(`Response from executed control command '${command}':\n--------------------`);
            for (const row of responseDataSet.primaryResults[0].rows()) {
                Console.log(row.toJSON());
            }
        } catch (ex: any) {
            this.errorHandler(`Failed to execute command: '${command}'`, ex);
        }
    }

    /**
     * Creates a fitting ClientRequestProperties object, to be used when executing control commands or queries.
     *
     * @param scope Working scope
     * @param timeout Requests default timeout
     * @returns ClientRequestProperties object
     */
    private static createClientRequestProperties(scope: string, timeout: number | null = null): ClientRequestProperties {
        // It is strongly recommended that each request has its own unique request identifier.
        // This is mandatory for some scenarios (such as cancelling queries) and will make troubleshooting easier in others
        const clientRequestProperties: ClientRequestProperties = new ClientRequestProperties({
            application: 'kustoSampleApp.js',
            clientRequestId: `${scope};${uuidv4()}`
        })
        // Tip: Though uncommon, you can alter the request default command timeout using the below command, e.g. to set the timeout to 10 minutes, use "10m"
        if (timeout != null) {
            clientRequestProperties.setTimeout(timeout);
        }
        return clientRequestProperties;
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
    private static async createIngestionMappings(useExistingMapping: boolean, kustoClient: KustoClient, databaseName: string, tableName: string, mappingName: string, mappingValue: string, dataFormat: DataFormat): Promise<boolean> {
        if (useExistingMapping || !mappingValue) {
            return true;
        }
        const ingestionMappingKind = dataFormatMappingKind(dataFormat);
        await this.waitForUserToProceed(`Create a '${ingestionMappingKind}' mapping reference named '${mappingName}'`);
        mappingName = mappingName ? mappingName : "DefaultQuickstartMapping" + uuidv4().substring(0, 4);
        const command = `.create-or-alter table ${tableName} ingestion ${ingestionMappingKind.toLowerCase()} mapping '${mappingName}' '${mappingValue}'`;
        await this.executeCommand(kustoClient, databaseName, command, "Node_SampleApp_ControlCommand")
        return true;
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
     */
    private static async ingestAsync(dataFile: ConfigData, dataFormat: DataFormat, ingestClient: IngestClient, databaseName: string, tableName: string, mappingName: string) {
        const sourceType = dataFile.sourceType.toLowerCase();
        const sourceUri = dataFile.dataSourceUri;
        mappingName = mappingName ? mappingName : "DefaultQuickstartMapping" + uuidv4().substring(0, 4);
        await this.waitForUserToProceed(`Ingest '${sourceUri}' from '${sourceType}'`)

        // Tip: When ingesting json files, if each line represents a single-line json, use MULTIJSON format even if the file only contains one line.
        // If the json contains whitespace formatting, use SINGLEJSON. In this case, only one data row json object is allowed per file.
        dataFormat = dataFormat === DataFormat.JSON ? DataFormat.MULTIJSON : dataFormat;

        // Tip: Kusto's Node SDK can ingest data from files, blobs and open streams.See the SDK's samples and the E2E tests in azure.kusto.ingest for
        // additional references.
        switch (sourceType) {
            case "localfilesource":
                await this.ingestFromFileAsync(ingestClient, databaseName, tableName, sourceUri, dataFormat, mappingName);
                break;
            case "blobsource":
                await this.ingestFromBlobAsync(ingestClient, databaseName, tableName, sourceUri, dataFormat, mappingName);
                break;
            default:
                this.errorHandler(`Unknown source '${sourceType}' for file '${sourceUri}'`);
                break;
        }

    }

    /**
     * Ingest Data from a given file path.
     *
     * @param ingestClient Client to ingest data
     * @param databaseName DB name
     * @param tableName Table name
     * @param filePath File path
     * @param dataFormat Given data format
     * @param mappingName Desired mapping name
     */
    private static async ingestFromFileAsync(ingestClient: IngestClient, databaseName: string, tableName: string, filePath: string, dataFormat: DataFormat, mappingName: string) {
        const ingestionProp = this.createIngestionProperties(databaseName, tableName, dataFormat, mappingName);
        // Tip 1: For optimal ingestion batching and performance, specify the uncompressed data size in the file descriptor instead of the default below of
        // 0. Otherwise, the service will determine the file size, requiring an additional s2s call, and may not be accurate for compressed files.
        // Tip 2: To correlate between ingestion operations in your applications and Kusto, set the source ID and log it somewhere.
        const fileDescriptor = new FileDescriptor(`${__dirname}\\${filePath}`, uuidv4(), 0)
        await ingestClient.ingestFromFile(fileDescriptor, ingestionProp)
    }

    /**
     * Ingest Data from a Blob.
     *
     * @param ingestClient Client to ingest data
     * @param databaseName DB name
     * @param tableName Table name
     * @param blobUri Blob Uri
     * @param dataFormat Given data format
     * @param mappingName Desired mapping name
     */
    private static async ingestFromBlobAsync(ingestClient: IngestClient, databaseName: string, tableName: string, blobUri: string, dataFormat: DataFormat, mappingName: string) {
        const ingestionProp = this.createIngestionProperties(databaseName, tableName, dataFormat, mappingName);
        // Tip 1: For optimal ingestion batching and performance, specify the uncompressed data size in the file descriptor instead of the default below of
        // 0. Otherwise, the service will determine the file size, requiring an additional s2s call, and may not be accurate for compressed files.
        // Tip 2: To correlate between ingestion operations in your applications and Kusto, set the source ID and log it somewhere.
        const blobDescriptor = new BlobDescriptor(blobUri, 0, uuidv4())
        await ingestClient.ingestFromBlob(blobDescriptor, ingestionProp)
    }

    /**
     * Creates a fitting KustoIngestionProperties object, to be used when executing ingestion commands.
     *
     * @param databaseName DB name
     * @param tableName Table name
     * @param dataFormat Given data format
     * @param mappingName Desired mapping name
     * @returns IngestionProperties object
     */
    private static createIngestionProperties(databaseName: string, tableName: string, dataFormat: DataFormat, mappingName: string): IngestionProperties {
        return new IngestionProperties({
            database: databaseName,
            table: tableName,
            // Learn More: For more information about supported data formats, see: https://docs.microsoft.com/azure/data-explorer/ingestion-supported-formats
            format: dataFormat,
            ingestionMappingReference: mappingName,
            ingestionMappingKind: dataFormatMappingKind(dataFormat),
            // TODO (config - optional): Setting the ingestion batching policy takes up to 5 minutes to take effect.
            //  We therefore set Flush-Immediately for the sake of the sample, but it generally shouldn't be used in practice.
            //  Comment out the line below after running the sample the first few times.
            flushImmediately: true
        })
    }

    /**
     * Halts the program for WaitForIngestSeconds, allowing the queued ingestion process to complete.
     */
    private static async waitForIngestionToComplete() {
        Console.log(
            `Sleeping ${WAIT_FOR_INGEST_SECONDS} seconds for queued ingestion to complete. Note: This may take longer depending on the file size and ingestion batching policy.`);
        Console.log();
        Console.log();

        for (let i = 0; i <= 20; i++) {
            const dots = ".".repeat(i)
            const left = 20 - i
            const empty = " ".repeat(left)

            process.stdout.write(`\r[${dots}${empty}] ${i * 5}%`)
            await new Promise(res => setTimeout(res, 500))

        }
    }

    /**
     * End-Of-Script simple queries, to validate the hopefully successful run of the script.
     *
     * @param kustoClient Client to run commands
     * @param databaseName DB Name
     * @param tableName Table Name
     * @param ingestData Flag noting whether any data was ingested by the script
     */
    private static async executeValidationQueries(kustoClient: KustoClient, databaseName: string, tableName: string, ingestData: boolean) {
        const optionalPostIngestionPrompt = ingestData ? "post-ingestion " : "";

        await this.waitForUserToProceed(`Get ${optionalPostIngestionPrompt}row count for '${databaseName}.${tableName}':`);
        await this.queryExistingNumberOfRows(kustoClient, databaseName, tableName)

        await this.waitForUserToProceed(`Get sample (2 records) of ${optionalPostIngestionPrompt}data:`);
        const query = `${tableName} | take 2`;
        await this.executeCommand(kustoClient, databaseName, query, "Node_SampleApp_Query")

    }

    /**
     * Handles UX on prompts and flow of program
     *
     * @param promptMsg Prompt to display to user
     */
    private static waitForUserToProceed(promptMsg: string): Promise<any> | undefined {
        Console.log(`\nStep ${this.step}: ${promptMsg}`);
        this.step++;
        if (WAIT_FOR_USER) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            return new Promise(resolve => rl.question("Press ENTER to proceed with this operation...", ans => {
                rl.close();
                resolve(ans);
            }))
        }
    }

    /**
     * Error handling function. Will mention the appropriate error message (and the exception itself if exists), and will quit the program.
     *
     * @param error Appropriate error message received from calling function
     * @param ex Thrown exception
     */
    private static errorHandler(error: string, ex: any = null): never {
        Console.log(`Script failed with error: ${error}`);
        if (!ex) {
            Console.log(`Exception: ${ex}`);
        }

        process.exit(1);
    }
}

void KustoSampleApp.start();
