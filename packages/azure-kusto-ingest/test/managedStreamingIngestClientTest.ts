// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable no-console */

import sinon from "sinon";
import { StreamingIngestClient, IngestionResult } from "azure-kusto-ingest";
import { StreamDescriptor } from "../src/descriptors.js";
import { KustoIngestClient } from "../src/ingestClient.js";
import { DataFormat, IngestionProperties, IngestionPropertiesInput } from "../src/ingestionProperties.js";
import KustoManagedStreamingIngestClient from "../src/managedStreamingIngestClient.js";
import { Readable } from "stream";
import { CloudSettings, KustoConnectionStringBuilder } from "azure-kusto-data";
import assert from "assert";
import uuidValidate from "uuid-validate";

type IngestFromStreamStub = sinon.SinonStub<[StreamDescriptor | Readable | ArrayBuffer, IngestionPropertiesInput?, string?], Promise<IngestionResult>>;
beforeAll(() => {
    CloudSettings.writeToCache("https://cluster.kusto.windows.net");
});
describe("ManagedStreamingIngestClient", () => {
    const getMockedClient = () => {
        const sandbox = sinon.createSandbox();
        const mockedStreamingIngestClient = new StreamingIngestClient("https://cluster.kusto.windows.net");
        const mockedIngestClient = new KustoIngestClient("https://cluster.kusto.windows.net");
        const streamStub = sinon.stub(mockedStreamingIngestClient, "ingestFromStream");
        const queuedStub = sinon.stub(mockedIngestClient, "ingestFromStream");

        const managedClient: KustoManagedStreamingIngestClient = Object.setPrototypeOf(
            {
                streamingIngestClient: mockedStreamingIngestClient,
                queuedIngestClient: mockedIngestClient,
                baseSleepTimeSecs: 0,
                baseJitterSecs: 0,
                defaultProps: new IngestionProperties({
                    database: "db",
                    table: "table",
                }),
            },
            KustoManagedStreamingIngestClient.prototype
        );

        return { sandbox, streamStub, queuedStub, managedClient };
    };

    const createStream = (items: unknown[]): Readable => {
        const stream = new Readable();
        stream._read = () => {
            for (const item of items) {
                stream.push(item);
            }
            stream.push(null);
        };

        stream.on("data", (data: Buffer) => {
            console.debug(data.toString("utf-8").substring(0, 100));
        });
        return stream;
    };

    const validateStream = (stub: IngestFromStreamStub, buffers: any[], sourceId: string | null) => {
        for (const [i, call] of stub.getCalls().entries()) {
            let calledStream = call.args[0];
            if (calledStream instanceof StreamDescriptor) {
                calledStream = calledStream.stream as Readable;
            }

            const chunks = [];
            while (true) {
                const chunk = (calledStream as Readable).read();
                if (chunk === null) {
                    break;
                }
                chunks.push(chunk);
            }

            assert.strictEqual(Buffer.compare(Buffer.concat(chunks), Buffer.concat(buffers)), 0);

            if (call.thisValue instanceof KustoIngestClient) {
                return;
            }

            assert(call.args[2]);
            const [prefix, actualSourceId, attemptCount] = call.args[2].split(";");
            assert.strictEqual(prefix, "KNC.executeManagedStreamingIngestFromStream");
            if (sourceId) {
                assert.strictEqual(actualSourceId, sourceId);
            } else {
                assert(uuidValidate(actualSourceId));
            }
            assert.strictEqual(Number(attemptCount), i);
        }
    };

    const testUuid = "9c565db6-ddcd-4b2d-bb6e-17525aab254d";

    describe("standard", () => {
        for (const sourceId of [null, testUuid]) {
            it.concurrent(`should use streaming ingest with sourceId ${sourceId}`, async () => {
                const { managedClient, queuedStub, sandbox, streamStub } = getMockedClient();

                streamStub.returns(Promise.resolve({}));
                queuedStub.throws(new Error("Should not be called"));

                const items = [Buffer.alloc(1024 * 1024, "a"), Buffer.alloc(1024 * 1024, "b"), Buffer.alloc(1024 * 1024, "c")];
                const stream = createStream(items);

                await managedClient.ingestFromStream(
                    new StreamDescriptor(stream, sourceId),
                    new IngestionProperties({
                        database: "db",
                        table: "t1",
                        format: DataFormat.CSV,
                    })
                );

                sandbox.assert.calledOnce(streamStub);
                sandbox.assert.notCalled(queuedStub);

                validateStream(streamStub, items, sourceId);
            });
        }
    });
    describe("test auto correct uri", () => {
        /* eslint-disable @typescript-eslint/no-unsafe-member-access -- needed for checking private members */
        it.concurrent("auto correct on regular ingestClient", () => {
            const client = new KustoManagedStreamingIngestClient(
                "https://ingest-somecluster.kusto.windows.net",
                "https://ingest-somecluster.kusto.windows.net"
            );
            assert.strictEqual(
                (client as any).queuedIngestClient.resourceManager.kustoClient.cluster,
                "https://ingest-somecluster.kusto.windows.net",
                "Client URI was not extracted correctly from query endpoint"
            );
            assert.strictEqual(
                (client as any).streamingIngestClient.kustoClient.cluster,
                "https://somecluster.kusto.windows.net",
                "Client URI was not extracted correctly from ingestion endpoint"
            );
        });
    });

    describe("fallback", () => {
        for (const sourceId of [null, testUuid]) {
            it.concurrent(`should fall to queued when transient error with sourceId ${sourceId}`, async () => {
                const { managedClient, queuedStub, sandbox, streamStub } = getMockedClient();

                // Mock ManagedStreamingIngestClient with mocked streamingIngestClient
                const transientError = { "@permanent": false };
                streamStub.throws(transientError);
                queuedStub.returns(Promise.resolve({} as IngestionResult));

                managedClient._getMergedProps();

                const items = [Buffer.from("string1"), Buffer.from("string2"), Buffer.from("string3")];
                const stream = createStream(items);

                await managedClient.ingestFromStream(
                    new StreamDescriptor(stream, sourceId),
                    new IngestionProperties({
                        database: "db",
                        table: "t1",
                        format: DataFormat.CSV,
                    })
                );

                sandbox.assert.calledThrice(streamStub);
                sandbox.assert.calledOnce(queuedStub);

                validateStream(streamStub, items, sourceId);
                validateStream(queuedStub, items, sourceId);
            });

            it.concurrent("should fallback when size is too big", async () => {
                // Mock ManagedStreamingIngestClient with mocked streamingIngestClient
                const mockedStreamingIngestClient = new StreamingIngestClient("https://cluster.kusto.windows.net");
                const mockedIngestClient = new KustoIngestClient("https://cluster.kusto.windows.net");
                const sandbox = sinon.createSandbox();
                const streamStub = sinon.stub(mockedStreamingIngestClient, "ingestFromStream");
                streamStub.throws(new Error("Should not be called"));
                const queuedStub = sinon.stub(mockedIngestClient, "ingestFromStream");
                queuedStub.returns(Promise.resolve({} as IngestionResult));
                const mockedManagedStreamingIngestClient: KustoManagedStreamingIngestClient = Object.setPrototypeOf(
                    {
                        streamingIngestClient: mockedStreamingIngestClient,
                        queuedIngestClient: mockedIngestClient,
                        maxRetries: 1,
                        baseSleepTimeSecs: 0,
                        baseJitterSecs: 0,
                        defaultProps: new IngestionProperties({}),
                    },
                    KustoManagedStreamingIngestClient.prototype
                );

                const singleBufferSize = 1023 * 1024;
                const buffers = [
                    Buffer.alloc(singleBufferSize, "a"),
                    Buffer.alloc(singleBufferSize, "b"),
                    Buffer.alloc(singleBufferSize, "c"),
                    Buffer.alloc(singleBufferSize, "d"),
                    Buffer.alloc(singleBufferSize, "e"),
                ];

                const stream = createStream(buffers);

                await mockedManagedStreamingIngestClient.ingestFromStream(
                    new StreamDescriptor(stream),
                    new IngestionProperties({
                        database: "db",
                        table: "t1",
                        format: DataFormat.CSV,
                    })
                );

                validateStream(queuedStub, buffers, sourceId);

                sandbox.assert.calledOnce(queuedStub);
                sandbox.assert.notCalled(streamStub);
            });
        }
    });

    describe("helper methods", () => {
        /* eslint-disable @typescript-eslint/no-unsafe-member-access -- needed for checking private members */
        it.concurrent("should be able to create a ManagedStreamingIngestClient from a DM URI", () => {
            const client = KustoManagedStreamingIngestClient.fromDmConnectionString(new KustoConnectionStringBuilder("https://ingest-dummy.kusto.windows.net"));

            assert.strictEqual(
                (client as any).queuedIngestClient.resourceManager.kustoClient.connectionString.dataSource,
                "https://ingest-dummy.kusto.windows.net"
            );
            assert.strictEqual((client as any).streamingIngestClient.kustoClient.connectionString.dataSource, "https://dummy.kusto.windows.net");
        });
        it.concurrent("should fail when trying to create a ManagedStreamingIngestClient from an invalid DM URI", () => {
            assert.throws(() => KustoManagedStreamingIngestClient.fromDmConnectionString(new KustoConnectionStringBuilder("https://dummy.kusto.windows.net")));
        });
        it.concurrent("should be able to create a ManagedStreamingIngestClient from an Engine URI", () => {
            const client = KustoManagedStreamingIngestClient.fromEngineConnectionString(new KustoConnectionStringBuilder("https://dummy.kusto.windows.net"));

            assert.strictEqual(
                (client as any).queuedIngestClient.resourceManager.kustoClient.connectionString.dataSource,
                "https://ingest-dummy.kusto.windows.net"
            );
            assert.strictEqual((client as any).streamingIngestClient.kustoClient.connectionString.dataSource, "https://dummy.kusto.windows.net");
        });
        it.concurrent("should fail when trying to create a ManagedStreamingIngestClient from an invalid Engine URI", () => {
            assert.throws(() =>
                KustoManagedStreamingIngestClient.fromEngineConnectionString(new KustoConnectionStringBuilder("https://ingest-dummy.kusto.windows.net"))
            );
        });

        /* eslint-enable @typescript-eslint/no-unsafe-member-access */
    });
});
