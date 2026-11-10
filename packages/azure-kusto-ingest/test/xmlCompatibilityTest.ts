// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { createRequire } from "module";
import * as xml from "@azure/core-xml";
import { QueueClient, type IHttpClient, type WebResource } from "@azure/storage-queue";
import { BlockBlobClient, ContainerClient } from "@azure/storage-blob";

const requireFromTest = createRequire(import.meta.url);
// The parser's CommonJS entry point embeds its builder instead of importing the ESM dependency.
const commonJsXml: typeof xml = requireFromTest("@azure/core-xml");
const commonJsQueue: typeof import("@azure/storage-queue") = requireFromTest("@azure/storage-queue");
const commonJsBlob: typeof import("@azure/storage-blob") = requireFromTest("@azure/storage-blob");

const modules = [
    { name: "ESM", xml, QueueClient, BlockBlobClient, ContainerClient },
    {
        name: "CommonJS",
        xml: commonJsXml,
        QueueClient: commonJsQueue.QueueClient,
        BlockBlobClient: commonJsBlob.BlockBlobClient,
        ContainerClient: commonJsBlob.ContainerClient,
    },
];

const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const messageResponse = [
    "<QueueMessagesList><QueueMessage>",
    "<MessageId>message-id</MessageId>",
    "<InsertionTime>Mon, 26 Oct 2026 00:00:00 GMT</InsertionTime>",
    "<ExpirationTime>Mon, 02 Nov 2026 00:00:00 GMT</ExpirationTime>",
    "<PopReceipt>receipt</PopReceipt>",
    "<TimeNextVisible>Mon, 26 Oct 2026 00:00:00 GMT</TimeNextVisible>",
    "<DequeueCount>1</DequeueCount>",
    "<MessageText>caf\u00e9 &amp; \ud83d\ude00</MessageText>",
    "</QueueMessage></QueueMessagesList>",
].join("");

const createHttpClient = (status: number, bodyAsText: string, checkRequest?: (request: WebResource) => void): IHttpClient => ({
    sendRequest(request) {
        checkRequest?.(request);
        const headers = request.headers.clone();
        headers.set("content-type", "application/xml");
        headers.set("etag", '"etag"');
        headers.set("last-modified", "Mon, 26 Oct 2026 00:00:00 GMT");
        return Promise.resolve({ request, status, headers, bodyAsText });
    },
});

describe.each(modules)("$name XML compatibility", ({ xml: xmlModule, QueueClient: Queue, BlockBlobClient: Blob, ContainerClient: Container }) => {
    it("preserves text, namespace attributes, and string values", async () => {
        const value = {
            item: { $: { "xml:lang": "en", title: 'caf\u00e9 & <tag> "quotes"' }, _: 'caf\u00e9 & <tag> "quotes"' },
            id: "00123",
            flag: "false",
        };

        assert.deepStrictEqual(await xmlModule.parseXML(xmlModule.stringifyXML(value)), value);
    });

    it("round-trips CDATA delimiters without injecting XML elements", async () => {
        const value = "prefix]]><unexpected>marker</unexpected><![CDATA[suffix";
        const serialized = xmlModule.stringifyXML({ value: { __cdata: value } });

        assert.deepStrictEqual(await xmlModule.parseXML(serialized), { value });
    });

    it("preserves numeric-reference handling while decoding predefined entities", async () => {
        const parsed = await xmlModule.parseXML("<root><value>caf&#233; &amp; &#x1F600;</value></root>");

        assert.deepStrictEqual(parsed, { value: "caf&#233; & &#x1F600;" });
    });

    it("preserves queue message serialization and enqueue response fields", async () => {
        const message = Buffer.from(JSON.stringify({ Database: "db", BlobPath: "https://account.blob.core.windows.net/a?x=1&y=2" })).toString("base64");
        const httpClient = createHttpClient(201, messageResponse, (request) => {
            assert.strictEqual(request.method, "POST");
            assert.strictEqual(request.body, `${xmlDeclaration}<QueueMessage><MessageText>${message}</MessageText></QueueMessage>`);
        });
        const client = new Queue("https://account.queue.core.windows.net/queue?sig=fixture", undefined, {
            httpClient,
            retryOptions: { maxTries: 1 },
        });

        const result = await client.sendMessage(message);

        assert.strictEqual(result.messageId, "message-id");
        assert.strictEqual(result.popReceipt, "receipt");
    });

    it("decodes queue response entities without changing message metadata", async () => {
        const client = new Queue("https://account.queue.core.windows.net/queue?sig=fixture", undefined, {
            httpClient: createHttpClient(200, messageResponse),
            retryOptions: { maxTries: 1 },
        });

        const result = await client.receiveMessages();

        assert.strictEqual(result.receivedMessageItems.length, 1);
        assert.strictEqual(result.receivedMessageItems[0].messageText, "caf\u00e9 & \ud83d\ude00");
        assert.strictEqual(result.receivedMessageItems[0].dequeueCount, 1);
        assert.strictEqual(result.receivedMessageItems[0].popReceipt, "receipt");
    });

    it("preserves blob block-list serialization", async () => {
        const httpClient = createHttpClient(201, "", (request) => {
            assert.strictEqual(request.method, "PUT");
            assert.strictEqual(request.body, `${xmlDeclaration}<BlockList><Latest>YmxvY2sx</Latest><Latest>YmxvY2sy</Latest></BlockList>`);
        });
        const client = new Blob("https://account.blob.core.windows.net/container/blob?sig=fixture", undefined, {
            httpClient,
            retryOptions: { maxTries: 1 },
        });

        const result = await client.commitBlockList(["YmxvY2sx", "YmxvY2sy"]);

        assert.strictEqual(result.etag, '"etag"');
    });

    it("preserves blob names and metadata while decoding XML entities", async () => {
        const response = [
            '<EnumerationResults ServiceEndpoint="https://account.blob.core.windows.net/" ContainerName="container">',
            "<Blobs><Blob><Name>a&amp;b.txt</Name><Properties>",
            "<Creation-Time>Mon, 26 Oct 2026 00:00:00 GMT</Creation-Time>",
            "<Last-Modified>Mon, 26 Oct 2026 00:00:00 GMT</Last-Modified>",
            '<Etag>"etag"</Etag><Content-Length>3</Content-Length><Content-Type>text/plain</Content-Type><BlobType>BlockBlob</BlobType>',
            "</Properties><Metadata><title>caf\u00e9 &amp; text</title><id>00123</id></Metadata>",
            "</Blob></Blobs><NextMarker/></EnumerationResults>",
        ].join("");
        const client = new Container("https://account.blob.core.windows.net/container?sig=fixture", undefined, {
            httpClient: createHttpClient(200, response),
            retryOptions: { maxTries: 1 },
        });

        const result = await client.listBlobsFlat({ includeMetadata: true }).next();

        assert.ok(!result.done);
        assert.strictEqual(result.value.name, "a&b.txt");
        assert.deepStrictEqual(result.value.metadata, { title: "caf\u00e9 & text", id: "00123" });
        assert.strictEqual(result.value.properties.contentLength, 3);
    });
});
