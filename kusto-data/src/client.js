const request = require("request");
const uuidv4 = require("uuid/v4");
const AadHelper = require("./security");
const { KustoResponseDataSetV1, KustoResponseDataSetV2 } = require("./response");
const pkg = { version: "1.0.0" };//require("../package.json");

module.exports = class KustoClient {
    constructor(kcsb) {
        this.cluster = kcsb.dataSource;
        this.endpoints = {
            mgmt: `${this.cluster}/v1/rest/mgmt`,
            query: `${this.cluster}/v2/rest/query`
        };
        this.aadHelper = new AadHelper(kcsb);
    }

    execute(db, query, acceptPartialResults, timeout, rawResponse, callback) {
        if (query.startsWith(".")) {
            return this.executeMgmt(db, query, acceptPartialResults, timeout, rawResponse, callback);
        }

        return this.executeQuery(db, query, acceptPartialResults, timeout, rawResponse, callback);
    }

    executeQuery(db, query, acceptPartialResults, timeout, rawResponse, callback) {
        return this._execute(this.endpoints.query, db, query, acceptPartialResults, timeout, rawResponse, callback);
    }

    executeMgmt(db, query, acceptPartialResults, timeout, rawResponse, callback) {
        return this._execute(this.endpoints.mgmt, db, query, acceptPartialResults, timeout, rawResponse, callback);
    }

    // TODO: refactor this a bit (callback hell...)
    _execute(endpoint, db, query, acceptPartialResults, timeout, rawResponse, callback) {
        let doRequest = (authHeader, cb) => {
            const payload = {
                "db": db,
                "csl": query
            };

            const headers = {
                "Authorization": authHeader,
                "Accept": "application/json",
                "Accept-Encoding": "gzip,deflate",
                "Content-Type": "application/json; charset=utf-8",
                "Fed": "True",
                "x-ms-client-version": `Kusto.Node.Client:${pkg.version}`,
                "x-ms-client-request-id": `KPC.execute;${uuidv4()}`,
            };

            request({
                method: "POST",
                url: endpoint,
                headers,
                json: payload,
                gzip:true,
                timeout
            }, (error, response, body) => {
                if (error) return cb(error, null);

                if (response.statusCode == 200) {
                    if (rawResponse) {
                        return cb(null, rawResponse);
                    }

                    let kustoResponse = null;
                    if (endpoint) {
                        kustoResponse = new KustoResponseDataSetV2(body);
                    } else {
                        kustoResponse = new KustoResponseDataSetV1(body);
                    }

                    if (kustoResponse.getErrorsCount() > 0 && !acceptPartialResults) {
                        cb(`Kusto request had errors. ${kustoResponse.getExceptions()}`, null);
                    }

                    return cb(null, kustoResponse);
                } else {
                    return cb(`Kusto request erred (${response.statusCode}). ${body}.`, null);
                }
            });
        };

        return this.aadHelper.getAuthHeader((err, authHeader) => {
            if (err) return callback(err, null);

            return doRequest(authHeader, callback);
        });
    }
};