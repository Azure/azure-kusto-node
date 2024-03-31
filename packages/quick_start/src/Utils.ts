// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ClientRequestProperties, Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";
import { BlobDescriptor, DataFormat, FileDescriptor, IngestClient } from "azure-kusto-ingest";
import IngestionProperties, { dataFormatMappingKind } from "azure-kusto-ingest/src/ingestionProperties";
import Console from "console";
import fs from "fs";
import util from "util";
import { v4 as uuidv4 } from "uuid";
import { AuthenticationModeOptions } from "./SampleApp";

/**
 * Util static class - Handles the communication with the API, and provides generic and simple "plug-n-play" functions to use in different programs.
 */
export default abstract class Utils {
    /**
     * Error handling function. Will mention the appropriate error message (and the exception itself if exists), and will quit the program.
     *
     * @param error Appropriate error message received from calling function
     * @param ex Thrown exception
     */
    public static errorHandler(error: string, ex: any = null): never {
        Console.log(`Script failed with error: ${error}`);
        if (ex) {
            Console.log(`Exception: ${util.format(ex)}`);
        }

        process.exit(1);
    }
}

/**
 * Authentication module of Utils - in charge of authenticating the user with the system
 */
export class Authentication extends Utils {
    /**
     * Generates Kusto Connection String based on given Authentication Mode.
     *
     * @param clusterUri Cluster to connect to.
     * @param authenticationMode User Authentication Mode, Options: (UserPrompt|ManagedIdentity|AppKey|AppCertificate)
     * @param certificatePath Given certificate path
     * @param certificatePassword Given certificate password
     * @param applicationId Given application id
     * @param tenantId Given tenant id
     * @returns A connection string to be used when creating a Client
     */
    public static async generateConnectionString(
        clusterUri: string,
        authenticationMode: AuthenticationModeOptions,
        certificatePath: string | undefined,
        certificatePassword: string | undefined,
        applicationId: string | undefined,
        tenantId: string | undefined
    ): Promise<KustoConnectionStringBuilder> {
        // Learn More: For additional information on how to authorize users and apps in Kusto see:
        // https://docs.microsoft.com/azure/data-explorer/manage-database-permissions
        switch (authenticationMode) {
            case AuthenticationModeOptions.UserPrompt: {
                // Prompt user for credentials
                return KustoConnectionStringBuilder.withUserPrompt(clusterUri);
            }
            case AuthenticationModeOptions.ManagedIdentity: {
                // Authenticate using a System-Assigned managed identity provided to an azure service, or using a User-Assigned managed identity.
                // For more information, see https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview
                // Connect using the system - or user-assigned managed identity (Azure service only)
                // TODO (config - optional): Managed identity client ID if you are using a user-assigned managed identity
                return process.env.MANAGED_IDENTITY_CLIENT_ID
                    ? KustoConnectionStringBuilder.withUserManagedIdentity(clusterUri, process?.env?.MANAGED_IDENTITY_CLIENT_ID)
                    : KustoConnectionStringBuilder.withSystemManagedIdentity(clusterUri);
            }
            case AuthenticationModeOptions.AppKey: {
                // Learn More: For information about how to procure an AAD Application,
                // see: https://docs.microsoft.com/azure/data-explorer/provision-azure-ad-app
                // TODO (config - optional): App ID & tenant, and App Key to authenticate with
                return this.createAppKeyConnectionString(clusterUri);
            }
            case AuthenticationModeOptions.AppCertificate: {
                // Authenticate using a certificate file.
                return await this.createAppCertificateConnectionString(clusterUri, certificatePath, certificatePassword, applicationId, tenantId);
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
    public static createAppKeyConnectionString(clusterUri: string): KustoConnectionStringBuilder {
        const aadAppId: string | undefined = process?.env?.APP_ID;
        const appKey: string | undefined = process?.env?.APP_KEY;
        const authorityId: string | undefined = process?.env?.APP_TENANT;
        if (!aadAppId || !appKey || !authorityId) {
            this.errorHandler(`"Missing some required field's in configuration file in order to authenticate using an app key."`);
        } else {
            return KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(clusterUri, aadAppId, appKey, authorityId);
        }
    }

    /**
     * Generates Kusto Connection String based on 'AppCertificate' Authentication Mode.
     *
     * @param clusterUri Url of cluster to connect to
     * @param certificatePath Given certificate path
     * @param certificatePassword Given certificate password
     * @param applicationId Given application id
     * @param tenantId Given tenant id
     * @returns AppCertificate Kusto Connection String
     */
    public static async createAppCertificateConnectionString(
        clusterUri: string,
        certificatePath: string | undefined,
        certificatePassword: string | undefined,
        applicationId: string | undefined,
        tenantId: string | undefined,
        sendX5c?: boolean
    ): Promise<KustoConnectionStringBuilder> {
        const appId: string | undefined = process?.env?.APP_ID;
        const appTenant: string | undefined = process?.env?.APP_TENANT;
        const privateKeyPemFilePath: string | undefined = process?.env?.PRIVATE_KEY_PEM_FILE_PATH;
        const publicCertFilePath: string | undefined = process?.env?.PUBLIC_CERT_FILE_PATH;

        if (!certificatePath || !certificatePassword || !applicationId || !tenantId || !appId) {
            this.errorHandler(`"Missing some required field/s in environment in order to authenticate using a certificate."`);
        } else {
            if (!privateKeyPemFilePath) {
                this.errorHandler(`"Failed to load PEM file from ${privateKeyPemFilePath}"`);
            } else {
                const pemCertificate: string = await fs.promises.readFile(privateKeyPemFilePath, "utf8");
                if (publicCertFilePath) {
                    return KustoConnectionStringBuilder.withAadApplicationCertificateAuthentication(clusterUri, appId, pemCertificate, appTenant, sendX5c);
                }
                return KustoConnectionStringBuilder.withAadApplicationCertificateAuthentication(clusterUri, appId, pemCertificate, appTenant);
            }
        }
    }
}

/**
 * Queries module of Utils - in charge of querying the data - either with management queries, or data queries
 */
export class Queries extends Utils {
    /**
     * Creates a fitting ClientRequestProperties object, to be used when executing control commands or queries.
     *
     * @param scope Working scope
     * @param timeout Requests default timeout
     * @returns ClientRequestProperties object
     */
    public static createClientRequestProperties(scope: string, timeout: number | null = null): ClientRequestProperties {
        // It is strongly recommended that each request has its own unique request identifier.
        // This is mandatory for some scenarios (such as cancelling queries) and will make troubleshooting easier in others
        const clientRequestProperties: ClientRequestProperties = new ClientRequestProperties({
            application: "kustoSampleApp.js",
            clientRequestId: `${scope};${uuidv4()}`,
        });
        // Tip: Though uncommon, you can alter the request default command timeout using the below command, e.g. to set the timeout to 10 minutes, use "10m"
        if (timeout != null) {
            clientRequestProperties.setTimeout(timeout);
        }
        return clientRequestProperties;
    }

    /**
     * Executes a command using the kustoClient
     *
     * @param kustoClient Client to run commands
     * @param databaseName DB name
     * @param command The command to run. can either be management(control) command or query.
     * @param scope Working scope
     */
    public static async executeCommand(kustoClient: KustoClient, databaseName: string, command: string, scope: string, exit: boolean = true) {
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
            if (exit) {
                this.errorHandler(`Failed to execute command: '${command}'`, ex);
            }
        }
    }
}

/**
 * Ingestion module of Utils - in charge of ingesting the given data - based on the configuration file.
 */
export class Ingestion extends Utils {
    /**
     * Creates a fitting KustoIngestionProperties object, to be used when executing ingestion commands.
     *
     * @param databaseName DB name
     * @param tableName Table name
     * @param dataFormat Given data format
     * @param mappingName Desired mapping name
     * @param ignoreFirstRecordFlag Flag noting whether to ignore the first record in the table
     * @returns IngestionProperties object
     */
    public static createIngestionProperties(
        databaseName: string,
        tableName: string,
        dataFormat: DataFormat,
        mappingName: string,
        ignoreFirstRecordFlag: boolean
    ): IngestionProperties {
        return new IngestionProperties({
            database: databaseName,
            table: tableName,
            // Learn More: For more information about supported data formats, see: https://docs.microsoft.com/azure/data-explorer/ingestion-supported-formats
            format: dataFormat,
            ingestionMappingReference: mappingName,
            ingestionMappingKind: dataFormatMappingKind(dataFormat),
            // TODO (config - optional): Setting the ingestion batching policy takes up to 5 minutes to take effect.
            // We therefore set Flush-Immediately for the sake of the sample, but it generally shouldn't be used in practice.
            // Comment out the line below after running the sample the first few times.
            flushImmediately: true,
            ignoreFirstRecord: ignoreFirstRecordFlag,
        });
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
     * @param ignoreFirstRecord Flag noting whether to ignore the first record in the table
     */
    public static async ingestFromFile(
        ingestClient: IngestClient,
        databaseName: string,
        tableName: string,
        filePath: string,
        dataFormat: DataFormat,
        mappingName: string,
        ignoreFirstRecord: boolean
    ) {
        const ingestionProp = this.createIngestionProperties(databaseName, tableName, dataFormat, mappingName, ignoreFirstRecord);
        // Tip 1: For optimal ingestion batching and performance, specify the uncompressed data size in the file descriptor instead of the default below of
        // 0. Otherwise, the service will determine the file size, requiring an additional s2s call, and may not be accurate for compressed files.
        // Tip 2: To correlate between ingestion operations in your applications and Kusto, set the source ID and log it somewhere.
        const fileDescriptor = new FileDescriptor(`${__dirname}\\${filePath}`, uuidv4(), 0);
        await ingestClient.ingestFromFile(fileDescriptor, ingestionProp);
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
     * @param ignoreFirstRecord Flag noting whether to ignore the first record in the table
     */
    public static async ingestFromBlob(
        ingestClient: IngestClient,
        databaseName: string,
        tableName: string,
        blobUri: string,
        dataFormat: DataFormat,
        mappingName: string,
        ignoreFirstRecord: boolean
    ) {
        const ingestionProp = this.createIngestionProperties(databaseName, tableName, dataFormat, mappingName, ignoreFirstRecord);
        // Tip 1: For optimal ingestion batching and performance, specify the uncompressed data size in the file descriptor instead of the default below of
        // 0. Otherwise, the service will determine the file size, requiring an additional s2s call, and may not be accurate for compressed files.
        // Tip 2: To correlate between ingestion operations in your applications and Kusto, set the source ID and log it somewhere.
        const blobDescriptor = new BlobDescriptor(blobUri, 0, uuidv4());
        await ingestClient.ingestFromBlob(blobDescriptor, ingestionProp);
    }

    /**
     * Halts the program for WaitForIngestSeconds, allowing the queued ingestion process to complete.
     */
    public static async waitForIngestionToComplete(waitForIngestSeconds: number) {
        Console.log(
            `Sleeping ${waitForIngestSeconds} seconds for queued ingestion to complete. Note: This may take longer depending on the file size and ingestion 
            batching policy.`
        );
        Console.log();
        Console.log();

        for (let i = 0; i <= waitForIngestSeconds; i++) {
            const dots = ".".repeat(i);
            const left = waitForIngestSeconds - i;
            const empty = " ".repeat(left);

            process.stdout.write(`\r[${dots}${empty}] ${i * 5}%`);
            await new Promise((res) => setTimeout(res, 500));
        }
    }
}
