// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const moment = require("moment");
const uuidv4 = require("uuid/v4");
const AadHelper = require("./security");
const { KustoResponseDataSetV1, KustoResponseDataSetV2 } = require("./response");
const ConnectionStringBuilder = require("./connectionBuilder");
const ClientRequestProperties = require("./clientRequestProperties");
const pkg = require("../package.json");
const axios = require("axios");

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

    async execute(db, query, properties) {
        query = query.trim();
        if (query.startsWith(".")) {
            return this.executeMgmt(db, query, properties);
        }

        return this.executeQuery(db, query, properties);
    }

    async executeQuery(db, query, properties) {
        return this._execute(this.endpoints.query, db, query, null, properties);
    }

    async executeMgmt(db, query, properties) {
        return this._execute(this.endpoints.mgmt, db, query, null, properties);
    }

    async executeStreamingIngest(db, table, stream, streamFormat, mappingName) {
        let endpoint = `${this.endpoints.ingest}/${db}/${table}?streamFormat=${streamFormat}`;
        if (mappingName != null) {
            endpoint += `&mappingName=${mappingName}`;
        }

        return this._execute(endpoint, db, null, stream, null);
    }

    async _execute(endpoint, db, query, stream, properties) {
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
            headers["Content-Type"] = "multipart/form-data";
        }
        headers["x-ms-client-request-id"] = clientRequestId || clientRequestPrefix + `${uuidv4()}`;

        headers["Authorization"] = await this.aadHelper.getAuthHeader();

        return this._doRequest(endpoint, headers, payload, timeout, properties);
    }

    async _doRequest(endpoint, headers, payload, timeout, properties) {
        let axiosConfig = {
            headers: headers,
            gzip: true,
            timeout: timeout
        };

        let axiosResponse;
        try {
            axiosResponse = await axios.post(endpoint, payload, axiosConfig);
        }
        catch (error) {
            if(error.response){
                throw error.response.data.error;
            }
            throw error;
        }

        return this._parseResponse(axiosResponse, properties);
    }

    _parseResponse(response, properties) {

        const { raw } = properties || {};
        if (raw === true || response.request.path.toLowerCase().startsWith("/v1/rest/ingest")) {
            return response.data;
        }

        let kustoResponse = null;
        try {
            if (response.request.path.toLowerCase().startsWith("/v2/")) {
                kustoResponse = new KustoResponseDataSetV2(response.data);
            } else if (response.request.path.toLowerCase().startsWith("/v1/")) {
                kustoResponse = new KustoResponseDataSetV1(response.data);
            }
        } catch (ex) {
            throw `Failed to parse response ({${response.status}}) with the following error [${ex}].`;
        }
        if (kustoResponse.getErrorsCount() > 0) {
            throw `Kusto request had errors. ${kustoResponse.getExceptions()}`;
        }
        return kustoResponse;
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
