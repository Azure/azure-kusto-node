# Quickstart App

The quickstart application is a **self-contained and runnable** example app that demonstrates authenticating, connecting to, administering, ingesting data
into and querying Azure Data Explorer using the azure-kusto-node SDK.
You can use it as a baseline to write your own first kusto client application, altering the code as you go, or copy code sections out of it into your app.

**Tip:** The app includes comments with tips on recommendations, coding best practices, links to reference materials and recommended TODO changes when adapting the code to your needs.

## Using the App for the first time

### Prerequisites

1. Set up NodeJS version 14+ and npm on your machine. For instructions, consult a setup tutorial, like [this](https://docs.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-windows)

### Retrieving the app from GitHub

1. Download the app files from this GitHub repository.
2. Modify the `kusto_sample_config.json` file, changing `kustoUri`, `ingestUri` and `databaseName` appropriately for your cluster.

### Retrieving the app from OneClick

1. Open a browser and type your cluster's URL (e.g. https://mycluster.westeurope.kusto.windows.net/). You will be redirected to the _Azure Data Explorer_ Web UI.
2. On the left menu, select **Data**.
3. Click **Generate Sample App Code** and then follow the instructions in the wizard.
4. Download the app as a ZIP file.
5. Extract the app source code.
   **Note**: The configuration parameters defined in the `kusto_sample_config.json` file are preconfigured with the appropriate values for your cluster. Verify that these are correct.

### Run the app

1. Open a command line window and navigate to the folder where you extracted the app.
2. Either use an IDE of your choice to build and run the project, or execute the following using the command line window:
    1. Run `npm install` in the folder
    2. Run `npm run quick_start`

#### Troubleshooting

-   If you are having trouble running the app from your IDE, first check if the app runs from the command line, then consult the troubleshooting references of your IDE.
