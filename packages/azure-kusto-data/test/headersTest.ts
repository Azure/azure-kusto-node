// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { ClientDetails } from "../src/clientDetails";
import assert from "assert";

describe("Test Headers", () => {
    it("Should work with default tracing properties", () => {
        const clientDetails = new ClientDetails(null, null);
        const headers = clientDetails.getHeaders();
        assert.strictEqual(headers["x-ms-client-version"]?.startsWith("Kusto.JavaScript.Client:"), true);
        assert.notStrictEqual(headers["x-ms-user"], null);
        assert.notStrictEqual(headers["x-ms-app"], null);
    });

    it("Should work with custom tracing properties", () => {
        const clientDetails = ClientDetails.setConnectorDetails("test", "1.0", true, null, "testApp", "1.0", [["test", "test"]]);
        const headers = clientDetails.getHeaders();
        assert.strictEqual(headers["x-ms-client-version"]?.startsWith("Kusto.JavaScript.Client:"), true);
        assert.strictEqual(headers["x-ms-app"], "Kusto.test:{1.0}|App.{testApp}:{1.0}|test:{test}");
        assert.notStrictEqual(headers["x-ms-user"], "[none]");
    });

    it("Should work with no user", () => {
        const clientDetails = ClientDetails.setConnectorDetails("test", "1.0", false, null, "testApp", "1.0", [["test", "test"]]);
        const headers = clientDetails.getHeaders();
        assert.strictEqual(headers["x-ms-client-version"]?.startsWith("Kusto.JavaScript.Client:"), true);
        assert.strictEqual(headers["x-ms-app"], "Kusto.test:{1.0}|App.{testApp}:{1.0}|test:{test}");
        assert.strictEqual(headers["x-ms-user"], "[none]");
    });

    it("Should work with no app", () => {
        const clientDetails = ClientDetails.setConnectorDetails("test", "1.0", true, null, null, null, [["test", "test"]]);
        const headers = clientDetails.getHeaders();
        assert.strictEqual(headers["x-ms-client-version"]?.startsWith("Kusto.JavaScript.Client:"), true);
        assert.strictEqual(headers["x-ms-app"]?.startsWith("Kusto.test:{1.0}|App."), true);
        assert.notStrictEqual(headers["x-ms-user"], "[none]");
    });

    it("Should work with override user", () => {
        const clientDetails = ClientDetails.setConnectorDetails("test", "1.0", true, "testUser", "testApp", "1.0", [["test", "test"]]);
        const headers = clientDetails.getHeaders();
        assert.strictEqual(headers["x-ms-client-version"]?.startsWith("Kusto.JavaScript.Client:"), true);
        assert.strictEqual(headers["x-ms-app"], "Kusto.test:{1.0}|App.{testApp}:{1.0}|test:{test}");
        assert.strictEqual(headers["x-ms-user"], "testUser");
    });

    it("Should work with no additional fields", () => {
        const clientDetails = ClientDetails.setConnectorDetails("test", "1.0", true, null, "testApp", "1.0", null);
        const headers = clientDetails.getHeaders();
        assert.strictEqual(headers["x-ms-client-version"]?.startsWith("Kusto.JavaScript.Client:"), true);
        assert.strictEqual(headers["x-ms-app"], "Kusto.test:{1.0}|App.{testApp}:{1.0}");
        assert.notStrictEqual(headers["x-ms-user"], "[none]");
    });
});
