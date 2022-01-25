// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";

import v2Response from "./data/response/v2.json";
import { KustoResponseDataSetV2 } from "../source/response";


describe("KustoResultDataSet", function () {
    describe("#constructor()", function () {
        it("valid input", function () {
            // @ts-ignore - it can't infer the type from the json, but it's valid
            const actual = new KustoResponseDataSetV2(v2Response);

            assert.strictEqual(actual.primaryResults.length, 1);
            assert.strictEqual(actual.tables.length, 3);
            assert.notEqual(actual.statusTable, null);
        });
    });
});
