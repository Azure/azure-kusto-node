// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { FileDescriptor } from "../source/descriptors";

describe("FileDescriptor", () => {
    describe("#constructor()", () => {
        it("valid input zipped", () => {
            const desc = new FileDescriptor("./data/events.json.gz");

            assert.strictEqual(desc.name, "events.json.gz");
            assert.strictEqual(desc.extension, ".gz");
            assert.strictEqual(desc.zipped, true);
        });

        it("valid input json", () => {
            const desc = new FileDescriptor("./data/events.json");

            assert.strictEqual(desc.name, "events.json");
            assert.strictEqual(desc.extension, ".json");
            assert.strictEqual(desc.zipped, false);
        });
    });
});
