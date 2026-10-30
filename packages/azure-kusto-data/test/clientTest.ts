// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";

import axios, { AxiosError } from "axios";
import { v4 as uuidv4 } from "uuid";

import { KustoClient } from "../src/client.js";

import { ClientRequestProperties } from "../src/clientRequestProperties.js";
import { KustoResponseDataSetV1, KustoResponseDataSetV2 } from "../src/response.js";
import { KustoResultRow } from "../src/models.js";

import v2Response from "./data/response/v2.js";
import v2ResponseError from "./data/response/v2error.js";
import v1Response from "./data/response/v1.js";
import v1_2Response from "./data/response/v1_2.js";
import { Readable } from "stream";
import ConnectionBuilder from "../src/connectionBuilder.js";
import { CloudSettings } from "../src/cloudSettings.js";
import { toMilliseconds } from "../src/timeUtils.js";
import { parseJsonWithLargeIntegersAsStrings } from "../src/utils.js";

enum ExecutionType {
    Mgmt = "mgmt",
    Query = "query",
    Ingest = "ingest",
    QueryV1 = "queryv1",
}

beforeAll(() => {
    CloudSettings.writeToCache("https://cluster.kusto.windows.net");
});

describe("KustoClient", () => {
    describe("url test", () => {
        const tests = {
            "https://kusto.test.com": "https://kusto.test.com",
            "https://kusto.test.com/": "https://kusto.test.com",
            "https://kusto.test.com/test": "https://kusto.test.com/test",
            "https://kusto.test.com:4242": "https://kusto.test.com:4242",
            "https://kusto.test.com:4242/": "https://kusto.test.com:4242",
            "https://kusto.test.com:4242/test": "https://kusto.test.com:4242/test",
        };

        for (const [url, expected] of Object.entries(tests)) {
            it.concurrent(`should return ${expected} for ${url}`, () => {
                const client = new KustoClient(url);
                assert.strictEqual(client.cluster, expected);
            });
        }
    });
    describe("#constructor", () => {
        it.concurrent("valid", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            assert.strictEqual(client.connectionString.authorityId, "organizations");
            assert.strictEqual(client.connectionString.dataSource, url);
        });
    });

    describe("timeout", () => {
        it.concurrent("ClientRequestProperties.ToJSON doesn't affect results", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);
            const clientRequestProps = new ClientRequestProperties();
            const timeout = toMilliseconds(0, 3, 31.813);
            const clientServerDelta = toMilliseconds(0, 0, 30);
            const totalTimeout = timeout + clientServerDelta;

            clientRequestProps.setTimeout(timeout);
            assert.strictEqual(client._getClientTimeout(ExecutionType.Query, clientRequestProps), totalTimeout);

            const json = clientRequestProps.toJSON();
            assert.strictEqual(json?.Options?.servertimeout, "00:03:31.813");

            client._getClientTimeout(ExecutionType.Query, clientRequestProps);
            assert.strictEqual(client._getClientTimeout(ExecutionType.Query, clientRequestProps), totalTimeout);

            const json2 = clientRequestProps.toJSON();
            assert.strictEqual(json2?.Options?.servertimeout, "00:03:31.813");
        });
    });

    describe("#_parseResponse()", () => {
        it.concurrent("valid v1", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const response = client._parseResponse(v1Response, ExecutionType.Mgmt);
            assert.strictEqual((response as KustoResponseDataSetV1).version, "1.0");
        });

        it.concurrent("valid v1 more data", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const response = client._parseResponse(v1_2Response, ExecutionType.QueryV1);
            assert.strictEqual((response as KustoResponseDataSetV1).version, "1.0");
        });

        it.concurrent("valid v2", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const response = client._parseResponse(v2Response, ExecutionType.Query);
            assert.strictEqual((response as KustoResponseDataSetV2).version, "2.0");
        });

        it.concurrent("valid v2 raw", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const response = client._parseResponse(v2Response, ExecutionType.Query, {
                raw: true,
            } as ClientRequestProperties);
            assert.strictEqual(response, v2Response);
        });

        it.concurrent("malformed body", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);
            try {
                client._parseResponse({}, ExecutionType.Query);
            } catch (ex) {
                assert(
                    ex instanceof Error &&
                        ex.message.startsWith(
                            "Failed to parse response ({undefined}) with the following error [TypeError:" + " data.forEach is" + " not a function].",
                        ),
                );
                return;
            }
            assert.fail();
        });

        it.concurrent("erred v2 not partial", () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            try {
                client._parseResponse(v2ResponseError, ExecutionType.Query);
            } catch (ex) {
                assert(ex instanceof Error && ex.message.startsWith("Kusto request had errors"));
                return;
            }
            assert.fail();
        });

        it.concurrent("setTimout for request", async () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const clientRequestProps = new ClientRequestProperties();
            const timeoutMs = toMilliseconds(0, 2, 30.006);
            clientRequestProps.setTimeout(timeoutMs);
            client.aadHelper.getAuthHeader = () => {
                return Promise.resolve("MockToken");
            };
            client._doRequest = (_endpoint, _executionType, _headers, payload, timeout) => {
                const payloadObj = JSON.parse(payload) as {
                    properties: { Options: { servertimeout: number } };
                };
                assert.strictEqual(payloadObj.properties.Options.servertimeout, "00:02:30.006");
                assert.strictEqual(timeout, timeoutMs + toMilliseconds(0, 0, 30));
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", "Table | count", clientRequestProps);
        });

        it.concurrent("setClientTimout for request", async () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            const clientRequestProps = new ClientRequestProperties();
            const timeoutMs = toMilliseconds(0, 2, 31);
            clientRequestProps.setClientTimeout(timeoutMs);
            client.aadHelper.getAuthHeader = () => {
                return Promise.resolve("MockToken");
            };
            client._doRequest = (_endpoint, _executionType, _headers, payload, timeout) => {
                JSON.parse(payload);
                assert.strictEqual(timeout, timeoutMs);
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", "Table | count", clientRequestProps);
        });

        it.concurrent("default timeout for query", async () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            client.aadHelper.getAuthHeader = () => {
                return Promise.resolve("MockToken");
            };
            client._doRequest = (_endpoint, _executionType, _headers, _payload, timeout) => {
                assert.strictEqual(timeout, toMilliseconds(0, 4, 30));
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", "Table | count");
        });

        it.concurrent("default timeout for admin", async () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);
            client.aadHelper.getAuthHeader = () => {
                return Promise.resolve("MockToken");
            };
            client._doRequest = (_endpoint, _executionType, _headers, _payload, timeout) => {
                assert.strictEqual(timeout, toMilliseconds(0, 10, 30));
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", ".show database DataBase schema");
        });

        it.concurrent("set clientRequestId for request", async () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);
            const clientRequestId = `MyApp.MyActivity;${uuidv4()}`;
            const application = "app1";
            const user = "user1";

            const clientRequestProps = new ClientRequestProperties();
            clientRequestProps.clientRequestId = clientRequestId;
            clientRequestProps.application = application;
            clientRequestProps.user = user;
            client.aadHelper.getAuthHeader = () => {
                return Promise.resolve("MockToken");
            };
            client._doRequest = (_endpoint, _executionType, headers) => {
                assert.strictEqual(headers["x-ms-client-request-id"], clientRequestId);
                assert.strictEqual(headers["x-ms-app"], application);
                assert.strictEqual(headers["x-ms-user"], user);
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.execute("Database", "Table | count", clientRequestProps);
        });

        it.concurrent("executeQueryV1", async () => {
            const url = "https://cluster.kusto.windows.net";
            const client = new KustoClient(url);

            client.aadHelper.getAuthHeader = () => {
                return Promise.resolve("MockToken");
            };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            client._doRequest = (endpoint, executionType, _headers, _payload, _timeout, _properties) => {
                assert.strictEqual(endpoint, `${url}/v1/rest/query`);
                assert.strictEqual(executionType, ExecutionType.QueryV1);
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };

            await client.executeQueryV1("Database", "Table | count");
        });

        describe("client default database tests", () => {
            const client = new KustoClient("Data Source=https://cluster.kusto.windows.net;Initial Catalog=db1");
            const noDbClient = new KustoClient("Data Source=https://cluster.kusto.windows.net");

            [client.execute.bind(client), client.executeMgmt.bind(client), client.executeQuery.bind(client), client.executeQueryV1.bind(client)].forEach(
                (method) => {
                    it(`${method.name} should have a default database`, async () => {
                        client._doRequest = (_endpoint, _executionType, _headers, payload) => {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            assert.strictEqual(JSON.parse(payload).db, "db1");
                            return Promise.resolve(new KustoResponseDataSetV2([]));
                        };
                        await method(null, "Table | count");
                    });

                    it(`${method.name} provided db should overwrite database`, async () => {
                        client._doRequest = (_endpoint, _executionType, _headers, payload) => {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            assert.strictEqual(JSON.parse(payload).db, "db2");
                            return Promise.resolve(new KustoResponseDataSetV2([]));
                        };
                        await method("db2", "Table | count");
                    });
                },
            );

            [
                client.execute.bind(noDbClient),
                client.executeMgmt.bind(noDbClient),
                client.executeQuery.bind(noDbClient),
                client.executeQueryV1.bind(noDbClient),
            ].forEach((method) => {
                it(`${method.name} without db should not have a default database`, async () => {
                    noDbClient._doRequest = (_endpoint, _executionType, _headers, payload) => {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        assert.strictEqual(JSON.parse(payload).db, ConnectionBuilder.DefaultDatabaseName);
                        return Promise.resolve(new KustoResponseDataSetV2([]));
                    };
                    await method(null, "Table | count");
                });

                it(`${method.name} without db provided db should overwrite database`, async () => {
                    noDbClient._doRequest = (_endpoint, _executionType, _headers, payload) => {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        assert.strictEqual(JSON.parse(payload).db, "db2");
                        return Promise.resolve(new KustoResponseDataSetV2([]));
                    };
                    await method("db2", "Table | count");
                });
            });

            it.concurrent(`executeStreamingIngest should have a default database`, async () => {
                const sClient = new KustoClient("Data Source=https://cluster.kusto.windows.net;Initial Catalog=db1");
                sClient._doRequest = (endpoint) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    assert.ok(endpoint.indexOf("/db1/") > 0);
                    return Promise.resolve(new KustoResponseDataSetV2([]));
                };
                await sClient.executeStreamingIngest(null, "Table", Readable.from(""), null, null);
            });

            it.concurrent(`executeStreamingIngest provided db should overwrite database`, async () => {
                const sClient = new KustoClient("Data Source=https://cluster.kusto.windows.net;Initial Catalog=db1");
                sClient._doRequest = (endpoint) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    assert.ok(endpoint.indexOf("/db2/") > 0);
                    return Promise.resolve(new KustoResponseDataSetV2([]));
                };
                await sClient.executeStreamingIngest("db2", "Table", Readable.from(""), "csv", null);
            });

            it.concurrent(`executeStreamingIngest without db should have a default database`, async () => {
                const sNoDbClient = new KustoClient("Data Source=https://cluster.kusto.windows.net");
                sNoDbClient._doRequest = (endpoint) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    assert.ok(endpoint.indexOf(`/${ConnectionBuilder.DefaultDatabaseName}/`) > 0);
                    return Promise.resolve(new KustoResponseDataSetV2([]));
                };

                await sNoDbClient.executeStreamingIngest(null, "Table", Readable.from(""), "csv", null);
            });

            it.concurrent(`executeStreamingIngest without db provided db should overwrite database`, async () => {
                const sNoDbClient = new KustoClient("Data Source=https://cluster.kusto.windows.net");
                sNoDbClient._doRequest = (endpoint) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    assert.ok(endpoint.indexOf("/db2/") > 0);
                    return Promise.resolve(new KustoResponseDataSetV2([]));
                };
                await sNoDbClient.executeStreamingIngest("db2", "Table", Readable.from(""), "csv", null);
            });
        });
    });
    describe("Close", () => {
        it.concurrent("Client should not be useable when closed", async () => {
            const c = new KustoClient("Data Source=https://cluster.kusto.windows.net");
            c.close();
            await assert.rejects(c.execute("db", "Table | count"), /Client is closed/);
        });
    });
    describe("client should construct right endpoint for stream from blob", () => {
        it.concurrent("Should use ", async () => {
            const client = new KustoClient("Data Source=https://cluster.kusto.windows.net");
            client._doRequest = (endpoint, executionType, _, payload) => {
                assert.ok(endpoint.indexOf("/db2/") > 0);
                assert.ok(endpoint.indexOf("/Table") > 0);
                assert.ok(endpoint.indexOf("streamFormat=csvMap") > 0);
                assert.ok(endpoint.indexOf("sourceKind=uri") > 0);
                assert.equal(executionType, ExecutionType.Ingest);
                assert.ok(Object.prototype.hasOwnProperty.call(payload, "sourceUri"));
                return Promise.resolve(new KustoResponseDataSetV2([]));
            };
            await client.executeStreamingIngest("db2", "Table", undefined, "csvMap", null, "bloby");
        });
    });

    describe("large integers", () => {
        const body =
            '[{"FrameType":"DataSetHeader","IsProgressive":false,"Version":"v2.0"},' +
            '{"FrameType":"DataTable","TableId":0,"TableKind":"PrimaryResult","TableName":"PrimaryResult",' +
            '"Columns":[{"ColumnName":"big","ColumnType":"long"},{"ColumnName":"small","ColumnType":"long"},' +
            '{"ColumnName":"payload","ColumnType":"dynamic"},{"ColumnName":"text","ColumnType":"string"}],' +
            '"Rows":[[9007199254740993,42,{"min":-9223372036854775808,"ratio":1.5e300,"list":[12345678901234567890]},"9007199254740993 \\"quoted\\""]]},' +
            '{"FrameType":"DataSetCompletion","HasErrors":false,"Cancelled":false}]';

        const clientReturning = (data: string, status = 200) => {
            const client = new KustoClient("https://cluster.kusto.windows.net");
            client.aadHelper.getAuthHeader = () => Promise.resolve(null);
            client.axiosInstance.defaults.adapter = (config) => {
                const response = { data, status, statusText: "", headers: {}, config };
                return status === 200
                    ? Promise.resolve(response)
                    : Promise.reject(new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, null, response));
            };
            return client;
        };

        const firstRow = async (client: KustoClient, properties?: ClientRequestProperties) => {
            const response = await client.execute("db", "Table", properties);
            return response.primaryResults[0].rows().next().value as KustoResultRow;
        };

        it("are rounded by default", async () => {
            const row = await firstRow(clientReturning(body));
            assert.strictEqual(row.big, 9007199254740992);
            assert.strictEqual(row.small, 42);
        });

        it("are returned as exact strings when largeIntegersAsStrings is set", async () => {
            const properties = new ClientRequestProperties();
            properties.largeIntegersAsStrings = true;
            const row = await firstRow(clientReturning(body), properties);
            assert.strictEqual(row.big, "9007199254740993");
            assert.strictEqual(row.small, 42);
            assert.deepStrictEqual(row.payload, { min: "-9223372036854775808", ratio: 1.5e300, list: ["12345678901234567890"] });
            assert.strictEqual(row.text, '9007199254740993 "quoted"');
        });

        it("leave non-JSON error bodies untouched", async () => {
            const properties = new ClientRequestProperties();
            properties.largeIntegersAsStrings = true;
            const err: unknown = await clientReturning("<html>Bad Gateway 12345678901234567890</html>", 502)
                .execute("db", "Table", properties)
                .catch((e: unknown) => e);
            assert.ok(axios.isAxiosError(err));
            assert.strictEqual(err.response?.data, "<html>Bad Gateway 12345678901234567890</html>");
        });

        it("are detected only outside strings and only for integer literals", () => {
            const text = String.raw`{"s":"ends with \\","n":9007199254740992,"safe":-9007199254740991,"exp":1.5e30,"dec":12345678901234568.0,"q":"\"12345678901234567890\""}`;
            assert.deepStrictEqual(parseJsonWithLargeIntegersAsStrings(text), {
                s: "ends with \\",
                n: "9007199254740992",
                safe: -9007199254740991,
                exp: 1.5e30,
                dec: 12345678901234568,
                q: '"12345678901234567890"',
            });
            assert.deepStrictEqual(parseJsonWithLargeIntegersAsStrings('{"n":1}'), { n: 1 });
        });
    });
});
