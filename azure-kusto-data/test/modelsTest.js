const assert = require("assert");
const moment = require("moment");

const { KustoResultTable, KustoResultColumn, KustoResultRow } = require("../source/models");

const v2Response = require("./data/response/v2.json");

describe("KustoResultRow", function () {
    describe("#constructor()", function () {
        const rawColumns = [
            {
                "ColumnName": "Timestamp",
                "ColumnType": "datetime"
            },
            {
                "ColumnName": "Name",
                "ColumnType": "string"
            },
            {
                "ColumnName": "Altitude",
                "ColumnType": "long"
            },
            {
                "ColumnName": "Temperature",
                "ColumnType": "real"
            },
            {
                "ColumnName": "IsFlying",
                "ColumnType": "bool"
            },
            {
                "ColumnName": "TimeFlying",
                "ColumnType": "timespan"
            }
        ];

        const inputColumns = rawColumns.map((c, i) => new KustoResultColumn(c, i));

        it("initialize properly", function () {
            const inputValues = [
                "2016-06-06T15:35:00Z",
                "foo",
                101,
                3.14,
                false,
                3493235670000
            ];

            const actual = new KustoResultRow(inputColumns, inputValues);

            assert.equal(actual.columns.length, inputColumns.length);
        });

        it("column ordinal affects order", function () {
            const inputValues = [
                "2016-06-06T15:35:00Z",
                "foo",
                101,
                3.14,
                false,
                3493235670000
            ];

            const reverseOrderColumns = rawColumns.slice().reverse();            
            const actual = new KustoResultRow(
                reverseOrderColumns.map((c, i) => new KustoResultColumn(c, rawColumns.length - i - 1)),
                inputValues
            );

            let asJson = actual.toJson();
            let expectedValues = [
                moment(inputValues[0]),
                inputValues[1],
                inputValues[2],
                inputValues[3],
                inputValues[4],
                moment(inputValues[5]),
            ];

            for (let index = 0; index < inputColumns.length; index++) {        
                let actual = asJson[inputColumns[index].name];
                if (inputColumns[index].type === "timespan") {
                    assert.equal(Number(actual), expectedValues[index]);
                }
                else if (typeof(actual) == "object") {
                    assert.equal(actual.toString(), expectedValues[index].toString());
                } else {
                    assert.equal(actual, expectedValues[index]);
                }
            }

        });

        it("mismatching data - less data than columns", function () {
            const inputValues = [
                "2016-06-06T15:35:00Z",
                "foo",
                101,
                3.14,
                false,
                3493235670000
            ];

            const actual = new KustoResultRow(inputColumns, inputValues);

            assert.equal(actual.columns.length, inputColumns.length);
        });

        it("mismatching data - less columns than data ", function () {
            const inputValues = [
                "2016-06-06T15:35:00Z",
                "foo",
                101,
                3.14,
                false,
                3493235670000
            ];

            const actual = new KustoResultRow(inputColumns, inputValues);

            assert.equal(actual.columns.length, inputColumns.length);
        });


        xit("mismatching data - type mismatch ", function () {
            const inputValues = [
                "2016-06-06T15:35:00Z",
                "foo",
                101,
                3.14,
                false,
                3493235670000
            ];

            const actual = new KustoResultRow(inputColumns, inputValues);

            assert.equal(actual.columns.length, inputColumns.length);
        });

        it("iterate data", function () {
            const inputValues = [
                "2016-06-06T15:35:00Z",
                "foo",
                101,
                3.14,
                false,
                3493235670000
            ];

            const actual = new KustoResultRow(inputColumns, inputValues);

            const values = [];

            let i = 0;

            for (let v of actual.values()) {
                assert.equal(v, inputValues[i]);
                values.push(v);
                i++;
            }
            assert.equal(actual.columns.length, inputValues.length);
        });

        it("mapped props", function () {
            const inputValues = [
                "2016-06-06T15:35:00Z",
                "foo",
                101,
                3.14,
                false,
                3493235670000
            ];

            const expectedValues = [
                moment("2016-06-06T15:35:00Z"),
                "foo",
                101,
                3.14,
                false,
                moment.duration(3493235670000, "ms")
            ];

            const actual = new KustoResultRow(inputColumns, inputValues);

            assert.equal(actual.Timestamp.toString(), expectedValues[0].toString());
            assert.equal(actual.Name, expectedValues[1]);
            assert.equal(actual.Altitude, expectedValues[2]);
            assert.equal(actual.Temperature, expectedValues[3]);
            assert.equal(actual.IsFlying, expectedValues[4]);
            assert.equal(actual.TimeFlying.toString(), expectedValues[5].toString());
        });

        it("value at", function () {
            const inputValues = [
                "2016-06-06T15:35:00Z",
                "foo",
                101,
                3.14,
                false,
                3493235670000
            ];

            const expectedValues = [
                moment("2016-06-06T15:35:00Z"),
                "foo",
                101,
                3.14,
                false,
                moment.duration(3493235670000, "ms")
            ];

            const actual = new KustoResultRow(inputColumns, inputValues);

            for (let i = 0; i < inputValues.length; i++) {
                if (typeof (expectedValues[i]) == "object") {
                    assert.equal(JSON.stringify(actual.getValueAt(i)), JSON.stringify(expectedValues[i]));
                } else {
                    assert.equal(actual.getValueAt(i), expectedValues[i]);
                }
            }
        });

    });
});


describe("KustoResultColumn", function () {
    describe("#constructor()", function () {
        const rawColumns = [
            {
                "ColumnName": "Timestamp",
                "ColumnType": "datetime"
            },
            {
                "ColumnName": "Name",
                "ColumnType": "string"
            },
            {
                "ColumnName": "Altitude",
            },
            {
                "ColumnType": "real"
            },
            {
                "ColumnName": "IsFlying",
                "ColumnType": "bool"
            },
            {
                "ColumnName": "TimeFlying",
                "ColumnType": "timespan"
            }
        ];

        it("valid input", function () {
            const actual = new KustoResultColumn(rawColumns[1], 0);

            assert.equal(actual.name, rawColumns[1].ColumnName);
        });

        it("invalid input - missing props", function () {
            const actualMissingType = new KustoResultColumn(rawColumns[2], 0);
            const actualMissingName = new KustoResultColumn(rawColumns[3], 0);

            assert.equal(actualMissingName.name, null);
            assert.equal(actualMissingType.type, null);
        });


    });
});


describe("KustoResultTable", function () {
    describe("#constructor()", function () {
        it("valid initialization", function () {
            const actual = new KustoResultTable(v2Response[2]);

            assert.equal(actual.columns.length, 6);
            assert.equal(actual._rows.length, 3);
        });
        it("iterate over rows", function () {
            const actual = new KustoResultTable(v2Response[2]);

            let rows = [];
            for (let row of actual.rows()) {
                rows.push(row);
                assert.equal(
                    JSON.stringify(row),
                    JSON.stringify(new KustoResultRow(row.columns, row.raw)));
            }

            assert.equal(rows.length, 3);
        });
    });
});
