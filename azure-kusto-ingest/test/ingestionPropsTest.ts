// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { DataFormat, IngestionProperties, JsonColumnMapping } from "../source/ingestionProperties";

import {IngestionBlobInfo} from "../source/ingestionBlobInfo";
import {BlobDescriptor} from "../source/descriptors";



describe("IngestionProperties", () => {
    describe("#constructor()", () => {
        it("valid input", () => {
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV});

            assert.strictEqual(props.database, "db");
            assert.strictEqual(props.table, "table");
            assert.strictEqual(props.format, DataFormat.CSV);
        });
    });

    describe("#merge()", () => {
        it("valid input", () => {
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV});

            const otherProps = new IngestionProperties({ingestionMappingReference: "CsvMappingRef"});

            const merged = props.merge(otherProps);

            assert.strictEqual(merged.database, "db");
            assert.strictEqual(merged.table, "table");
            assert.strictEqual(merged.format, DataFormat.CSV);
            assert.strictEqual(merged.ingestionMappingReference, "CsvMappingRef");
        });
    });

    describe("#validate()", () => {
        it("valid input", () => {
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV, ingestionMappingReference: "CsvMappingRef"});

            try {
                props.validate();
            } catch (ex: any) {
                assert.fail(ex);
            }
        });

        it("invalid input", () => {
            const props = new IngestionProperties({});

            try {
                props.validate();
            } catch (ex: any) {
                assert.strictEqual(ex.message, "Must define a target database");
            }
        });

        it("invalid input json", () => {
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.JSON});

            try {
                props.validate();
            } catch (ex: any) {
                assert.strictEqual(ex.message, "Mapping reference required for format json.");
            }
        });

        it("json mapping as additional props on ingestion blob info", () => {
            const columns = [new JsonColumnMapping('Id', '$.Id', 'int'), new JsonColumnMapping('Value', '$.value', 'dynamic')];
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV, ingestionMapping: columns});
            const ingestionBlobInfo = new IngestionBlobInfo(new BlobDescriptor('https://account.blob.core.windows.net/blobcontainer/blobfile.json'), props);
            const reParsed = JSON.parse(JSON.stringify(props.ingestionMapping)); // Stringify and pass to make the object identical to a json one
            assert.deepStrictEqual(JSON.parse(ingestionBlobInfo.AdditionalProperties.ingestionMapping), reParsed);
        });
    });
});
