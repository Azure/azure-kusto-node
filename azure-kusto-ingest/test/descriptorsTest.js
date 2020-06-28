// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const assert = require("assert");
const { FileDescriptor } = require("../source/descriptors");


describe("FileDescriptor", function () {
    describe("#constructor()", function () {
        it("valid input zipped", function () {
            let desc = new FileDescriptor("./data/events.json.gz");

            assert.equal(desc.name, "events.json.gz");
            assert.equal(desc.extension, ".gz");
            assert.equal(desc.zipped, true);

        });

        it("valid input json", function () {
            let desc = new FileDescriptor("./data/events.json");

            assert.equal(desc.name, "events.json");
            assert.equal(desc.extension, ".json");
            assert.equal(desc.zipped, false);

        });
    });
});

