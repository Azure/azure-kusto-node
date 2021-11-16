// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import sinon from "sinon";
import { StreamingIngestClient } from "../index";
import { StreamDescriptor } from "../source/descriptors";
import {KustoIngestClient} from "../source/ingestClient";
import {DataFormat, IngestionProperties} from "../source/ingestionProperties";
import KustoManagedStreamingIngestClient from "../source/managedStreamingIngestClient";
import { Readable } from "stream";

describe("ManagedStreamingIngestClient", function () {
    describe("fallback", function () {
        it("valid input", async function () {
            // Mock ManagedStreamingIngestClient with mocked streamingIngestClient
            const mockedStreamingIngestClient = new StreamingIngestClient("engine");
            const mockedIngestClient = new KustoIngestClient("engine");
            const transientError: any = {};
            const sandbox = sinon.createSandbox();
            const spy = sandbox.spy(mockedIngestClient, "ingestFromStream");
            transientError["@permanent"] = false;
            sinon.stub(mockedStreamingIngestClient, "ingestFromStream").throws(new Error(transientError));
            const mockedManagedStreamingIngestClient: KustoManagedStreamingIngestClient = 
                Object.setPrototypeOf({ streamingIngestClient: mockedStreamingIngestClient,
                    queuedIngestClient: mockedIngestClient, maxRetries: 1 }, KustoManagedStreamingIngestClient.prototype);

            const stream = new Readable();
            stream._read = () => {
                stream.push("this is my string");
                stream.push(null);
            };

            stream.on('data', function(data: Buffer) {
                console.log(data.toString("utf-8"))
              });
              
            try{
                await mockedManagedStreamingIngestClient.ingestFromStream(new StreamDescriptor(stream), new IngestionProperties({
                    database: 'db',
                    table: 't1',
                    format: DataFormat.CSV,
                }));
            } catch (e: unknown) {
                if (e instanceof Error) {
                    let expectedError = "Failed to get cloud info for cluster engine - Error: Request failed with status code 400";
                    if (e.message != expectedError) {
                        throw e;
                    }
                    return;
                }

                throw e;
            }
            sandbox.assert.calledOnce(spy);
        }).timeout(10000);
    });
});
