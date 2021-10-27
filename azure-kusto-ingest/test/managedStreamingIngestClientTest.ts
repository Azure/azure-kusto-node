// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import sinon from "sinon";
import { StreamingIngestClient } from "..";
import { StreamDescriptor } from "../source/descriptors";
import {KustoIngestClient} from "../source/ingestClient";
import {DataFormat, IngestionProperties} from "../source/ingestionProperties";
import KustoManagedStreamingIngestClient from "../source/managedStreamingIngestClient";
var Stream = require('stream');

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
            var stream = new Stream();
            
            stream.on('data', function(data: any) {
                console.log(data)
              });
              
            stream.emit('data', 'this is my string');
            try{
                await mockedManagedStreamingIngestClient.ingestFromStream(new StreamDescriptor(stream), new IngestionProperties({
                    database: 'db',
                    table: 't1',
                    format: DataFormat.CSV,
                }));
            } catch {}
            sandbox.assert.calledOnce(spy);
        }).timeout(10000);
    });
});
