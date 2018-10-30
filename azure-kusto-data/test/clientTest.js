const assert = require("assert");
const v2Response = require("./data/response/v2");
const v2ResponseError = require("./data/response/v2error");
const v1Response = require("./data/response/v1");


const KustoClient = require("../source/client");

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

            reqCb(null, { statusCode: 200, request: { path: "/v1/mgmt/" } }, v1Response);
        });

        it("valid v2", function (done) {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);


            let reqCb = client._getRequestCallback(null, (err, response) => {
                assert.equal(response.version, "2.0");
                done();
            });

            reqCb(null, { statusCode: 200, request: { path: "/v2/query/" } }, v2Response);
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

        it("erred v2 partial", function (done) {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);


            let reqCb = client._getRequestCallback({ partial: true }, (err, response) => {
                assert.equal(response.version, "2.0");
                done();
            });

            reqCb(null, { statusCode: 200, request: { path: "/v2/query/" } }, v2ResponseError);
        });

        it("erred v2 not partial", function (done) {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);


            let reqCb = client._getRequestCallback(null, (err, response) => {
                assert.equal(err.startsWith("Kusto request had errors"), true);
                assert.equal(response, null);
                done();
            });

            reqCb(null, { statusCode: 200, request: { path: "/v2/query/" } }, v2ResponseError);
        });

        it("304 status", function (done) {
            let url = "https://cluster.kusto.windows.net";
            let client = new KustoClient(url);


            let reqCb = client._getRequestCallback(null, (err, response) => {
                assert.equal(response.version, "2.0");
                done();
            });

            reqCb(null, { statusCode: 304, request: { path: "/v2/query/" } }, v2Response);
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
                assert.equal(err, "Failed to parse response ({200}) with the following error [TypeError: data.filter is not a function].");
                done();
            });

            reqCb(null, { statusCode: 200, request: { path: "/v2/query/" } }, {});
        });
    });
});