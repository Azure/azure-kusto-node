// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { KustoIngestClient } from "../src/ingestClient.js";
import { DataFormat, IngestionProperties, IngestionPropertiesInput, ReportLevel, ReportMethod } from "../src/ingestionProperties.js";
import { IngestionPropertiesValidationError } from "../src/errors.js";
import KustoStreamingIngestClient from "../src/streamingIngestClient.js";
import KustoManagedStreamingIngestClient from "../src/managedStreamingIngestClient.js";
import { Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";
import { Readable } from "stream";
import sinon from "sinon";
import { gunzipSync } from "zlib";
import { BlockBlobClient } from "@azure/storage-blob";
import { QueueClient } from "@azure/storage-queue";
import { ResourceType, ResourceURI } from "../src/resourceManager.js";
import { BlobDescriptor, StreamDescriptor } from "../src/descriptors.js";
import { FileDescriptor } from "../src/fileDescriptor.js";
import { file as tmpFile } from "tmp-promise";
import fs from "fs";

describe("KustoIngestClient", () => {
    describe("#constructor()", () => {
        it.concurrent("valid input", () => {
            const ingestClient = new KustoIngestClient(
                "https://cluster.kusto.windows.net",
                {
                    database: "db",
                    table: "table",
                    format: "json",
                } as IngestionProperties,
                false,
            );

            assert.notStrictEqual(ingestClient.defaultProps, null);
            assert.strictEqual(ingestClient.resourceManager.kustoClient.cluster, "https://cluster.kusto.windows.net");
            assert.strictEqual(ingestClient.defaultProps!.database, "db");
            assert.strictEqual(ingestClient.defaultProps!.table, "table");
            assert.strictEqual(ingestClient.defaultProps!.format, "json");
        });
    });

    describe("#getIngestionEndpoint()", () => {
        it.each([
            ["http://127.0.0.1:8080", "http://127.0.0.1:8080"],
            ["https://10.0.0.1", "https://10.0.0.1"],
            ["http://localhost:8080", "http://localhost:8080"],
            ["https://onebox.dev.kusto.windows.net", "https://onebox.dev.kusto.windows.net"],
            ["https://cluster.kusto.windows.net", "https://ingest-cluster.kusto.windows.net"],
            ["https://ingest-cluster.kusto.windows.net", "https://ingest-cluster.kusto.windows.net"],
        ])("preserves endpoint routing for %s", (endpoint, expected) => {
            const client = new KustoIngestClient("https://cluster.kusto.windows.net");

            assert.strictEqual(client.getIngestionEndpoint(endpoint), expected);
        });
    });

    describe("#_resolveProperties()", () => {
        it.concurrent("empty default props", () => {
            const newProps = new IngestionProperties({
                database: "db",
                table: "table",
                format: DataFormat.JSON,
            });
            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net");
            const actual = client._getMergedProps(newProps);

            assert.strictEqual(actual.database, "db");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "json");
        });

        it.concurrent("new props object", () => {
            const newProps = {
                database: "db",
                table: "table",
                format: DataFormat.JSON,
            };
            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net");
            const actual = client._getMergedProps(newProps);

            assert.strictEqual(actual.database, "db");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "json");
        });

        it.concurrent("empty new props", () => {
            const defaultProps = new IngestionProperties({
                database: "db",
                table: "table",
                format: DataFormat.JSON,
            });
            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net", defaultProps);
            const actual = client._getMergedProps(null);

            assert.strictEqual(actual.database, "db");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "json");
        });

        it.concurrent("default props object", () => {
            const defaultProps = {
                database: "db",
                table: "table",
                format: DataFormat.JSON,
            };
            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net", defaultProps);
            const actual = client._getMergedProps(null);

            assert.strictEqual(actual.database, "db");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "json");
        });

        it.concurrent("both exists props", () => {
            const defaultProps = new IngestionProperties({
                database: "db",
                table: "table",
                format: DataFormat.JSON,
                reportLevel: ReportLevel.DoNotReport,
            });
            const newProps = new IngestionProperties({});
            newProps.database = "db2";
            newProps.ingestionMappingReference = "MappingRef";
            newProps.format = DataFormat.AVRO;

            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net", defaultProps);
            const actual = client._getMergedProps(newProps);

            assert.strictEqual(actual.database, "db2");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "avro");
            assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
            assert.strictEqual(actual.reportLevel, ReportLevel.DoNotReport);
            assert.strictEqual(actual.reportMethod, ReportMethod.Queue);
        });

        it.concurrent("both exists objects", () => {
            const defaultProps = {
                database: "db",
                table: "table",
                format: DataFormat.JSON,
            };
            const newProps = {
                database: "db2",
                ingestionMappingReference: "MappingRef",
                format: DataFormat.AVRO,
                reportMethod: ReportMethod.Table,
                reportLevel: ReportLevel.FailuresAndSuccesses,
            };

            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net", defaultProps);
            const actual = client._getMergedProps(newProps);

            assert.strictEqual(actual.database, "db2");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.format, "avro");
            assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
            assert.strictEqual(actual.reportLevel, ReportLevel.FailuresAndSuccesses);
            assert.strictEqual(actual.reportMethod, ReportMethod.Table);
        });

        it.concurrent("test defaults", () => {
            const defaultProps = {
                database: "db",
                table: "table",
            };
            const newProps = {
                database: "db2",
                ingestionMappingReference: "MappingRef",
            };

            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net", defaultProps);
            const actual = client._getMergedProps(newProps);

            assert.strictEqual(actual.database, "db2");
            assert.strictEqual(actual.table, "table");
            assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
            assert.strictEqual(actual.format, "csv");
            assert.strictEqual(actual.reportLevel, ReportLevel.FailuresOnly);
            assert.strictEqual(actual.reportMethod, ReportMethod.Queue);
        });

        describe("test default database", () => {
            [
                (s: string, p: IngestionPropertiesInput) => new KustoIngestClient(s, p),
                (s: string, p: IngestionPropertiesInput) => new KustoStreamingIngestClient(s, p),
                (s: string, p: IngestionPropertiesInput) =>
                    KustoManagedStreamingIngestClient.fromEngineConnectionString(new KustoConnectionStringBuilder(s), p),
            ].forEach((clientType) => {
                it.concurrent(`${clientType} - test default database`, () => {
                    const defaultProps: IngestionPropertiesInput = {
                        table: "table",
                    };
                    const newProps: IngestionPropertiesInput = {
                        ingestionMappingReference: "MappingRef",
                    };

                    const client = clientType("Data Source=https://cluster.region.kusto.windows.net;Initial Catalog=db3", defaultProps);
                    const actual = client._getMergedProps(newProps);

                    assert.strictEqual(actual.database, "db3");
                    assert.strictEqual(actual.table, "table");
                    assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
                    assert.strictEqual(actual.format, "csv");
                    assert.strictEqual(actual.reportLevel, ReportLevel.FailuresOnly);
                    assert.strictEqual(actual.reportMethod, ReportMethod.Queue);
                });

                it.concurrent(`${clientType} - test default database with defaultProps`, () => {
                    const defaultProps: IngestionPropertiesInput = {
                        table: "table",
                        database: "db",
                    };
                    const newProps: IngestionPropertiesInput = {
                        ingestionMappingReference: "MappingRef",
                    };

                    const client = clientType("Data Source=https://cluster.region.kusto.windows.net;Initial Catalog=db3", defaultProps);
                    const actual = client._getMergedProps(newProps);

                    assert.strictEqual(actual.database, "db");
                    assert.strictEqual(actual.table, "table");
                    assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
                    assert.strictEqual(actual.format, "csv");
                    assert.strictEqual(actual.reportLevel, ReportLevel.FailuresOnly);
                    assert.strictEqual(actual.reportMethod, ReportMethod.Queue);
                });

                it.concurrent(`${clientType} - test default database with given props`, () => {
                    const defaultProps: IngestionPropertiesInput = {
                        table: "table",
                        database: "db",
                    };
                    const newProps: IngestionPropertiesInput = {
                        ingestionMappingReference: "MappingRef",
                        database: "db2",
                    };

                    const client = clientType("Data Source=https://cluster.region.kusto.windows.net;Initial Catalog=db3", defaultProps);
                    const actual = client._getMergedProps(newProps);

                    assert.strictEqual(actual.database, "db2");
                    assert.strictEqual(actual.table, "table");
                    assert.strictEqual(actual.ingestionMappingReference, "MappingRef");
                    assert.strictEqual(actual.format, "csv");
                    assert.strictEqual(actual.reportLevel, ReportLevel.FailuresOnly);
                    assert.strictEqual(actual.reportMethod, ReportMethod.Queue);
                });
            });
        });

        it.concurrent("default both", () => {
            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net");

            assert.throws(() => client._getMergedProps(), new IngestionPropertiesValidationError("Must define a target table"));
        });
        it.concurrent("empty both", () => {
            const client = new KustoIngestClient("https://cluster.region.kusto.windows.net");
            client.defaultDatabase = undefined;

            assert.throws(() => client._getMergedProps(), new IngestionPropertiesValidationError("Must define a target database"));
        });
    });

    describe("test auto correct uri", () => {
        it.concurrent("auto correct from query endpoint", () => {
            const client = new KustoIngestClient("https://somecluster.kusto.windows.net");
            assert.strictEqual(
                client.resourceManager.kustoClient.cluster,
                "https://ingest-somecluster.kusto.windows.net",
                "Kusto cluster URL does not match expected value",
            );
        });
        it.concurrent("auto correct from ingestion endpoint", () => {
            const client = new KustoIngestClient("https://ingest-somecluster.kusto.windows.net");
            assert.strictEqual(
                client.resourceManager.kustoClient.cluster,
                "https://ingest-somecluster.kusto.windows.net",
                "Kusto cluster URL does not match expected value",
            );
        });
    });

    describe("#ingestFromFile()", () => {
        it.each([
            { length: 10, fileSize: 4096 },
            { length: 128 * 1024, fileSize: 1024 * 1024 },
            { length: 256 * 1024, fileSize: 128 * 1024 },
        ])("queues the observed $length-byte raw size and preserves input across upload retries when stat reports $fileSize", async ({ length, fileSize }) => {
            const source = await tmpFile({ postfix: ".avro" });
            const descriptor = new FileDescriptor(source.path);
            const client = new KustoIngestClient("https://cluster.kusto.windows.net", { database: "db", table: "table" });
            const sandbox = sinon.createSandbox();
            const input = Buffer.alloc(length, "a");
            const uploaded: Buffer[] = [];
            const finishUpload = sandbox.stub<[], ReturnType<BlockBlobClient["uploadFile"]>>().resolves();
            const upload = sandbox.stub(BlockBlobClient.prototype, "uploadFile").callsFake(async (path) => {
                uploaded.push(await fs.promises.readFile(path));
                if (uploaded.length === 1) {
                    throw new Error("First upload failed");
                }
                return finishUpload();
            });
            const queued = sandbox.stub(QueueClient.prototype, "sendMessage").resolves();
            sandbox
                .stub(client.resourceManager, "getContainers")
                .resolves(
                    ["first", "second"].map(
                        (account) => new ResourceURI(`https://${account}.blob.core.windows.net/container`, account, ResourceType.Container),
                    ),
                );
            sandbox.stub(client.resourceManager, "getAuthorizationContext").resolves("authorization");
            sandbox
                .stub(client.resourceManager, "getIngestionQueues")
                .resolves([new ResourceURI("https://storage.queue.core.windows.net/ingestion", "storage", ResourceType.Queue)]);
            sandbox.stub(client.resourceManager, "reportResourceUsageResult");

            try {
                await fs.promises.writeFile(source.path, input);
                const stats = await fs.promises.stat(source.path);
                stats.size = fileSize;
                sandbox.stub(fs, "stat").callThrough().withArgs(source.path).yields(null, stats);

                await client.ingestFromFile(descriptor, { format: DataFormat.AVRO });

                sandbox.assert.calledTwice(upload);
                assert.deepStrictEqual(uploaded, [input, input]);
                sandbox.assert.calledOnce(queued);
                const message: unknown = JSON.parse(Buffer.from(queued.firstCall.args[0], "base64").toString());
                assert.ok(typeof message === "object" && message !== null && "RawDataSize" in message);
                assert.strictEqual(message.RawDataSize, input.length);
                const prepared = upload.firstCall.args[0];
                assert.notStrictEqual(prepared, source.path);
                assert.strictEqual(upload.secondCall.args[0], prepared);
                await assert.rejects(fs.promises.readFile(prepared), { code: "ENOENT" });
            } finally {
                sandbox.restore();
                client.close();
                await source.cleanup();
            }
        });

        it.each(["success", "upload failure", "queue failure"])("keeps concurrent prepared files and sizes independent after %s", async (outcome) => {
            const source = await tmpFile({ postfix: ".avro" });
            const descriptor = new FileDescriptor(source.path);
            const client = new KustoIngestClient("https://cluster.kusto.windows.net", { database: "db", table: "table" });
            const sandbox = sinon.createSandbox();
            const input = Buffer.from("value\n123\n");
            const firstStarted = sinon.promise<string>();
            const secondStarted = sinon.promise<string>();
            const finishFirst = sinon.promise<void>();
            const finishSecond = sinon.promise<void>();
            const error = new Error(outcome);
            const completeUpload = sandbox.stub<[], ReturnType<BlockBlobClient["uploadFile"]>>().resolves();
            let firstPath: string | undefined;
            let secondAttempts = 0;
            sandbox.stub(BlockBlobClient.prototype, "uploadFile").callsFake(async (path) => {
                if (firstPath === undefined) {
                    firstPath = path;
                    void firstStarted.resolve(path);
                }
                if (path === firstPath) {
                    await finishFirst;
                    assert.deepStrictEqual(await fs.promises.readFile(path), input);
                    if (outcome === "upload failure") {
                        throw error;
                    }
                } else {
                    if (secondStarted.status === "pending") {
                        void secondStarted.resolve(path);
                    }
                    await finishSecond;
                    assert.deepStrictEqual(await fs.promises.readFile(path), input);
                    if (++secondAttempts === 1) {
                        throw new Error("Retry the second upload");
                    }
                }
                return completeUpload();
            });
            sandbox
                .stub(client.resourceManager, "getContainers")
                .resolves(
                    ["first", "second"].map(
                        (account) => new ResourceURI(`https://${account}.blob.core.windows.net/container`, account, ResourceType.Container),
                    ),
                );
            sandbox.stub(client.resourceManager, "reportResourceUsageResult");
            const queued = sandbox.stub(client, "ingestFromBlob").resolves();
            if (outcome === "queue failure") {
                queued.onFirstCall().rejects(error);
            }
            let first: Promise<unknown> | undefined;
            let second: Promise<unknown> | undefined;

            try {
                await fs.promises.writeFile(source.path, input);
                const stats = await fs.promises.stat(source.path);
                stats.size = 4096;
                sandbox.stub(fs, "stat").callThrough().withArgs(source.path).yields(null, stats);

                const operation = client.ingestFromFile(descriptor);
                first = outcome === "success" ? operation : assert.rejects(operation, (actual) => actual === error);
                const firstPrepared = await firstStarted;
                descriptor.size = 1234;
                second = client.ingestFromFile(descriptor);
                const secondPrepared = await secondStarted;

                assert.notStrictEqual(firstPrepared, secondPrepared);
                void finishFirst.resolve(undefined);
                await first;
                await assert.rejects(fs.promises.readFile(firstPrepared), { code: "ENOENT" });
                assert.deepStrictEqual(await fs.promises.readFile(secondPrepared), input);

                void finishSecond.resolve(undefined);
                await second;
                assert.strictEqual(secondAttempts, 2);
                await assert.rejects(fs.promises.readFile(secondPrepared), { code: "ENOENT" });
                if (outcome !== "upload failure") {
                    const firstBlob = queued.firstCall.args[0];
                    assert.ok(firstBlob instanceof BlobDescriptor);
                    assert.strictEqual(firstBlob.size, input.length);
                }
                const secondBlob = queued.lastCall.args[0];
                assert.ok(secondBlob instanceof BlobDescriptor);
                assert.strictEqual(secondBlob.size, 1234);
            } finally {
                if (finishFirst.status === "pending") {
                    void finishFirst.resolve(undefined);
                }
                if (finishSecond.status === "pending") {
                    void finishSecond.resolve(undefined);
                }
                client.close();
                await Promise.allSettled([first, second]);
                sandbox.restore();
                await source.cleanup();
            }
        });

        it("does not clean up an active upload when another preparation fails", async () => {
            const source = await tmpFile({ postfix: ".avro" });
            const descriptor = new FileDescriptor(source.path);
            const client = new KustoIngestClient("https://cluster.kusto.windows.net", { database: "db", table: "table" });
            const sandbox = sinon.createSandbox();
            const input = Buffer.from("value\n123\n");
            const started = sinon.promise<string>();
            const finish = sinon.promise<void>();
            const error = new Error("Unable to open the second input");
            const upload = sandbox.stub(client, "uploadToBlobWithRetry").callsFake(async (path) => {
                assert.ok(typeof path === "string");
                void started.resolve(path);
                await finish;
                assert.deepStrictEqual(await fs.promises.readFile(path), input);
                return "https://storage.blob.core.windows.net/container/file";
            });
            sandbox.stub(client, "ingestFromBlob").resolves();
            let operation: Promise<unknown> | undefined;

            try {
                await fs.promises.writeFile(source.path, input);
                const stats = await fs.promises.stat(source.path);
                stats.size = 4096;
                sandbox.stub(fs, "stat").callThrough().withArgs(source.path).yields(null, stats);

                operation = client.ingestFromFile(descriptor);
                const prepared = await started;
                sandbox.stub(fs.promises, "open").callThrough().withArgs(source.path, "r").rejects(error);

                await assert.rejects(client.ingestFromFile(descriptor), (actual) => actual === error);
                assert.deepStrictEqual(await fs.promises.readFile(prepared), input);
                sandbox.assert.calledOnce(upload);
                void finish.resolve(undefined);
                await operation;
                await assert.rejects(fs.promises.readFile(prepared), { code: "ENOENT" });
            } finally {
                if (finish.status === "pending") {
                    void finish.resolve(undefined);
                }
                client.close();
                await Promise.allSettled([operation]);
                sandbox.restore();
                await source.cleanup();
            }
        });

        it("preserves custom descriptor preparation and cleanup", async () => {
            const descriptor = new FileDescriptor("source.avro", null, 1234);
            const client = new KustoIngestClient("https://cluster.kusto.windows.net", { database: "db", table: "table" });
            const sandbox = sinon.createSandbox();
            const props = { format: DataFormat.AVRO };
            const prepare = sandbox.stub(descriptor, "prepare").resolves("prepared.avro");
            const cleanup = sandbox.stub(descriptor, "cleanup").resolves();
            const upload = sandbox.stub(client, "uploadToBlobWithRetry").resolves("https://storage.blob.core.windows.net/container/file");
            const queued = sandbox.stub(client, "ingestFromBlob").resolves();

            try {
                await client.ingestFromFile(descriptor, props);

                sandbox.assert.calledOnceWithExactly(prepare, props);
                sandbox.assert.calledOnce(cleanup);
                sandbox.assert.calledOn(cleanup, descriptor);
                assert.strictEqual(upload.firstCall.args[0], "prepared.avro");
                const blob = queued.firstCall.args[0];
                assert.ok(blob instanceof BlobDescriptor);
                assert.strictEqual(blob.size, 1234);
            } finally {
                sandbox.restore();
                client.close();
            }
        });

        it.each([0, 4096])("rejects empty input before upload when stat reports %s bytes", async (fileSize) => {
            const source = await tmpFile({ postfix: ".csv" });
            const descriptor = new FileDescriptor(source.path, null, 1234);
            const client = new KustoIngestClient("https://cluster.kusto.windows.net", { database: "db", table: "table" });
            const sandbox = sinon.createSandbox();
            const upload = sandbox.stub(client, "uploadToBlobWithRetry").resolves("https://storage.blob.core.windows.net/container/file.csv.gz");
            const queued = sandbox.stub(client, "ingestFromBlob").resolves();
            const cleanup = sandbox.spy(descriptor, "cleanup");

            try {
                const stats = await fs.promises.stat(source.path);
                stats.size = fileSize;
                sandbox.stub(fs, "stat").callThrough().withArgs(source.path).yields(null, stats);

                await assert.rejects(client.ingestFromFile(descriptor), /Empty file/);
                sandbox.assert.notCalled(upload);
                sandbox.assert.notCalled(queued);
                sandbox.assert.notCalled(cleanup);
                assert.strictEqual(descriptor.cleanupTmp, undefined);
            } finally {
                sandbox.restore();
                client.close();
                await source.cleanup();
            }
        });
    });

    describe("#uploadToBlobWithRetry()", () => {
        let client: KustoIngestClient;
        let sandbox: sinon.SinonSandbox;

        beforeEach(() => {
            sandbox = sinon.createSandbox();
            client = new KustoIngestClient("https://cluster.kusto.windows.net");
            sandbox
                .stub(client.resourceManager, "getContainers")
                .resolves(
                    ["first", "second", "third"].map(
                        (account) => new ResourceURI(`https://${account}.blob.core.windows.net/container`, account, ResourceType.Container),
                    ),
                );
        });

        afterEach(() => {
            sandbox.restore();
            client.close();
        });

        it.each(["uploadFile", "uploadData", "uploadStream"] as const)("preserves the final %s error after the retry limit", async (method) => {
            const firstError = new Error("First upload failed");
            const finalError = Object.assign(new Error("Final upload denied"), { code: "AuthorizationFailure", statusCode: 403 });
            const upload = sandbox.stub(BlockBlobClient.prototype, method);
            upload.onFirstCall().rejects(firstError);
            upload.onSecondCall().rejects(finalError);
            const usage = sandbox.stub(client.resourceManager, "reportResourceUsageResult");
            const descriptor =
                method === "uploadFile" ? "file.csv" : new StreamDescriptor(method === "uploadData" ? Buffer.from("payload") : Readable.from(["payload"]));

            await assert.rejects(client.uploadToBlobWithRetry(descriptor, "file", 2), (error) => error === finalError);

            sandbox.assert.calledTwice(upload);
            assert.deepStrictEqual(
                usage.getCalls().map((call) => call.args),
                [
                    ["first", false],
                    ["second", false],
                ],
            );
        });

        it("retries a failed container and reports the successful upload", async () => {
            const upload = sandbox.stub(BlockBlobClient.prototype, "uploadData");
            upload.onFirstCall().rejects(new Error("First upload failed"));
            upload.onSecondCall().resolves();
            const usage = sandbox.stub(client.resourceManager, "reportResourceUsageResult");

            const url = await client.uploadToBlobWithRetry(new StreamDescriptor(Buffer.from("payload")), "file", 2);

            assert.strictEqual(url, "https://second.blob.core.windows.net/container/file");
            sandbox.assert.calledTwice(upload);
            assert.deepStrictEqual(
                usage.getCalls().map((call) => call.args),
                [
                    ["first", false],
                    ["second", true],
                ],
            );
        });
    });

    describe("#ingestFromStream()", () => {
        it("compresses Buffer input before streaming ingestion", async () => {
            const client = new KustoStreamingIngestClient("https://cluster.kusto.windows.net");
            const execute = sinon.stub(KustoClient.prototype, "executeStreamingIngest").resolves();
            const input = Buffer.from("value\n1\n");

            try {
                await client.ingestFromStream(input, { database: "db", table: "table", format: DataFormat.CSV });
                sinon.assert.calledOnce(execute);
                const stream = execute.firstCall.args[2];
                assert.ok(stream instanceof Readable);
                const chunks: Buffer[] = [];
                for await (const chunk of stream) {
                    assert.ok(Buffer.isBuffer(chunk));
                    chunks.push(chunk);
                }
                assert.deepStrictEqual(gunzipSync(Buffer.concat(chunks)), input);
            } finally {
                execute.restore();
                client.close();
            }
        });

        it.concurrent("valid input", () => {
            // TODO: not sure a unit test will be useful here
        });
    });

    describe("#ingestFromBlob()", () => {
        it.concurrent("valid input", () => {
            // TODO: not sure a unit test will be useful here
        });
    });

    describe("Close", () => {
        it.concurrent("Queued Client should not be useable when closed", async () => {
            const c = new KustoIngestClient("Data Source=https://cluster.kusto.windows.net");
            c.close();
            await assert.rejects(c.ingestFromFile("test1"), /Client is closed/);
            await assert.rejects(c.ingestFromStream(Readable.from("")), /Client is closed/);
            await assert.rejects(c.ingestFromBlob("test1"), /Client is closed/);
        });

        it.concurrent("Streaming Client should not be useable when closed", async () => {
            const c = new KustoStreamingIngestClient("Data Source=https://cluster.kusto.windows.net");
            c.close();
            await assert.rejects(c.ingestFromFile("test1"), /Client is closed/);
            await assert.rejects(c.ingestFromStream(Readable.from("")), /Client is closed/);
        });

        it.concurrent("Managed Client should not be useable when closed", async () => {
            const c = new KustoManagedStreamingIngestClient("Data Source=https://cluster.kusto.windows.net", "Data Source=https://cluster.kusto.windows.net");
            c.close();
            await assert.rejects(c.ingestFromFile("test1"), /Client is closed/);
            await assert.rejects(c.ingestFromStream(Readable.from("")), /Client is closed/);
        });
    });
});
