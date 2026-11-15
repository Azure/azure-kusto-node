### Prerequisites

1. Set up **Node.js >=22.12.0** and **npm 11.21.2** on your machine. Prefer a current patched LTS release; use `npm install --global npm@11.21.2` to select npm.

### Instructions

1. Download the app as a ZIP file.
2. Extract the app source code.
   **Note**: The configuration parameters in `src/kusto_sample_config.json` are preconfigured for your cluster. Verify them before running: the sample can create/alter tables and ingest data. Standalone installation requires the matching SDK 8.x release to be published.
3. Open a command line window and navigate to the folder where you extracted the app.
4. Run `npm install` in the folder.
5. Run `npm run quick_start` to compile the ESM app and execute `dist/main.js`.

Configuration and relative dataset paths resolve under `src/`; absolute dataset paths are supported.

### Troubleshooting

- If you are having trouble running the script from your IDE, first check if the script runs from command line, then consult the troubleshooting references of
  your IDE.
