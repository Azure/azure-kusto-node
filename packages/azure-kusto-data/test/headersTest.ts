// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { ClientDetails } from "../src/clientDetails.js";
import assert from "assert";

describe("Test Headers", () => {
    it.concurrent("Should work with default tracing properties", () => {
        const clientDetails = new ClientDetails(null, null);
        const headers = clientDetails.getHeaders();
        assert.strictEqual(headers["x-ms-client-version"]?.startsWith("Kusto.JavaScript.Client:"), true);
        assert.notStrictEqual(headers["x-ms-user"], null);
        assert.notStrictEqual(headers["x-ms-app"], null);
    });

    it.concurrent("Should work with custom tracing properties", () => {
        const clientDetails = ClientDetails.setConnectorDetails("test", "1.0", "testApp", "1.0", true, null, [["test", "test"]]);
        const headers = clientDetails.getHeaders();
        assert.strictEqual(headers["x-ms-client-version"]?.startsWith("Kusto.JavaScript.Client:"), true);
        assert.strictEqual(headers["x-ms-app"], "Kusto.test:{1.0}|App.{testApp}:{1.0}|test:{test}");
        assert.notStrictEqual(headers["x-ms-user"], "[none]");
    });

    it.concurrent("Should work with no user", () => {
        const clientDetails = ClientDetails.setConnectorDetails("test", "1.0", "testApp", "1.0", false, null, [["test", "test"]]);
        const headers = clientDetails.getHeaders();
        assert.strictEqual(headers["x-ms-client-version"]?.startsWith("Kusto.JavaScript.Client:"), true);
        assert.strictEqual(headers["x-ms-app"], "Kusto.test:{1.0}|App.{testApp}:{1.0}|test:{test}");
        assert.strictEqual(headers["x-ms-user"], "[none]");
    });

    it.concurrent("Should work with no app", () => {
        const clientDetails = ClientDetails.setConnectorDetails("test", "1.0", null, null, true, null, [["test", "test"]]);
        const headers = clientDetails.getHeaders();
        assert.strictEqual(headers["x-ms-client-version"]?.startsWith("Kusto.JavaScript.Client:"), true);
        assert.strictEqual(headers["x-ms-app"]?.startsWith("Kusto.test:{1.0}|App."), true);
        assert.notStrictEqual(headers["x-ms-user"], "[none]");
    });

    it.concurrent("Should work with override user", () => {
        const clientDetails = ClientDetails.setConnectorDetails("test", "1.0", "testApp", "1.0", true, "testUser", [["test", "test"]]);
        const headers = clientDetails.getHeaders();
        assert.strictEqual(headers["x-ms-client-version"]?.startsWith("Kusto.JavaScript.Client:"), true);
        assert.strictEqual(headers["x-ms-app"], "Kusto.test:{1.0}|App.{testApp}:{1.0}|test:{test}");
        assert.strictEqual(headers["x-ms-user"], "testUser");
    });

    it.concurrent("Should work with no additional fields", () => {
        const clientDetails = ClientDetails.setConnectorDetails("test", "1.0", "testApp", "1.0", true, null, null);
        const headers = clientDetails.getHeaders();
        assert.strictEqual(headers["x-ms-client-version"]?.startsWith("Kusto.JavaScript.Client:"), true);
        assert.strictEqual(headers["x-ms-app"], "Kusto.test:{1.0}|App.{testApp}:{1.0}");
        assert.notStrictEqual(headers["x-ms-user"], "[none]");
    });

    it.concurrent("Should remove unwanted characters", () => {
        const clientDetails = ClientDetails.setConnectorDetails("Café", "1 . 0", "my|test\\{}\\app", new Array(1024).join("s"), true, null, null);
        const headers = clientDetails.getHeaders();
        assert.strictEqual(headers["x-ms-client-version"]?.startsWith("Kusto.JavaScript.Client:"), true);
        assert.strictEqual(
            headers["x-ms-app"],
            "Kusto.Caf_:{1_._0}|App.{my_test____app}:{ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss}",
        );
        assert.notStrictEqual(headers["x-ms-user"], "[none]");
    });
});
