// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import http from "http";
import { AddressInfo } from "net";

import axios from "axios";

import { KustoClient } from "../src/client.js";
import { ClientRequestProperties } from "../src/clientRequestProperties.js";
import { CloudSettings } from "../src/cloudSettings.js";
import v1Response from "./data/response/v1.js";
import v2Response from "./data/response/v2.js";

describe("ClientRequestProperties.abortSignal", () => {
    let server: http.Server;
    let cluster: string;
    let onSlowQuery: () => void;
    let onCancelCommand: (csl: string) => void;

    beforeAll(async () => {
        // Holds "slow" queries open, answers everything else.
        server = http.createServer((req, res) => {
            let body = "";
            req.on("data", (chunk: Buffer) => (body += chunk.toString()));
            req.on("end", () => {
                const { csl } = JSON.parse(body) as { csl: string };
                if (csl === "slow") {
                    onSlowQuery();
                    return;
                }
                if (req.url === "/v1/rest/mgmt") {
                    onCancelCommand(csl);
                }
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(req.url === "/v2/rest/query" ? v2Response : v1Response));
            });
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        cluster = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        CloudSettings.writeToCache(cluster);
    });

    afterAll(async () => {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    });

    it("aborts only that query, and cancels it on the service", async () => {
        const client = new KustoClient(cluster);
        client.aadHelper.getAuthHeader = () => Promise.resolve(null);
        const slowQueryArrived = new Promise<void>((resolve) => (onSlowQuery = resolve));
        const cancelCommand = new Promise<string>((resolve) => (onCancelCommand = resolve));

        const controller = new AbortController();
        const properties = new ClientRequestProperties();
        properties.clientRequestId = "MyApp.Query;slow-1";
        properties.abortSignal = controller.signal;
        const slow = client.execute("db", "slow", properties);
        await slowQueryArrived;
        controller.abort();

        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("the aborted query did not settle")), 2000));
        await assert.rejects(Promise.race([slow, timeout]), (e: unknown) => axios.isCancel(e));
        assert.strictEqual(await Promise.race([cancelCommand, timeout]), '.cancel query "MyApp.Query;slow-1"');

        const other = await client.execute("db", "fast");
        assert.strictEqual(other.primaryResults.length, 1);
    });

    it("does not send a request when already aborted", async () => {
        const client = new KustoClient(cluster);
        client.aadHelper.getAuthHeader = () => Promise.resolve(null);

        const properties = new ClientRequestProperties();
        properties.abortSignal = AbortSignal.abort();
        await assert.rejects(client.execute("db", "fast", properties), (e: unknown) => axios.isCancel(e));
    });
});
