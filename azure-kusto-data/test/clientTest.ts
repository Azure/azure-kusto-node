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

// tslint:disable-next-line:no-var-requires
const v2Response = require("./data/response/v2");
// tslint:disable-next-line:no-var-requires
const v2ResponseError = require("./data/response/v2error");
// tslint:disable-next-line:no-var-requires
const v1Response = require("./data/response/v1");
// tslint:disable-next-line:no-var-requires variable-name
const v1_2Response = require("./data/response/v1_2");

enum ExecutionType {
    Mgmt = "mgmt",
    Query = "query",
    Ingest = "ingest",
    QueryV1 = "queryv1",
}

describe("KustoClient", function () {
    describe("#constructor", function () {
        it("valid", function () {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            assert.equal(client.connectionString.authorityId, "common");
            assert.equal(client.connectionString.dataSource, url);
        });
    });

    describe("#_parseResponse()", function () {
        it("valid v1", function () {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const response = client._parseResponse(v1Response, ExecutionType.Mgmt);
            assert.equal((response as KustoResponseDataSetV1).version, "1.0");
        });

        it("valid v1 more data", function () {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const response = client._parseResponse(v1_2Response, ExecutionType.QueryV1);
            assert.equal((response as KustoResponseDataSetV1).version, "1.0");
        });

        it("valid v2", function () {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);


            const response = client._parseResponse(v2Response, ExecutionType.Query);
            assert.equal((response as KustoResponseDataSetV2).version, "2.0");
        });

        it("valid v2 raw", function () {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const response = client._parseResponse(v2Response, ExecutionType.Query, { raw: true } as ClientRequestProperties);
            assert.equal(response, v2Response);
        });

        it("malformed body", function () {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);
            try{
                client._parseResponse({}, ExecutionType.Query);
            }
            catch(ex){
                ex.message.startsWith("Failed to parse response ({undefined}) with the following error [TypeError: data.forEach is not a function].");
                return;
            }
            assert.fail();
        });

        it("erred v2 not partial", function () {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            try{
                client._parseResponse(v2ResponseError, ExecutionType.Query);
            }
            catch(ex){
                assert.equal(ex.message.startsWith("Kusto request had errors"), true);
                return;
            }
            assert.fail();
        });

        it("setTimout for request", async function () {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const clientRequestProps = new ClientRequestProperties();
            const timeoutMs = moment.duration(2.51, "minutes").asMilliseconds();
            clientRequestProps.setTimeout(timeoutMs);
            client.aadHelper._getAuthHeader = () => { return Promise.resolve("MockToken") };
            client._doRequest = (_endpoint, _executionType, _headers, payload, timeout) => {
                const payloadObj = JSON.parse(payload);
                assert.equal(payloadObj.properties.Options.servertimeout, "00:02:30.6");
                assert.equal(timeout, timeoutMs + moment.duration(0.5, "minutes").asMilliseconds());
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", "Table | count", clientRequestProps);
        });

        it("setClientTimout for request", async function () {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const clientRequestProps = new ClientRequestProperties();
            const timeoutMs = moment.duration(2.51, "minutes").asMilliseconds();
            clientRequestProps.setClientTimeout(timeoutMs);
            client.aadHelper._getAuthHeader = () => { return Promise.resolve("MockToken") };
            client._doRequest = (_endpoint, _executionType, _headers, payload, timeout) => {
                JSON.parse(payload);
                assert.equal(timeout, timeoutMs);
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", "Table | count", clientRequestProps);
        });

        it("default timeout for query", async function () {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            client.aadHelper._getAuthHeader = () => { return Promise.resolve("MockToken") };
            client._doRequest = (_endpoint, _executionType, _headers, _payload, timeout) => {
                assert.equal(timeout, moment.duration(4.5, "minutes").asMilliseconds());
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", "Table | count");
        });

        it("default timeout for admin", async function () {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);
            client.aadHelper._getAuthHeader = () => { return Promise.resolve("MockToken") };
            client._doRequest = (_endpoint, _executionType, _headers, _payload, timeout) => {
                assert.equal(timeout, moment.duration(10.5, "minutes").asMilliseconds());
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", ".show database DataBase schema");
        });

        it("set clientRequestId for request", async function () {
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
                assert.equal(headers["x-ms-client-request-id"], clientRequestId);
                assert.equal(headers["x-ms-app"], application);
                assert.equal(headers["x-ms-user"], user);
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", "Table | count", clientRequestProps);
        });

        it("executeQueryV1", async function () {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            client.aadHelper._getAuthHeader = () => { return Promise.resolve("MockToken") };
            client._doRequest = (endpoint, executionType, _headers, _payload, _timeout, _properties) => {
                assert.equal(endpoint, `${url}/v1/rest/query`);
                assert.equal(executionType, ExecutionType.QueryV1);
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.executeQueryV1("Database", "Table | count");
        });
    });
});
