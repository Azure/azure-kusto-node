// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";

import { v4 as uuidv4 } from 'uuid';
import moment from "moment";

import {KustoClient} from "../source/client";

import {ClientRequestProperties} from "../source/clientRequestProperties";
import {
    KustoResponseDataSetV1,
    KustoResponseDataSetV2
} from "../source/response";

import v2Response from "./data/response/v2.json";
import v2ResponseError from "./data/response/v2error.json";
import v1Response from "./data/response/v1.json";
import v1_2Response from "./data/response/v1_2.json";

enum ExecutionType {
    Mgmt = "mgmt",
    Query = "query",
    Ingest = "ingest",
    QueryV1 = "queryv1",
}

describe("KustoClient", () => {
    describe("#constructor", () => {
        it("valid", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            assert.strictEqual(client.connectionString.authorityId, "common");
            assert.strictEqual(client.connectionString.dataSource, url);
        });
    });

    describe("#_parseResponse()", () => {
        it("valid v1", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const response = client._parseResponse(v1Response, ExecutionType.Mgmt);
            assert.strictEqual((response as KustoResponseDataSetV1).version, "1.0");
        });

        it("valid v1 more data", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const response = client._parseResponse(v1_2Response, ExecutionType.QueryV1);
            assert.strictEqual((response as KustoResponseDataSetV1).version, "1.0");
        });

        it("valid v2", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);


            const response = client._parseResponse(v2Response, ExecutionType.Query);
            assert.strictEqual((response as KustoResponseDataSetV2).version, "2.0");
        });

        it("valid v2 raw", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const response = client._parseResponse(v2Response, ExecutionType.Query, { raw: true } as ClientRequestProperties);
            assert.strictEqual(response, v2Response);
        });

        it("malformed body", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);
            try{
                client._parseResponse({}, ExecutionType.Query);
            }
            catch(ex){
                assert( ex instanceof Error && ex.message.startsWith("Failed to parse response ({undefined}) with the following error [TypeError:" +
                    " data.forEach is" +
                    " not a function]."));
                return;
            }
            assert.fail();
        });

        it("erred v2 not partial", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            try{
                client._parseResponse(v2ResponseError, ExecutionType.Query);
            }
            catch(ex){
                assert( ex instanceof Error && ex.message.startsWith("Kusto request had errors"));
                return;
            }
            assert.fail();
        });

        it("setTimout for request", async () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const clientRequestProps = new ClientRequestProperties();
            const timeoutMs = moment.duration(2.51, "minutes").asMilliseconds();
            clientRequestProps.setTimeout(timeoutMs);
            client.aadHelper._getAuthHeader = () => { return Promise.resolve("MockToken") };
            client._doRequest = (_endpoint, _executionType, _headers, payload, timeout) => {
                const payloadObj = JSON.parse(payload);
                assert.strictEqual(payloadObj.properties.Options.servertimeout, "00:02:30.6");
                assert.strictEqual(timeout, timeoutMs + moment.duration(0.5, "minutes").asMilliseconds());
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", "Table | count", clientRequestProps);
        });

        it("setClientTimout for request", async () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const clientRequestProps = new ClientRequestProperties();
            const timeoutMs = moment.duration(2.51, "minutes").asMilliseconds();
            clientRequestProps.setClientTimeout(timeoutMs);
            client.aadHelper._getAuthHeader = () => { return Promise.resolve("MockToken") };
            client._doRequest = (_endpoint, _executionType, _headers, payload, timeout) => {
                JSON.parse(payload);
                assert.strictEqual(timeout, timeoutMs);
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", "Table | count", clientRequestProps);
        });

        it("default timeout for query", async () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            client.aadHelper._getAuthHeader = () => { return Promise.resolve("MockToken") };
            client._doRequest = (_endpoint, _executionType, _headers, _payload, timeout) => {
                assert.strictEqual(timeout, moment.duration(4.5, "minutes").asMilliseconds());
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", "Table | count");
        });

        it("default timeout for admin", async () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);
            client.aadHelper._getAuthHeader = () => { return Promise.resolve("MockToken") };
            client._doRequest = (_endpoint, _executionType, _headers, _payload, timeout) => {
                assert.strictEqual(timeout, moment.duration(10.5, "minutes").asMilliseconds());
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", ".show database DataBase schema");
        });

        it("set clientRequestId for request", async () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);
            const clientRequestId = `MyApp.MyActivity;${uuidv4()}`;
            const application = "app1";
            const user = "user1";

            const clientRequestProps = new ClientRequestProperties();
            clientRequestProps.clientRequestId = clientRequestId;
            clientRequestProps.application = application;
            clientRequestProps.user = user;
            client.aadHelper._getAuthHeader = () => { return Promise.resolve("MockToken") };
            client._doRequest = (_endpoint, _executionType, headers) => {
                assert.strictEqual(headers["x-ms-client-request-id"], clientRequestId);
                assert.strictEqual(headers["x-ms-app"], application);
                assert.strictEqual(headers["x-ms-user"], user);
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", "Table | count", clientRequestProps);
        });

        it("executeQueryV1", async () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            client.aadHelper._getAuthHeader = () => { return Promise.resolve("MockToken") };
            client._doRequest = (endpoint, executionType, _headers, _payload, _timeout, _properties) => {
                assert.strictEqual(endpoint, `${url}/v1/rest/query`);
                assert.strictEqual(executionType, ExecutionType.QueryV1);
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.executeQueryV1("Database", "Table | count");
        });
    });
});
