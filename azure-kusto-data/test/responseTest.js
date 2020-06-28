// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const assert = require("assert");
const v2Response = require("./data/response/v2");
const { KustoResponseDataSetV2 } = require("../source/response");

describe("KustoResultDataSet", function () {
    describe("#constructor()", function () {
        it("valid input", function () {
            let actual = new KustoResponseDataSetV2(v2Response);

            assert.equal(actual.primaryResults.length, 1);
            assert.equal(actual.tables.length, 3);
            assert.notEqual(actual.statusTable, null);
        });
    });
});
