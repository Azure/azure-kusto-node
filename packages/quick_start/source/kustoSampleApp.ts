// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as Console from "console";
import * as fs from "fs";

// TODO (config - optional): Change the authentication method from "User Prompt" to any of the other options
//  Some of the auth modes require additional environment variables to be set in order to work (see usage in generate_connection_string below).
//  Managed Identity Authentication only works when running as an Azure service (webapp, function, etc.)
// const AUTHENTICATION_MODE = "UserPrompt";  // Options: (UserPrompt|ManagedIdentity|AppKey|AppCertificate)

// TODO (config - optional): Toggle to False to execute this script "unattended"
// const WAIT_FOR_USER = true;

// TODO (config):
//  If this quickstart app was downloaded from OneClick, kusto_sample_config.json should be pre-populated with your cluster's details.
//  If this quickstart app was downloaded from GitHub, edit kusto_sample_config.json and modify the cluster URL and database fields appropriately.
const CONFIG_FILE_NAME = "packages/quick_start/source/kusto_sample_config.json";
// const BATCHING_POLICY = '{ "MaximumBatchingTimeSpan": "00:00:10", "MaximumNumberOfItems": 500, "MaximumRawDataSizeMB": 1024 }';
// const WAIT_FOR_INGEST_SECONDS = 20;


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
}

class KustoSampleApp {
    _step: number

    constructor() {
        this._step = 1
    }

    public static async start() {
        Console.log("Kusto sample app is starting...");
        const config = await this.loadConfigs(CONFIG_FILE_NAME);
        Console.log("\nKusto sample app done");
    }

    /**
     * Loads JSON configuration file, and sets the metadata in place.
     *
     * @param configFilePath Configuration file path.
     * @return ConfigJson object, allowing access to the metadata fields.
     */
    private static async loadConfigs(configFilePath: string): Promise<ConfigJson | undefined> {
        try {
            const config: ConfigJson = JSON.parse(await fs.promises.readFile(configFilePath, "utf8"));
            if (!config.databaseName || !config.tableName || !config.tableSchema || !config.kustoUri || !config.ingestUri || !config.data) {
                this.ErrorHandler(`File '${configFilePath}' is missing required fields`);
            }
            return config;
        } catch (ex: any) {
            this.ErrorHandler(`Couldn't read config file: '${configFilePath}'`, ex);
        }
    }

    /**
     * Error handling function. Will mention the appropriate error message (and the exception itself if exists), and will quit the program.
     *
     * @param error Appropriate error message received from calling function
     * @param ex Thrown exception
     */
    private static ErrorHandler(error: string, ex: any = null) {
        Console.log(`Script failed with error: ${error}`);
        if (!ex) {
            Console.log(`Exception: ${ex}`);
        }

        process.exit(1);
    }
}

void KustoSampleApp.start();
