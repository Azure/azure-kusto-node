// Exports everything from index.ts, plus azure-kusto-data
// Since this is not a replacement for index.ts, it is not named index.browser.ts and is not referenced in package.json

import * as ingest from "./index";
import * as data from "azure-kusto-data";

export { ingest, data };
