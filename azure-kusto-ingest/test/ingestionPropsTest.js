const assert = require("assert");

const IngestionProperties = require("../source/ingestionProperties").IngestionProperties;
const JsonColumnMapping = require("../source/ingestionProperties").JsonColumnMapping;
const IngestionBlobInfo = require("../source/ingestionBlobInfo");
const { DataFormat } = require("../source/ingestionProperties");

describe("IngestionProperties", function () {
    describe("#constructor()", function () {
        it("valid input", function () {
            let props = new IngestionProperties("db", "table", DataFormat.csv);

            assert.equal(props.database, "db");
            assert.equal(props.table, "table");
            assert.equal(props.format, DataFormat.csv);
        });
    });

    describe("#merge()", function () {
        it("valid input", function () {
            let props = new IngestionProperties("db", "table", DataFormat.csv);

            let otherProps = new IngestionProperties(null, null, null, null, "CsvMappingRef");

            let merged = props.merge(otherProps);

            assert.equal(merged.database, "db");
            assert.equal(merged.table, "table");
            assert.equal(merged.format, DataFormat.csv);
            assert.equal(merged.mappingReference, "CsvMappingRef");
        });
    });

    describe("#validate()", function () {
        it("valid input", function () {
            let props = new IngestionProperties("db", "table", DataFormat.csv, null, "CsvMappingRef");

            try {
                props.validate();
            } catch (ex) {
                assert.fail(ex);
            }
        });

        it("invalid input", function () {
            let props = new IngestionProperties();

            try {
                props.validate();
            } catch (ex) {
                assert.equal(ex.message, "Must define a target database");
            }
        });

        it("invalid input json", function () {
            let props = new IngestionProperties("db", "table", DataFormat.json);

            try {
                props.validate();
            } catch (ex) {
                assert.equal(ex.message, "Json must have a mapping defined");
            }
        });

        it("json mapping as additional props on ingestion blob info", function () {
            let columns = [new JsonColumnMapping('Id', '$.Id', 'int'), new JsonColumnMapping('Value', '$.value', 'dynamic')];
            let props = new IngestionProperties("db", "table", DataFormat.json, columns);
            let ingestionBlobInfo = new IngestionBlobInfo('https://account.blob.core.windows.net/blobcontainer/blobfile.json', props);
            
            assert.deepEqual(JSON.parse(ingestionBlobInfo.AdditionalProperties.jsonMapping), props.mapping);
        });
    });
});
