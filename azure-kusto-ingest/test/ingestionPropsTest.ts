// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import {
    ApacheAvroColumnMapping,
    AvroColumnMapping,
    ConstantTransformation,
    CsvColumnMapping,
    DataFormat,
    FieldTransformation,
    IngestionMappingKind,
    IngestionProperties,
    JsonColumnMapping,
    OrcColumnMapping,
    ParquetColumnMapping, SStreamColumnMapping,
    W3CLogFileMapping
} from "../source/ingestionProperties";

import { IngestionBlobInfo } from "../source/ingestionBlobInfo";
import { BlobDescriptor } from "../source/descriptors";



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
                assert.strictEqual(ex.message, "Mapping reference required for format 'json'.");
            }
        });

        it("Should error when mapping object doesn't match mapping type", function() {
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV, ingestionMappingKind: IngestionMappingKind.CSV, ingestionMappingColumns: [JsonColumnMapping.withConstantValue("a", "const_value")]});

            try {
                props.validate();
            } catch (ex: any) {
                assert.strictEqual(ex.message, "Invalid columns:\nMapping kind mismatch for column 'a' - expected data format kind -  'Csv', but was 'Json'");
            }
        })

        it("Should error when mapping object doesn't match mapping type multiple objects", function() {
            const props = new IngestionProperties({
                database: "db",
                table: "table",
                format: DataFormat.CSV,
                ingestionMappingKind: IngestionMappingKind.CSV,
                ingestionMappingColumns: [CsvColumnMapping.withConstantValue("a", "const_value"),
                    JsonColumnMapping.withConstantValue("b", "const_value"),
                    AvroColumnMapping.withConstantValue("c", "const_value")]
            });

            try {
                props.validate();
            } catch (ex: any) {
                assert.strictEqual(ex.message, "Invalid columns:\nMapping kind mismatch for column 'b' - expected data format kind -  'Csv', but was" +
                    " 'Json'\nMapping kind mismatch for column 'c' - expected data format kind -  'Csv', but was 'Avro'");
            }
        })


        it("Should error when format doesn't match mapping type", function() {
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV, ingestionMappingKind: IngestionMappingKind.JSON, ingestionMappingColumns: [JsonColumnMapping.withConstantValue("a", "const_value")]});

            try {
                props.validate();
            } catch (ex: any) {
                assert.strictEqual(ex.message, "Mapping kind 'Json' does not match format 'csv' (should be 'Csv')");
            }
        })

        it("Should error when format doesn't match implicit mapping type", function() {
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV, ingestionMappingColumns: [JsonColumnMapping.withConstantValue("a", "const_value")]});

            try {
                props.validate();
            } catch (ex: any) {
                assert.strictEqual(ex.message, "Invalid columns:\nMapping kind mismatch for column 'a' - expected data format kind -  'Csv', but was 'Json'");
            }
        })

        describe("Should return the correct mapping when passing Ordinal", function () {
            const types = [CsvColumnMapping];
            types.forEach(type => {
                it(`should handle correctly for type ${type}`, function () {
                    const result = [{ "Column": "a", "Properties": { "Ordinal": "0" } }, {
                        "Column": "b",
                        "Properties": { "ConstValue": "const_value2" }
                    }]
                    assert.deepStrictEqual([type.withOrdinal("a", 0),
                        type.withConstantValue("b", "const_value2")].map(m => m.toApiMapping()), result);
                })
            });
        })

        describe("Should return the correct mapping when passing ConstantValue", function () {
            const types = [JsonColumnMapping, CsvColumnMapping, AvroColumnMapping, ApacheAvroColumnMapping, SStreamColumnMapping, ParquetColumnMapping, OrcColumnMapping, W3CLogFileMapping];
            types.forEach(type => {
                it(`should handle correctly for type ${type}`, function () {
                    const result = [{ "Column": "a", "Properties": { "ConstValue": "const_value" } }, {
                        "Column": "b",
                        "Properties": { "ConstValue": "const_value2" }
                    }]
                    assert.deepStrictEqual([type.withConstantValue("a", "const_value"),
                        type.withConstantValue("b", "const_value2")].map(m => m.toApiMapping()), result);
                })
            });
        })

        describe("Should return the correct mapping when passing Transform", function () {
            const types = [JsonColumnMapping, AvroColumnMapping, ApacheAvroColumnMapping, SStreamColumnMapping, ParquetColumnMapping, OrcColumnMapping, W3CLogFileMapping];
            types.forEach(type => {
                it(`should handle correctly for type ${type}`, function () {
                    const result = [{ "Column": "a", "Properties": { "ConstValue": "const_value" } }, {
                        "Column": "b",
                        "DataType": "int",
                        "Properties": { "Transform": "SourceLineNumber" }
                    }]
                    assert.deepStrictEqual([type.withConstantValue("a", "const_value"),
                        type.withTransform("b", ConstantTransformation.SourceLineNumber, "int")].map(m => m.toApiMapping()), result);
                })
            });
        })

        describe("Should return the correct mapping when passing Path", function () {
            const types = [JsonColumnMapping, AvroColumnMapping, ApacheAvroColumnMapping, SStreamColumnMapping, ParquetColumnMapping, OrcColumnMapping];
            types.forEach(type => {
                it(`should handle correctly for type ${type}`, function () {
                    const result = [{ "Column": "a", "Properties": { "Path": "$.a" } }, {
                        "Column": "b",
                        "Properties": { "ConstValue": "const_value2" }
                    }]
                    assert.deepStrictEqual([type.withPath("a", "$.a"),
                        type.withConstantValue("b", "const_value2")].map(m => m.toApiMapping()), result);
                })
            });
        })

        describe("Should return the correct mapping when passing Path with transformations and types", function () {
            const types = [JsonColumnMapping, AvroColumnMapping, ApacheAvroColumnMapping, SStreamColumnMapping, ParquetColumnMapping, OrcColumnMapping];
            types.forEach(type => {
                it(`should handle correctly for type ${type}`, function () {
                    const result = [{ "Column": "a", "DataType": "datetime", "Properties": { "Path": "$.a", "Transform": 'DateTimeFromUnixSeconds' } }, {
                        "Column": "b",
                        "DataType": "int",
                        "Properties": { "ConstValue": "const_value2" }
                    }]
                    assert.deepStrictEqual([type.withPath("a", "$.a", "datetime", FieldTransformation.DateTimeFromUnixSeconds),
                        type.withConstantValue("b", "const_value2", "int")].map(m => m.toApiMapping()), result);
                })
            });
        })

        describe("Should return the correct mapping when passing Field with transformations and types", function () {
            const types = [W3CLogFileMapping, AvroColumnMapping, ApacheAvroColumnMapping, SStreamColumnMapping, ParquetColumnMapping, OrcColumnMapping];
            types.forEach(type => {
                it(`should handle correctly for type ${type}`, function () {
                    const result = [{ "Column": "a", "DataType": "datetime", "Properties": { "Field": "a", "Transform": 'DateTimeFromUnixSeconds' } }, {
                        "Column": "b",
                        "DataType": "int",
                        "Properties": { "ConstValue": "const_value2" }
                    }]
                    assert.deepStrictEqual([type.withField("a", "a", "datetime", FieldTransformation.DateTimeFromUnixSeconds),
                        type.withConstantValue("b", "const_value2", "int")].map(m => m.toApiMapping()), result);
                })
            });
        })


        it("json mapping as additional props on ingestion blob info", () => {
            const columns = [new JsonColumnMapping('Id', '$.Id', 'int'), new JsonColumnMapping('Value', '$.value', 'dynamic')];
            const props = new IngestionProperties({database: "db", table: "table", format: DataFormat.CSV, ingestionMappingColumns: columns});
            const ingestionBlobInfo = new IngestionBlobInfo(new BlobDescriptor('https://account.blob.core.windows.net/blobcontainer/blobfile.json'), props);
            const reParsed = [{"Column":"Id","DataType":"int","Properties":{"Path":"$.Id"}},{"Column":"Value","DataType":"dynamic","Properties":{"Path":"$.value"}}];
            assert.deepStrictEqual(JSON.parse(ingestionBlobInfo.AdditionalProperties.ingestionMapping), reParsed);
        });
    });
});
