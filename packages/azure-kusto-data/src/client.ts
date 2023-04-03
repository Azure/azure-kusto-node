// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { v4 as uuidv4 } from "uuid";
import AadHelper from "./security";
import { KustoResponseDataSet, KustoResponseDataSetV1, KustoResponseDataSetV2, V1, V2Frames } from "./response";
import ConnectionStringBuilder from "./connectionBuilder";
import ClientRequestProperties from "./clientRequestProperties";
import { ThrottlingError } from "./errors";
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import http from "http";
import https from "https";
import { isNode } from "@azure/core-util";
import { kustoTrustedEndpoints } from "./kustoTrustedEndpoints";
import { CloudSettings } from "./cloudSettings";
import { toMilliseconds } from "./timeUtils";
import { KustoHeaders } from "./clientDetails";

const COMMAND_TIMEOUT_IN_MILLISECS = toMilliseconds(0, 10, 30);
const QUERY_TIMEOUT_IN_MILLISECS = toMilliseconds(0, 4, 30);
const CLIENT_SERVER_DELTA_IN_MILLISECS = toMilliseconds(0, 0, 30);
const MGMT_PREFIX = ".";

enum ExecutionType {
    Mgmt = "mgmt",
    Query = "query",
    Ingest = "ingest",
    QueryV1 = "queryv1",
}

export class KustoClient {
    connectionString: ConnectionStringBuilder;
    cluster: string;
    defaultDatabase?: string;
    endpoints: { [key in ExecutionType]: string };
    aadHelper: AadHelper;
    axiosInstance: AxiosInstance;
    cancelToken = axios.CancelToken.source();
    private _isClosed: boolean = false;

    constructor(kcsb: string | ConnectionStringBuilder) {
        this.connectionString = typeof kcsb === "string" ? new ConnectionStringBuilder(kcsb) : kcsb;
        if (!this.connectionString.dataSource) {
            throw new Error("Cluster url is required");
        }
        const url = new URL(this.connectionString.dataSource);
        this.cluster = url.toString();
        if (!this.cluster.endsWith("/")) {
            this.cluster += "/";
        }
        this.defaultDatabase = this.connectionString.initialCatalog;
        this.endpoints = {
            [ExecutionType.Mgmt]: `${this.cluster}/v1/rest/mgmt`,
            [ExecutionType.Query]: `${this.cluster}/v2/rest/query`,
            [ExecutionType.Ingest]: `${this.cluster}/v1/rest/ingest`,
            [ExecutionType.QueryV1]: `${this.cluster}/v1/rest/query`,
        };
        this.aadHelper = new AadHelper(this.connectionString);
        const headers = {
            Accept: "application/json",
            "Accept-Encoding": "gzip,deflate",
            Connection: "Keep-Alive",
        };
        const axiosProps: AxiosRequestConfig = {
            headers,
            validateStatus: (status: number) => status === 200,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            maxRedirects: 0,
        };
        // http and https are Node modules and are not found in browsers
        if (isNode) {
            // keepAlive pools and reuses TCP connections, so it's faster
            axiosProps.httpAgent = new http.Agent({ keepAlive: true });
            axiosProps.httpsAgent = new https.Agent({ keepAlive: true });
        }
        axiosProps.cancelToken = this.cancelToken.token;

        this.axiosInstance = axios.create(axiosProps);
    }

    async execute(db: string | null, query: string, properties?: ClientRequestProperties) {
        query = query.trim();
        if (query.startsWith(MGMT_PREFIX)) {
            return this.executeMgmt(db, query, properties);
        }

        return this.executeQuery(db, query, properties);
    }

    async executeQuery(db: string | null, query: string, properties?: ClientRequestProperties) {
        return this._execute(this.endpoints[ExecutionType.Query], ExecutionType.Query, db, query, null, properties);
    }

    async executeQueryV1(db: string | null, query: string, properties?: ClientRequestProperties) {
        return this._execute(this.endpoints[ExecutionType.QueryV1], ExecutionType.QueryV1, db, query, null, properties);
    }

    async executeMgmt(db: string | null, query: string, properties?: ClientRequestProperties) {
        return this._execute(this.endpoints[ExecutionType.Mgmt], ExecutionType.Mgmt, db, query, null, properties);
    }

    async executeStreamingIngest(
        db: string | null,
        table: string,
        stream: any,
        streamFormat: any,
        mappingName: string | null,
        clientRequestId?: string
    ): Promise<KustoResponseDataSet> {
        let endpoint = `${this.endpoints[ExecutionType.Ingest]}/${this.getDb(db)}/${table}?streamFormat=${streamFormat}`;
        if (mappingName != null) {
            endpoint += `&mappingName=${mappingName}`;
        }
        let properties: ClientRequestProperties | null = null;
        if (clientRequestId) {
            properties = new ClientRequestProperties();
            properties.clientRequestId = clientRequestId;
        }
        return this._execute(endpoint, ExecutionType.Ingest, db, null, stream, properties);
    }

    async _execute(
        endpoint: string,
        executionType: ExecutionType,
        db: string | null,
        query: string | null,
        stream: any,
        properties?: ClientRequestProperties | null
    ): Promise<KustoResponseDataSet> {
        this.ensureOpen();
        kustoTrustedEndpoints.validateTrustedEndpoint(endpoint, (await CloudSettings.getInstance().getCloudInfoForCluster(this.cluster)).LoginEndpoint);
        db = this.getDb(db);
        const headers: { [header: string]: string } = {};

        let payload: { db: string; csl: string; properties?: any };
        let clientRequestPrefix = "";

        const timeout = this._getClientTimeout(executionType, properties);
        let payloadContent: any = "";
        if (query != null) {
            payload = {
                db,
                csl: query,
            };

            if (properties != null) {
                payload.properties = properties.toJSON();
            }

            payloadContent = JSON.stringify(payload);

            headers["Content-Type"] = "application/json; charset=utf-8";
            clientRequestPrefix = "KNC.execute;";
        } else if (stream != null) {
            payloadContent = stream;
            clientRequestPrefix = "KNC.executeStreamingIngest;";
            if (isNode) {
                headers["Content-Encoding"] = "gzip";
                headers["Content-Type"] = "application/octet-stream";
            } else {
                headers["Content-Type"] = "application/json";
            }
        } else {
            throw new Error("Invalid parameters - expected query or streaming ingest");
        }

        let kustoHeaders = this.connectionString.clientDetails().getHeaders();
        kustoHeaders["x-ms-client-request-id"] = `${clientRequestPrefix}${uuidv4()}`;

        if (properties != null) {
            kustoHeaders = {
                ...kustoHeaders,
                ...properties.getHeaders(),
            };
        }

        for (const key of Object.keys(kustoHeaders) as Iterable<keyof KustoHeaders>) {
            if (kustoHeaders[key]) {
                headers[key] = kustoHeaders[key] as string;
            }
        }

        const authHeader = await this.aadHelper.getAuthHeader();
        if (authHeader != null) {
            headers.Authorization = authHeader;
        }

        return this._doRequest(endpoint, executionType, headers, payloadContent, timeout, properties);
    }

    private getDb(db: string | null) {
        if (db == null) {
            if (this.defaultDatabase == null) {
                throw new Error("No database provided, and no default database specified in connection string");
            }
            db = this.defaultDatabase;
        }
        return db;
    }

    async _doRequest(
        endpoint: string,
        executionType: ExecutionType,
        headers: { [header: string]: string },
        payload: any,
        timeout: number,
        properties?: ClientRequestProperties | null
    ): Promise<KustoResponseDataSet> {
        const axiosConfig: AxiosRequestConfig = {
            headers,
            timeout,
        };

        let axiosResponse;
        try {
            axiosResponse = await this.axiosInstance.post(endpoint, payload, axiosConfig);
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response) {
                if (error.response.status === 429) {
                    throw new ThrottlingError("POST request failed with status 429 (Too Many Requests)", error);
                }
            }
            throw error;
        }

        return this._parseResponse(axiosResponse.data, executionType, properties, axiosResponse.status);
    }

    _parseResponse(response: any, executionType: ExecutionType, properties?: ClientRequestProperties | null, status?: number): KustoResponseDataSet {
        const { raw } = properties || {};
        if (raw === true || executionType === ExecutionType.Ingest) {
            return response;
        }

        let kustoResponse = null;
        try {
            if (executionType === ExecutionType.Query) {
                kustoResponse = new KustoResponseDataSetV2(response as V2Frames);
            } else {
                kustoResponse = new KustoResponseDataSetV1(response as V1);
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

        return executionType === ExecutionType.Query || executionType === ExecutionType.QueryV1 ? QUERY_TIMEOUT_IN_MILLISECS : COMMAND_TIMEOUT_IN_MILLISECS;
    }

    public close() {
        if (!this._isClosed) {
            this.cancelToken.cancel("Client Closed");
        }
        this._isClosed = true;
    }

    ensureOpen() {
        if (this._isClosed) {
            throw new Error("Client is closed");
        }
    }
}

export default KustoClient;
