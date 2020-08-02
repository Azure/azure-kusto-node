// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const moment = require("moment");
const request = require("request");
const uuidv4 = require("uuid/v4");
const AadHelper = require("./security");
const { KustoResponseDataSetV1, KustoResponseDataSetV2 } = require("./response");
const ConnectionStringBuilder = require("./connectionBuilder");
const ClientRequestProperties = require("./clientRequestProperties");
const pkg = require("../package.json");

const COMMAND_TIMEOUT_IN_MILLISECS = moment.duration(10.5, "minutes").asMilliseconds();
const QUERY_TIMEOUT_IN_MILLISECS = moment.duration(4.5, "minutes").asMilliseconds();
const CLIENT_SERVER_DELTA_IN_MILLISECS = moment.duration(0.5, "minutes").asMilliseconds();

module.exports = class KustoClient {
    constructor(kcsb) {
        this.connectionString = typeof (kcsb) === "string" ? new ConnectionStringBuilder(kcsb) : kcsb;
        this.cluster = this.connectionString.dataSource;
        this.endpoints = {
            mgmt: `${this.cluster}/v1/rest/mgmt`,
            query: `${this.cluster}/v2/rest/query`,
            ingest: `${this.cluster}/v1/rest/ingest`,
        };
        this.aadHelper = new AadHelper(this.connectionString);
        this.headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip,deflate",
            "x-ms-client-version": `Kusto.Node.Client:${pkg.version}`,
        };
    }

    execute(db, query, callback, properties) {
        query = query.trim();
        if (query.startsWith(".")) {
            return this.executeMgmt(db, query, callback, properties);
        }

        return this.executeQuery(db, query, callback, properties);
    }

    executeQuery(db, query, callback, properties) {
        return this._execute(this.endpoints.query, db, query, null, callback, properties);
    }

    executeMgmt(db, query, callback, properties) {
        return this._execute(this.endpoints.mgmt, db, query, null, callback, properties);
    }

    executeStreamingIngest(db, table, stream, streamFormat, callback, properties, mappingName) {
        let endpoint = `${this.endpoints.ingest}/${db}/${table}?streamFormat=${streamFormat}`;
        if (mappingName != null) {
            endpoint += `&mappingName=${mappingName}`;
        }

        return this._execute(endpoint, db, null, stream, callback, properties);
    }

    _execute(endpoint, db, query, stream, callback, properties) {
        let headers = {};
        Object.assign(headers, this.headers);

        let payload;
        let clientRequestPrefix = "";
        let clientRequestId;

        let timeout = this._getClientTimeout(endpoint, properties);

        if (query != null) {
            payload = {
                "db": db,
                "csl": query
            };

            if (properties != null && properties instanceof ClientRequestProperties) {
                payload.properties = properties.toJson();
                clientRequestId = properties.clientRequestId;
            }

            payload = JSON.stringify(payload);

            headers["Content-Type"] = "application/json; charset=utf-8";
            clientRequestPrefix = "KNC.execute;";
        } else if (stream != null) {
            payload = stream;
            clientRequestPrefix = "KNC.executeStreamingIngest;";
            headers["Content-Encoding"] = "gzip";
        }

        headers["x-ms-client-request-id"] = clientRequestId || clientRequestPrefix + `${uuidv4()}`;

        return this.aadHelper.getAuthHeader((err, authHeader) => {
            if (err) return callback(err);

            headers["Authorization"] = authHeader;

            return this._doRequest(endpoint, headers, payload, timeout, properties, callback);
        });
    }

    _doRequest(endpoint, headers, payload, timeout, properties, callback) {
        return request({
            method: "POST",
            url: endpoint,
            headers,
            body: payload,
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
                if (raw === true || response.request.path.toLowerCase().startsWith("/v1/rest/ingest")) {
                    return callback(null, body);
                }

                let kustoResponse = null;

                try {
                    if (response.request.path.toLowerCase().startsWith("/v2/")) {
                        kustoResponse = new KustoResponseDataSetV2(JSON.parse(body));
                    } else if (response.request.path.toLowerCase().startsWith("/v1/")) {
                        kustoResponse = new KustoResponseDataSetV1(JSON.parse(body));
                    }

                    if (kustoResponse.getErrorsCount() > 0) {
                        return callback(`Kusto request had errors. ${kustoResponse.getExceptions()}`);
                    }
                } catch (ex) {
                    return callback(`Failed to parse response ({${response.statusCode}}) with the following error [${ex}].`);
                }
                return callback(null, kustoResponse);
            } else {
                return callback(`Kusto request erred (${response.statusCode}). ${body}.`);
            }
        };
    }

    _getClientTimeout(endpoint, properties) {
        let timeout = null;
        if (properties != null) {
            var serverTimeout = properties instanceof ClientRequestProperties ? properties.getTimeout() : properties.timeout;
            if (serverTimeout != null) {
                return serverTimeout + CLIENT_SERVER_DELTA_IN_MILLISECS;
            }
        }

        timeout = endpoint == this.endpoints.query ? QUERY_TIMEOUT_IN_MILLISECS : COMMAND_TIMEOUT_IN_MILLISECS;
        return timeout;
    }
};
