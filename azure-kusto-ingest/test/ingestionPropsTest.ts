// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import {IngestionProperties, JsonColumnMapping} from "../source/ingestionProperties";

import {IngestionBlobInfo} from "../source/ingestionBlobInfo";
import {BlobDescriptor} from "../source/descriptors";

const { DataFormat } = require("../source/ingestionProperties");

describe("IngestionProperties", function () {
    describe("#constructor()", function () {
        it("valid input", function () {
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV});

            assert.strictEqual(props.database, "db");
            assert.strictEqual(props.table, "table");
            assert.strictEqual(props.format, DataFormat.CSV);
        });
    });

    describe("#merge()", function () {
        it("valid input", function () {
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV});

            const otherProps = new IngestionProperties({ingestionMappingReference: "CsvMappingRef"});

            const merged = props.merge(otherProps);

            assert.strictEqual(merged.database, "db");
            assert.strictEqual(merged.table, "table");
            assert.strictEqual(merged.format, DataFormat.CSV);
            assert.strictEqual(merged.ingestionMappingReference, "CsvMappingRef");
        });
    });

    describe("#validate()", function () {
        it("valid input", function () {
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV, ingestionMappingReference: "CsvMappingRef"});

            try {
                props.validate();
            } catch (ex) {
                assert.fail(ex);
            }
        });

        it("invalid input", function () {
            const props = new IngestionProperties({});

            try {
                props.validate();
            } catch (ex) {
                assert.strictEqual(ex.message, "Must define a target database");
            }
        });

        it("invalid input json", function () {
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.JSON});

            try {
                props.validate();
            } catch (ex) {
                assert.strictEqual(ex.message, "Json must have a mapping defined");
            }
        });

        it("json mapping as additional props on ingestion blob info", function () {
            const columns = [new JsonColumnMapping('Id', '$.Id', 'int'), new JsonColumnMapping('Value', '$.value', 'dynamic')];
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV, ingestionMapping: columns});
            const ingestionBlobInfo = new IngestionBlobInfo(new BlobDescriptor('https://account.blob.core.windows.net/blobcontainer/blobfile.json'), props);
            const reParsed = JSON.parse(JSON.stringify(props.ingestionMapping)); // Stringify and pass to make the object identical to a json one
            assert.deepStrictEqual(JSON.parse(ingestionBlobInfo.AdditionalProperties.ingestionMapping), reParsed);
        });
    });
});
