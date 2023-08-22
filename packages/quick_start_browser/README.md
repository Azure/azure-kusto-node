# Quickstart App

The quickstart application is a **self-contained and runnable** example app that demonstrates authenticating, connecting to, administering, ingesting data
into and querying Azure Data Explorer using the Azure Kusto JS SDK.
You can use it as a baseline to write your own first kusto client application, altering the code as you go, or copy code sections out of it into your app.

**Tip:** The app includes comments with tips on recommendations, coding best practices, links to reference materials and recommended TODO changes when adapting the code to your needs.

## Using the App for the first time

### Prerequisites

1. Set up NodeJS version 14+ and npm on your machine. For instructions, consult a setup tutorial, like [this](https://docs.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-windows)

### Retrieving the app from GitHub

1. Download the app files from this GitHub repository.
2. You may modify the `kusto_sample_config.json` file, changing `kustoUri`, `ingestUri` and `databaseName` appropriately for your cluster.

### Retrieving the app from OneClick

Not yet available.

### Run the app

1. Open a command line window and navigate to the folder where you extracted the app.
2. Either use an IDE of your choice to build and run the project, or execute the following using the command line window:
    1. Run `npm install` in the sample folder
    2. Run `npm run dev`

#### Troubleshooting

-   If you are having trouble running the app from your IDE, first check if the app runs from the command line, then consult the troubleshooting references of your IDE.

#### Authenticaiton
This example uses @azure/identity InteractiveBrowserCredential, the authentication app id used in this method is taken from the App id field, the app should be granted admin consent to Azure Data Explorer and allow the redirectUri of the url of the runing site. See steps [here](https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/identity/identity/test/manual/interactive-browser-credential)
A production app should better authenticate users itself and use the "withTokenProvide" builder method of the Kusto client connectionStringBuilder. 