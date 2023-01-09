# Microsoft Azure Kusto (Azure Data Explorer) SDK for JavaScript
![Github Actions Build](https://github.com/Azure/azure-kusto-node/actions/workflows/build.yml/badge.svg)

This repository is for JavaScript (Node.js & Browser) and it contains the following SDKs:
* **Azure Kusto Data SDK**: Execute queries against a Kusto Cluster. [docs](./packages/azure-kusto-data/README.md)
* **Azure Kusto Ingest SDK**: Ingest Data into a Kusto Cluster. [docs](./packages/azure-kusto-ingest/README.md)


General docs are located at https://docs.microsoft.com/en-us/azure/data-explorer/


The SDK team publishes the SDKs as [npm](https://npmjs.org) packages:
- **Azure Kusto Data SDK**
  - [Kusto Query Client](https://www.npmjs.com/package/azure-kusto-data) [![npm version](https://badge.fury.io/js/azure-kusto-data.svg)](https://badge.fury.io/js/azure-kusto-data) [![npm](https://img.shields.io/npm/dt/azure-kusto-data.svg)](https://github.com/Azure/azure-kusto-node)
- **Azure Kusto Ingest SDK**
  - [Kusto Ingest Client](https://www.npmjs.com/package/azure-kusto-ingest) [![npm version](https://badge.fury.io/js/azure-kusto-ingest.svg)](https://badge.fury.io/js/azure-kusto-ingest) 
[![npm](https://img.shields.io/npm/dt/azure-kusto-ingest.svg)](https://github.com/Azure/azure-kusto-node)

## Need Support?
- **Have a feature request for SDKs?** Please post it on [User Voice](https://feedback.azure.com/forums/915733-azure-data-explorer) to help us prioritize
- **Have a technical question?** Ask on [Stack Overflow with tag "azure-data-explorer"](https://stackoverflow.com/questions/tagged/azure-data-explorer)
- **Need Support?** Every customer with an active Azure subscription has access to [support](https://docs.microsoft.com/en-us/azure/azure-supportability/how-to-create-azure-support-request) with guaranteed response time.  Consider submitting a ticket and get assistance from Microsoft support team
- **Found a bug?** Please help us fix it by thoroughly documenting it and [filing an issue](https://github.com/Azure/azure-kusto-node/issues/new).

## Examples

In the repository, you will find a set of simple samples that will help you get started:
- [Data SDK samples](./packages/azure-kusto-data/example.js)
- [Ingestion SDK samples](./packages/azure-kusto-ingest/example.js)

## Best Practices
See the SDK [best practices guide](https://docs.microsoft.com/azure/data-explorer/kusto/api/netfx/kusto-ingest-best-practices), which though written for the .NET SDK, applies similarly here.

## Platforms compatibility

The Azure Kusto SDK for is built for Node **v14.x.x** and above.

## Looking for SDKs for other languages/platforms?
- [Python](https://github.com/azure/azure-kusto-python)
- [Java](https://github.com/azure/azure-kusto-java)
- [.NET](https://docs.microsoft.com/en-us/azure/kusto/api/netfx/about-the-sdk)


# Contribute

We gladly accept community contributions.

- Issues: Please report bugs using the Issues section of GitHub
- Forums: Interact with the development teams on StackOverflow or the Microsoft Azure Forums
- Source Code Contributions: If you would like to become an active contributor to this project please follow the instructions provided in [Contributing.md](CONTRIBUTING.md).

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

For general suggestions about Microsoft Azure please use our [UserVoice forum](http://feedback.azure.com/forums/34192--general-feedback).


# Bundling Azure SDK libraries for a browser
To use Azure SDK libraries on a website, you need to convert your code to work inside the browser. You do this using a tool called a bundler. This process takes JavaScript code written using Node.js conventions and converts it into a format that is understood by browsers. Read [here](https://github.com/Azure/azure-sdk-for-js/blob/main/documentation/Bundling.md) for more info and examples.

### Browser sample

The main differences between the browser implementation and Node.js in the run are that ingestFromFile accepts a Blob object and
ingestFromStream accepts an ArrayBuffer. Fallback files are called '*.browser.ts'.

To run a quick sample for azure-kusto-ingest we provided a webpack config which uses the file index.html which runs index.js as a script.
First add to index.ts:

import {main} from "../exampleBrowser"
main().catch(e=>console.log(e)) 

Then run: npm run webpack