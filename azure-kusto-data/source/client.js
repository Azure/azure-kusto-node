const request = require("request");
const uuidv4 = require("uuid/v4");
const AadHelper = require("./security");
const { KustoResponseDataSetV1, KustoResponseDataSetV2 } = require("./response");
const ConnectionStringBuilder = require("./connectionBuilder");
const ClientRequestProperties = require("./clientRequestProperties");
const pkg = require("../package.json");

module.exports = class KustoClient {
    constructor(kcsb) {
        this.connectionString = typeof (kcsb) === "string" ? new ConnectionStringBuilder(kcsb) : kcsb;
        this.cluster = this.connectionString.dataSource;
        this.endpoints = {
            mgmt: `${this.cluster}/v1/rest/mgmt`,
            query: `${this.cluster}/v2/rest/query`
        };
        this.aadHelper = new AadHelper(this.connectionString);
    }


    execute(db, query, callback, properties) {
        if (query.startsWith(".")) {
            return this.executeMgmt(db, query, callback, properties);
        }

        return this.executeQuery(db, query, callback, properties);
    }

    executeQuery(db, query, callback, properties) {
        return this._execute(this.endpoints.query, db, query, callback, properties);
    }

    executeMgmt(db, query, callback, properties) {
        return this._execute(this.endpoints.mgmt, db, query, callback, properties);
    }

    _execute(endpoint, db, query, callback, properties) {
        const payload = {
            "db": db,
            "csl": query
        };

        let timeout = null;

        if (properties != null) {
            if (properties instanceof ClientRequestProperties) {
                payload.properties = properties.toJson();
                timeout = properties.getTimeout();
            } else {
                timeout = properties.timeout;
            }
        }

        if (timeout == null) {
            if (endpoint == this.endpoints.mgmt) {                
                timeout = this._getDefaultCommandTimeout();
            } else {                
                timeout = this._getDefaultQueryTimeout();
            }
        }

        return this.aadHelper.getAuthHeader((err, authHeader) => {
            if (err) return callback(err);

            return this._doRequest(endpoint, payload, timeout, properties, callback , authHeader);
        });
    }

    _getDefaultQueryTimeout() {
        return  1000 * 60 * 4.5;
    }

    _getDefaultCommandTimeout() {
        return  1000 * 60 * 10;
    }

    _doRequest(endpoint, payload, timeout, properties, callback, authHeader) {
        const headers = {
            "Authorization": authHeader,
            "Accept": "application/json",
            "Accept-Encoding": "gzip,deflate",
            "Content-Type": "application/json; charset=utf-8",
            "Fed": "True",
            "x-ms-client-version": `Kusto.Node.Client:${pkg.version}`,
            "x-ms-client-request-id": `KNC.execute;${uuidv4()}`,
        };

        return request({
            method: "POST",
            url: endpoint,
            headers,
            json: payload,
            gzip: true,
            timeout
        }, this._getRequestCallback(properties, callback)
        );
    }

    _getRequestCallback(properties, callback) {
        const { raw } = properties || {};

        return (error, response, body) => {
            if (error) return callback(error);

            if (response.statusCode >= 200 && response.statusCode < 400) {
                if (raw === true) {
                    return callback(null, body);
                }

                let kustoResponse = null;

                try {
                    if (response.request.path.toLowerCase().startsWith("/v2/")) {
                        kustoResponse = new KustoResponseDataSetV2(body);
                    } else if (response.request.path.toLowerCase().startsWith("/v1/")) {
                        kustoResponse = new KustoResponseDataSetV1(body);
                    }

                    if (kustoResponse.getErrorsCount() > 0) {
                        return callback(`Kusto request had errors. ${kustoResponse.getExceptions()}`);
                    }
                } catch (ex) {
                    return callback(`Failed to parse response ({${response.statusCode}}) with the following error [${ex}].`);
                }


                return callback(null, kustoResponse);
            } else {
                return callback(`Kusto request erred (${response.statusCode}). ${JSON.stringify(body)}.`);
            }
        };
    }
};