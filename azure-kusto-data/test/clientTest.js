// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const assert = require("assert");
const v2Response = require("./data/response/v2");
const v2ResponseError = require("./data/response/v2error");
const v1Response = require("./data/response/v1");
const v1_2Response = require("./data/response/v1_2");
const uuidv4 = require("uuid/v4");
const moment = require("moment");
const sinon = require("sinon");

const KustoClient = require("../source/client");
const KustoClientRequestProperties = require("../source/clientRequestProperties");

describe("KustoClient", function () {
    describe("#constructor", function () {
        it("valid", function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);

            assert.equal(client.connectionString.authorityId, "common");
            assert.equal(client.connectionString.dataSource, url);

            assert.equal(client.aadHelper.authMethod, 3);
            assert.equal(client.aadHelper.kustoCluster, url);
        });
    });

    describe("#_parseResponse()", function () {
        it("valid v1", function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);

            const response = client._parseResponse({ request: { path: "/v1/mgmt/" }, data: v1Response });
            assert.equal(response.version, "1.0");
        });

        it("valid v1 more data", function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);

            const response = client._parseResponse({ request: { path: "/v1/mgmt/" }, data: v1_2Response });
            assert.equal(response.version, "1.0");
        });

        it("valid v2", function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);


            const response = client._parseResponse({ request: { path: "/v2/query/" }, data: v2Response });
            assert.equal(response.version, "2.0");
        });

        it("valid v2 raw", function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);

            const response = client._parseResponse({ request: { path: "/v2/query/" }, data: v2Response }, { raw: true });
            assert.equal(response, v2Response);
        });

        it("malformed body", function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);
            try{
                const response = client._parseResponse({ request: { path: "/v2/query/" }, data: {} });
            }
            catch(ex){
                assert.equal(ex, "Failed to parse response ({undefined}) with the following error [TypeError: data.forEach is not a function].");
                return;
            }
            assert.fail();
        });

        
        it("erred v2 not partial", function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);

            try{
                const response = client._parseResponse({ request: { path: "/v2/query/" }, data: v2ResponseError });
            }
            catch(ex){
                assert.equal(ex.startsWith("Kusto request had errors"), true);
                return;
            }
            assert.fail();
        });

        it("setTimout for request", async function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);

            let clientRequestProps = new KustoClientRequestProperties();
            let timeoutMs = moment.duration(2.51, "minutes").asMilliseconds();
            clientRequestProps.setTimeout(timeoutMs);
            client.aadHelper._getAuthHeader = () => { return "MockToken" };
            client._doRequest = (endpoint, headers, payload, timeout, properties) => {
                let payloadObj = JSON.parse(payload);
                assert.equal(payloadObj.properties.Options.servertimeout, "00:02:30.6");
                assert.equal(timeout, timeoutMs + moment.duration(0.5, "minutes").asMilliseconds());
            };

            await client.execute("Database", "Table | count", clientRequestProps);
        });

        it("setClientTimout for request", async function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);

            let clientRequestProps = new KustoClientRequestProperties();
            let timeoutMs = moment.duration(2.51, "minutes").asMilliseconds();
            clientRequestProps.setClientTimeout(timeoutMs);
            client.aadHelper._getAuthHeader = () => { return "MockToken" };
            client._doRequest = (endpoint, headers, payload, timeout, properties) => {
                let payloadObj = JSON.parse(payload);
                assert.equal(timeout, timeoutMs);
            };

            await client.execute("Database", "Table | count", clientRequestProps);
        });

        it("default timeout for query", async function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);

            client.aadHelper._getAuthHeader = () => { return "MockToken" };
            client._doRequest = (endpoint, headers, payload, timeout, properties) => {
                assert.equal(timeout, moment.duration(4.5, "minutes").asMilliseconds());
            };

            await client.execute("Database", "Table | count", () => { });
        });

        it("default timeout for admin", async function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);
            client.aadHelper._getAuthHeader = () => { return "MockToken" };
            client._doRequest = (endpoint, headers, payload, timeout, properties) => {
                assert.equal(timeout, moment.duration(10.5, "minutes").asMilliseconds());
            };

            await client.execute("Database", ".show database DataBase schema");
        });

        it("set clientRequestId for request", async function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);
            const clientRequestId = `MyApp.MyActivity;${uuidv4()}`;

            let clientRequestProps = new KustoClientRequestProperties();
            clientRequestProps.clientRequestId = clientRequestId;
            client.aadHelper._getAuthHeader = () => { return "MockToken" };
            client._doRequest = (endpoint, headers, payload, timeout, properties) => {
                assert.equal(headers["x-ms-client-request-id"], clientRequestId);
            };

            await client.execute("Database", "Table | count", clientRequestProps);
        });
    });
});
