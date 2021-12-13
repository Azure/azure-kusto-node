// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import sinon from "sinon";
import { StreamingIngestClient } from "../index";
import { StreamDescriptor } from "../source/descriptors";
import { KustoIngestClient } from "../source/ingestClient";
import { DataFormat, IngestionProperties } from "../source/ingestionProperties";
import KustoManagedStreamingIngestClient from "../source/managedStreamingIngestClient";
import { Readable } from "stream";
import { QueueSendMessageResponse } from "@azure/storage-queue";
import { describe } from "mocha";
import { CloudSettings } from "azure-kusto-data/source/cloudSettings";
import Sinon from "sinon";
import assert from "assert";
import uuidValidate from "uuid-validate";


type IngestFromStreamStub = Sinon.SinonStub<[(StreamDescriptor | Readable), IngestionProperties, string?], Promise<QueueSendMessageResponse>>;

describe("ManagedStreamingIngestClient", function () {
    function getMockedClient() {
        const sandbox = sinon.createSandbox();
        const mockedStreamingIngestClient = new StreamingIngestClient("engine");
        const mockedIngestClient = new KustoIngestClient("engine");
        const streamStub = sinon.stub(mockedStreamingIngestClient, "ingestFromStream");
        const queuedStub = sinon.stub(mockedIngestClient, "ingestFromStream");

        const managedClient: KustoManagedStreamingIngestClient =
            Object.setPrototypeOf({
                streamingIngestClient: mockedStreamingIngestClient,
                queuedIngestClient: mockedIngestClient, baseSleepTimeSecs: 0, baseJitterSecs: 0
            }, KustoManagedStreamingIngestClient.prototype);

        return { sandbox, streamStub, queuedStub, managedClient };
    }

    function createStream(items: unknown[]): Readable {
        const stream = new Readable();
        stream._read = () => {
            for (const item of items) {
                stream.push(item);
            }
            stream.push(null);
        };

        stream.on('data', function (data: Buffer) {
            console.log(data.toString("utf-8").substring(0, 100));
        });
        return stream;
    }

    function validateStream(stub: IngestFromStreamStub, buffers: any[], sourceId: string | null) {
        for (const [i, call] of stub.getCalls().entries()) {
            let calledStream = call.args[0];
            if (calledStream instanceof StreamDescriptor) {
                calledStream = calledStream.stream;
            }

            const chunks = [];
            while (true) {
                const chunk = calledStream.read();
                if (chunk === null) {
                    break;
                }
                chunks.push(chunk);
            }

            assert.strictEqual(Buffer.compare(Buffer.concat(chunks), Buffer.concat(buffers)), 0);

            if (call.thisValue instanceof KustoIngestClient) {
                return;
            }

            assert(call.args[2])
            const [prefix, actualSourceId, attemptCount] = call.args[2].split(";");
            assert.strictEqual(prefix, "KNC.execute_managed_streaming_ingest")
            if (sourceId) {
                assert.strictEqual(actualSourceId, sourceId);
            }
            else {
                assert(uuidValidate(actualSourceId));
            }
            assert.strictEqual(Number(attemptCount), i);

        }
    }

    CloudSettings.getInstance().cloudCache["engine"] = CloudSettings.getInstance().defaultCloudInfo;

    const testUuid = "9c565db6-ddcd-4b2d-bb6e-17525aab254d";

    describe("standard", function () {
        for (const sourceId of [null, testUuid]){
            it(`should use streaming ingest with sourceId ${sourceId}`, async function () {
                const { managedClient, queuedStub, sandbox, streamStub } = getMockedClient();

                streamStub.returns(Promise.resolve({}));
                queuedStub.throws(new Error("Should not be called"));


                let items = [
                    Buffer.alloc(1024 * 1024, "a"),
                    Buffer.alloc(1024 * 1024, "b"),
                    Buffer.alloc(1024 * 1024, "c"),
                ];
                const stream = createStream(items)

                await managedClient.ingestFromStream(new StreamDescriptor(stream, sourceId), new IngestionProperties({
                    database: 'db',
                    table: 't1',
                    format: DataFormat.CSV,
                }));

                sandbox.assert.calledOnce(streamStub);
                sandbox.assert.notCalled(queuedStub);

                validateStream(streamStub, items, sourceId);
            });
        }

    });

    describe("fallback", function () {
        for (const sourceId of [null, testUuid]) {
            it(`should fall to queued when transient error with sourceId ${sourceId}`, async function () {
                const { managedClient, queuedStub, sandbox, streamStub } = getMockedClient();

                // Mock ManagedStreamingIngestClient with mocked streamingIngestClient
                const transientError = { "@permanent": false };
                streamStub.throws(transientError);
                queuedStub.returns(Promise.resolve(<QueueSendMessageResponse>{}));

                managedClient._mergeProps()

                let items = [Buffer.from("string1"), Buffer.from("string2"), Buffer.from("string3")];
                const stream = createStream(items);

                await managedClient.ingestFromStream(new StreamDescriptor(stream, sourceId), new IngestionProperties({
                    database: 'db',
                    table: 't1',
                    format: DataFormat.CSV,
                }));

                sandbox.assert.calledThrice(streamStub);
                sandbox.assert.calledOnce(queuedStub);

                validateStream(streamStub, items, sourceId);
                validateStream(queuedStub, items, sourceId);
            });

            it('should fallback when size is too big', async function () {
                // Mock ManagedStreamingIngestClient with mocked streamingIngestClient
                const mockedStreamingIngestClient = new StreamingIngestClient("engine");
                const mockedIngestClient = new KustoIngestClient("engine");
                const sandbox = sinon.createSandbox();
                let streamStub = sinon.stub(mockedStreamingIngestClient, "ingestFromStream");
                streamStub.throws(new Error("Should not be called"));
                let queuedStub = sinon.stub(mockedIngestClient, "ingestFromStream");
                queuedStub.returns(Promise.resolve(<QueueSendMessageResponse>{}));
                const mockedManagedStreamingIngestClient: KustoManagedStreamingIngestClient =
                    Object.setPrototypeOf({
                        streamingIngestClient: mockedStreamingIngestClient,
                        queuedIngestClient: mockedIngestClient, maxRetries: 1, baseSleepTimeSecs: 0, baseJitterSecs: 0
                    }, KustoManagedStreamingIngestClient.prototype);

                let singleBufferSize = 1023 * 1024;
                let buffers = [
                    Buffer.alloc(singleBufferSize, "a"),
                    Buffer.alloc(singleBufferSize, "b"),
                    Buffer.alloc(singleBufferSize, "c"),
                    Buffer.alloc(singleBufferSize, "d"),
                    Buffer.alloc(singleBufferSize, "e"),
                ];

                const stream = createStream(buffers)

                await mockedManagedStreamingIngestClient.ingestFromStream(new StreamDescriptor(stream), new IngestionProperties({
                    database: 'db',
                    table: 't1',
                    format: DataFormat.CSV,
                }));


                validateStream(queuedStub, buffers, sourceId);

                sandbox.assert.calledOnce(queuedStub);
                sandbox.assert.notCalled(streamStub);
            });
        }
    });
});
