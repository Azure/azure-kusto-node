// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const assert = require("assert");
const v2Response = require("./data/response/v2");
const v2ResponseError = require("./data/response/v2error");
const v1Response = require("./data/response/v1");
const v1_2Response = require("./data/response/v1_2");
const uuidv4 = require("uuid/v4");

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

    describe("#_getRequestCallback()", function () {
        it("valid v1", function (done) {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);


            let reqCb = client._getRequestCallback(null, (err, response) => {
                assert.equal(response.version, "1.0");
                done();
            });

            reqCb(null, { statusCode: 200, request: { path: "/v1/mgmt/" } }, JSON.stringify(v1Response));
        });

        it("valid v1 more data", function (done) {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);


            let reqCb = client._getRequestCallback(null, (err, response) => {
                assert.equal(response.version, "1.0");
                done();
            });

            reqCb(null, { statusCode: 200, request: { path: "/v1/mgmt/" } }, JSON.stringify(v1_2Response));
        });

        it("valid v2", function (done) {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);


            let reqCb = client._getRequestCallback(null, (err, response) => {
                assert.equal(response.version, "2.0");
                done();
            });

            reqCb(null, { statusCode: 200, request: { path: "/v2/query/" } }, JSON.stringify(v2Response));
        });

        it("valid v2 raw", function (done) {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);


            let reqCb = client._getRequestCallback({ raw: true }, (err, response) => {
                assert.equal(response, v2Response);
                done();
            });

            reqCb(null, { statusCode: 200, request: { path: "/v2/query/" } }, v2Response);
        });

        it("setTimout for request", function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);

            let clientRequestProps = new KustoClientRequestProperties();
            clientRequestProps.setTimeout(10);
            client.aadHelper.getAuthHeader = (callback) => callback(null, "MockToken");
            client._doRequest = (endpoint, payload, timeout, properties, callback) => {
                assert.equal(properties.toString(), JSON.stringify({ "Options": { "servertimeout": 10 } }));
                callback(v2Response);                
            };

            client.execute("Database", "Table | count" , () => {}, clientRequestProps);
        });

        it("default timeout for query", function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);
            
            client.aadHelper.getAuthHeader = (callback) => callback(null, "MockToken");
            client._doRequest = (endpoint, payload, timeout, properties, callback) => {
                assert.equal(timeout, client._getDefaultQueryTimeout());
                callback(v2Response);                
            };

            client.execute("Database", "Table | count" , () => {});
        });

        it("default timeout for admin", function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);
            
            client.aadHelper.getAuthHeader = (callback) => callback(null, "MockToken");
            client._doRequest = (endpoint, payload, timeout, properties, callback) => {
                assert.equal(timeout, client._getDefaultCommandTimeout());
                callback(v2Response);                
            };

            client.execute("Database", ".show database DataBase schema" , () => {});
        });

        it("erred v2 not partial", function (done) {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);


            let reqCb = client._getRequestCallback(null, (err, response) => {
                assert.equal(err.startsWith("Kusto request had errors"), true);
                assert.equal(response, null);
                done();
            });

            reqCb(null, { statusCode: 200, request: { path: "/v2/query/" } }, JSON.stringify(v2ResponseError));
        });

        it("304 status", function (done) {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);


            let reqCb = client._getRequestCallback(null, (err, response) => {
                assert.equal(response.version, "2.0");
                done();
            });

            reqCb(null, { statusCode: 304, request: { path: "/v2/query/" } }, JSON.stringify(v2Response));
        });

        it("404 status", function (done) {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);


            let reqCb = client._getRequestCallback(null, (err, response) => {
                assert.equal(response, null);
                assert.equal(err.startsWith("Kusto request erred (404)."), true);
                done();
            });

            reqCb(null, { statusCode: 404, request: { path: "/v2/query/" } }, v2Response);
        });

        it("malformed body", function (done) {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);


            let reqCb = client._getRequestCallback(null, (err, response) => {
                assert.equal(response, null);
                assert.equal(err, "Failed to parse response ({200}) with the following error [TypeError: data.forEach is not a function].");
                done();
            });

            reqCb(null, { statusCode: 200, request: { path: "/v2/query/" } }, JSON.stringify({}));
        });

        it("set clientRequestId for request", function () {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);
            const clientRequestId = `MyApp.MyActivity;${uuidv4()}`;

            let clientRequestProps = new KustoClientRequestProperties();
            clientRequestProps.clientRequestId = clientRequestId;
            client.aadHelper.getAuthHeader = (callback) => callback(null, "MockToken");
            client._doRequest = (endpoint, payload, timeout, properties, callback) => {
                assert.equal(properties.clientRequestId, clientRequestId);
                callback(v2Response);                
            };

            client.execute("Database", "Table | count" , () => {}, clientRequestProps);
        });
    });
});
