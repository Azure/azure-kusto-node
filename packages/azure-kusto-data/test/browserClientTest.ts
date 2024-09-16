// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable no-console */

import assert from "assert";
import { KustoConnectionStringBuilder as ConnectionStringBuilder } from "../src/connectionBuilder.browser.js";

const cluster = "https://somecluster.kusto.windows.net";

describe("Kcsb", () => {
    it.concurrent("Fail to create non-browser compatible authentication", () => {
        try {
            ConnectionStringBuilder.withAadApplicationKeyAuthentication(cluster, "", "");
        } catch (ex) {
            assert(ex instanceof Error && ex.message.startsWith("Not supported in browser"));
            return;
        }

        assert.fail();
    });
    it.concurrent("Create browser compatible authentication with params", () => {
        ConnectionStringBuilder.withUserPrompt(cluster, { redirectUri: "redirect", clientId: "cid" });
    });
    it.concurrent("Create browser compatible authentication must provide clientId", () => {
        try {
            ConnectionStringBuilder.withUserPrompt(cluster, { redirectUri: "redirect" });
        } catch (ex) {
            assert((ex as Error).message.startsWith("Invalid parameters"));
            return;
        }

        assert.fail();
    });
    it.concurrent("Create browser compatible authentication must provide redirectUri", () => {
        try {
            ConnectionStringBuilder.withUserPrompt(cluster, { clientId: "cid" });
        } catch (ex) {
            assert((ex as Error).message.startsWith("Invalid parameters"));
            return;
        }

        assert.fail();
    });
});
