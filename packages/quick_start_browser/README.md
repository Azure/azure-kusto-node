# Quickstart App

The quickstart application is a **self-contained and runnable** example app that demonstrates authenticating, connecting to, administering, ingesting data
into and querying Azure Data Explorer using the Azure Kusto JS SDK.
You can use it as a baseline to write your own first kusto client application, altering the code as you go, or copy code sections out of it into your app.

**Tip:** The app includes comments with tips on recommendations, coding best practices, links to reference materials and recommended TODO changes when adapting the code to your needs.

## Using the App for the first time

### Prerequisites

1. Set up **Node.js >=22.12.0** (prefer a current patched LTS release) and **npm 11.21.2** on your machine. Use `npm install --global npm@11.21.2` to select npm. Node is build tooling; the app itself runs in the browser.

### Retrieving the app from GitHub

1. Download the app files from this GitHub repository.
2. Modify `src/kusto_sample_config.json`, changing `kustoUri`, `ingestUri` and `databaseName` appropriately for an approved test cluster.

### Retrieving the app from OneClick

Not yet available.

### Run the app

The app can create/alter tables, change ingestion policies, and ingest data. Review the configuration before running it; do not use a production database for experimentation.

1. Open a command line window and navigate to the folder where you extracted the app. Standalone installation requires the matching SDK 8.x release to be published.
2. Either use an IDE of your choice to build and run the project, or execute the following using the command line window:
    1. Run `npm install` in the sample folder
    2. Run `npm run dev`

Open `http://localhost:3000`. To check the production browser bundle, run `npm run build` followed by `npm run preview -- --port 3000`.
Both SDKs are bundled using their browser implementations; do not mark them external in Vite.

#### Troubleshooting

- If you are having trouble running the app from your IDE, first check if the app runs from the command line, then consult the troubleshooting references of your IDE.

#### Authentication

This example uses @azure/identity InteractiveBrowserCredential, the authentication app id used in this method is taken from the App id field, the app should be granted admin consent to Azure Data Explorer and allow the redirectUri of the url of the runing site. See steps [here](https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/identity/identity/test/manual/interactive-browser-credential)
A production app should authenticate users itself and use the `withTokenProvider` builder method of the Kusto client connectionStringBuilder.

### Run the app with local changes to the data and ingest packages

From the repository root:

```bash
npm ci
npm run dev --workspace azure-kusto-quick-start-browser
```

The samples link to the SDK workspaces automatically; do not delete modules or replace SDK ranges with local paths.
After SDK changes, run `npm run build`; Vite refreshes the optimized SDK dependencies on startup.
Use `npm run build --workspace azure-kusto-quick-start-browser` to rebuild only the sample after its own changes.
