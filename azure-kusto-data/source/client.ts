// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import moment from "moment";
import uuid from "uuid";
import AadHelper from "./security";
import {KustoResponseDataSet, KustoResponseDataSetV1, KustoResponseDataSetV2} from "./response";
import ConnectionStringBuilder from "./connectionBuilder";
import ClientRequestProperties from "./clientRequestProperties";
import pkg from "../package.json";
import axios from "axios";

const COMMAND_TIMEOUT_IN_MILLISECS = moment.duration(10.5, "minutes").asMilliseconds();
const QUERY_TIMEOUT_IN_MILLISECS = moment.duration(4.5, "minutes").asMilliseconds();
const CLIENT_SERVER_DELTA_IN_MILLISECS = moment.duration(0.5, "minutes").asMilliseconds();
const MGMT_PREFIX = ".";

enum ExecutionType {
    Mgmt = 0,
    Query = 1,
    Ingest = 2,
    QueryV1 = 3,
}

export class KustoClient {
    connectionString: ConnectionStringBuilder;
    cluster: string;
    endpoints: { [key in ExecutionType] : string; };
    aadHelper: AadHelper;
    headers: { [name: string]: string };

    constructor(kcsb: string | ConnectionStringBuilder) {
        this.connectionString = typeof (kcsb) === "string" ? new ConnectionStringBuilder(kcsb) : kcsb;
        this.cluster = (this.connectionString.dataSource as string);
        this.endpoints = {
            [ExecutionType.Mgmt]: `${this.cluster}/v1/rest/mgmt`,
            [ExecutionType.Query]: `${this.cluster}/v2/rest/query`,
            [ExecutionType.Ingest]: `${this.cluster}/v1/rest/ingest`,
            [ExecutionType.QueryV1]: `${this.cluster}/v1/rest/query`,
        };
        this.aadHelper = new AadHelper(this.connectionString);
        this.headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip,deflate",
            "x-ms-client-version": `Kusto.Node.Client:${pkg.version}`,
        };
    }

    async execute(db: string, query: string, properties?: ClientRequestProperties) {
        query = query.trim();
        if (query.startsWith(MGMT_PREFIX)) {
            return this.executeMgmt(db, query, properties);
        }

        return this.executeQuery(db, query, properties);
    }

    async executeQuery(db: string, query: string, properties?: ClientRequestProperties) {
        return this._execute(this.endpoints[ExecutionType.Query], ExecutionType.Query, db, query, null, properties);
    }

    async executeQueryV1(db: string, query: string, properties?: ClientRequestProperties) {
        return this._execute(this.endpoints[ExecutionType.QueryV1], ExecutionType.Query, db, query, null, properties);
    }

    async executeMgmt(db: string, query: string, properties?: ClientRequestProperties) {
        return this._execute(this.endpoints[ExecutionType.Mgmt], ExecutionType.Mgmt, db, query, null, properties);
    }

    async executeStreamingIngest(db: string, table: string, stream: any, streamFormat: any, mappingName: string | null): Promise<KustoResponseDataSet> {
        let endpoint = `${this.endpoints[ExecutionType.Ingest]}/${db}/${table}?streamFormat=${streamFormat}`;
        if (mappingName != null) {
            endpoint += `&mappingName=${mappingName}`;
        }

        return this._execute(endpoint, ExecutionType.Ingest, db, null, stream, null);
    }

    async _execute(
        endpoint: string,
        executionType: ExecutionType,
        db: string,
        query: string | null,
        stream: string | null,
        properties?: ClientRequestProperties | null): Promise<KustoResponseDataSet> {
        const headers: { [header: string]: string } = {};
        Object.assign(headers, this.headers);

        let payload: { db: string, csl: string, properties?: any };
        let clientRequestPrefix = "";
        let clientRequestId;

        const timeout = this._getClientTimeout(executionType, properties);
        let payloadStr = "";
        if (query != null) {
            payload = {
                "db": db,
                "csl": query
            };

            if (properties != null) {
                payload.properties = properties.toJson();
                clientRequestId = properties.clientRequestId;
            }

            payloadStr = JSON.stringify(payload);

            headers["Content-Type"] = "application/json; charset=utf-8";
            clientRequestPrefix = "KNC.execute;";
        } else if (stream != null) {
            payloadStr = stream;
            clientRequestPrefix = "KNC.executeStreamingIngest;";
            headers["Content-Encoding"] = "gzip";
            headers["Content-Type"] = "multipart/form-data";
        }
        headers["x-ms-client-request-id"] = clientRequestId || clientRequestPrefix + `${uuid.v4()}`;

        headers.Authorization = await this.aadHelper._getAuthHeader();

        return this._doRequest(endpoint, executionType, headers, payloadStr, timeout, properties);
    }

    async _doRequest(endpoint: string,
                     executionType: ExecutionType,
                     headers: { [header: string]: string; },
                     payload: string,
                     timeout: number,
                     properties?: ClientRequestProperties | null): Promise<KustoResponseDataSet> {
        const axiosConfig = {
            headers,
            gzip: true,
            timeout
        };

        let axiosResponse;
        try {
            axiosResponse = await axios.post(endpoint, payload, axiosConfig);
        } catch (error) {
            if (error.response) {
                throw error.response.data.error;
            }
            throw error;
        }

        return this._parseResponse(axiosResponse.data, executionType, properties, axiosResponse.status);
    }

    _parseResponse(response: any, executionType: ExecutionType, properties?: ClientRequestProperties | null, status?: number) : KustoResponseDataSet {
        const {raw} = properties || {};
        if (raw === true || executionType == ExecutionType.Ingest) {
            return response;
        }

        let kustoResponse = null;
        try {
            if (executionType == ExecutionType.Query) {
                kustoResponse = new KustoResponseDataSetV2(response);
            } else {
                kustoResponse = new KustoResponseDataSetV1(response);
            }
        } catch (ex) {
            throw new Error(`Failed to parse response ({${status}}) with the following error [${ex}].`);
        }
        if (kustoResponse.getErrorsCount().errors > 0) {
            throw new Error(`Kusto request had errors. ${kustoResponse.getExceptions()}`);
        }
        return kustoResponse;
    }

    _getClientTimeout(executionType: ExecutionType, properties?: ClientRequestProperties | null): number {
        if (properties != null) {
            const clientTimeout = properties.getClientTimeout();
            if (clientTimeout) {
                return clientTimeout;
            }

            const serverTimeout = properties.getTimeout();
            if (serverTimeout) {
                return serverTimeout + CLIENT_SERVER_DELTA_IN_MILLISECS;
            }
        }

        return executionType == ExecutionType.Query ||  executionType == ExecutionType.QueryV1 ? QUERY_TIMEOUT_IN_MILLISECS : COMMAND_TIMEOUT_IN_MILLISECS;
    }
}

export default KustoClient;
