// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import moment from "moment";
import {KustoResultColumn, KustoResultRow, KustoResultTable} from "../source/models";
import v2 from "./data/response/v2";

const v2Response = v2;

describe("KustoResultRow", () => {
    describe("#constructor()", () => {
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

        it("initialize properly", () => {
            const inputValues = [
                "2016-06-06T15:35:00Z",
                "foo",
                101,
                3.14,
                false,
                3493235670000
            ];

            const actual = new KustoResultRow(inputColumns, inputValues);

            assert.strictEqual(actual.columns.length, inputColumns.length);
        });

        it("column ordinal affects order", () => {
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

            const asJson = actual.toJSON();
            const expectedValues = [
                moment(inputValues[0] as string),
                inputValues[1],
                inputValues[2],
                inputValues[3],
                inputValues[4],
                moment(inputValues[5] as number),
            ];

            for (let index = 0; index < inputColumns.length; index++) {
                const currentActual = asJson[inputColumns[index].name as string];
                if (inputColumns[index].type === "timespan") {
                    assert.strictEqual(Number(currentActual), Number(expectedValues[index]));
                }
                else if (typeof(currentActual) === "object") {
                    assert.strictEqual((currentActual as object).toString(), expectedValues[index].toString());
                } else {
                    assert.strictEqual(currentActual, expectedValues[index]);
                }
            }

        });

        it("custom parsers", () => {
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
                inputValues,
                (t) => t + "-date",
                (t) => t + 5
            );

            const asJson = actual.toJSON();
            const expectedValues = [
                "2016-06-06T15:35:00Z-date",
                inputValues[1],
                inputValues[2],
                inputValues[3],
                inputValues[4],
                3493235670005,
            ];

            for (let index = 0; index < inputColumns.length; index++) {
                const currentActual = asJson[inputColumns[index].name as string];
                if (inputColumns[index].type === "timespan") {
                    assert.strictEqual(Number(currentActual), Number(expectedValues[index]));
                }
                else if (typeof(currentActual) === "object") {
                    assert.strictEqual((currentActual as object).toString(), expectedValues[index].toString());
                } else {
                    assert.strictEqual(currentActual, expectedValues[index]);
                }
            }

        });

        it("mismatching data - less data than columns", () => {
            const inputValues = [
                "2016-06-06T15:35:00Z",
                "foo",
                101,
                3.14,
                false,
                3493235670000
            ];

            const actual = new KustoResultRow(inputColumns, inputValues);

            assert.strictEqual(actual.columns.length, inputColumns.length);
        });

        it("mismatching data - less columns than data ", () => {
            const inputValues = [
                "2016-06-06T15:35:00Z",
                "foo",
                101,
                3.14,
                false,
                3493235670000
            ];

            const actual = new KustoResultRow(inputColumns, inputValues);

            assert.strictEqual(actual.columns.length, inputColumns.length);
        });


        it("mismatching data - type mismatch ", () => {
            const inputValues = [
                "2016-06-06T15:35:00Z",
                "foo",
                101,
                3.14,
                false,
                3493235670000
            ];

            const actual = new KustoResultRow(inputColumns, inputValues);

            assert.strictEqual(actual.columns.length, inputColumns.length);
        });

        it("iterate data", () => {
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

            for (const v of actual.values()) {
                assert.strictEqual(v, inputValues[i]);
                values.push(v);
                i++;
            }
            assert.strictEqual(actual.columns.length, inputValues.length);
            assert.strictEqual(i, inputValues.length);
        });

        it("mapped props", () => {
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

            const actual = new KustoResultRow(inputColumns, inputValues).toJSON<{
                Timestamp: number,
                Name: string,
                Altitude: number,
                Temperature: number,
                IsFlying: boolean,
                TimeFlying: moment.Duration
            }>();

            assert.strictEqual(actual.Timestamp.toString(), expectedValues[0].toString());
            assert.strictEqual(actual.Name, expectedValues[1]);
            assert.strictEqual(actual.Altitude, expectedValues[2]);
            assert.strictEqual(actual.Temperature, expectedValues[3]);
            assert.strictEqual(actual.IsFlying, expectedValues[4]);
            assert.strictEqual(actual.TimeFlying.toString(), expectedValues[5].toString());
        });

        it("value at", () => {
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
                if (typeof (expectedValues[i]) === "object") {
                    assert.strictEqual(JSON.stringify(actual.getValueAt(i)), JSON.stringify(expectedValues[i]));
                } else {
                    assert.strictEqual(actual.getValueAt(i), expectedValues[i]);
                }
            }
        });

    });
});


describe("KustoResultColumn", () => {
    describe("#constructor()", () => {
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

        it("valid input", () => {
            const actual = new KustoResultColumn(rawColumns[1], 0);

            assert.strictEqual(actual.name, rawColumns[1].ColumnName);
        });

        it("invalid input - missing props", () => {
            const actualMissingType = new KustoResultColumn(rawColumns[2], 0);
            const actualMissingName = new KustoResultColumn(rawColumns[3], 0);

            assert.strictEqual(actualMissingName.name, null);
            assert.strictEqual(actualMissingType.type, null);
        });


    });
});


describe("KustoResultTable", () => {
    describe("#constructor()", () => {
        it("valid initialization", () => {
            const actual = new KustoResultTable(v2Response[2]);

            assert.strictEqual(actual.columns.length, 6);
            assert.strictEqual(actual._rows.length, 3);
        });
        it("iterate over rows", () => {
            const actual = new KustoResultTable(v2Response[2]);

            const rows = [];
            for (const row of actual.rows()) {
                rows.push(row);
                assert.strictEqual(
                    JSON.stringify(row),
                    JSON.stringify(new KustoResultRow(row.columns, row.raw)));
            }

            assert.strictEqual(rows.length, 3);
        });
        it("iterate over rows with custom parsers", () => {
            const actual = new KustoResultTable(v2Response[2]);
            const dateParser =(t: string) => t + "-date";
            const timeParser =(t: number) => t + 5;
            actual.dateTimeParser = dateParser;
            actual.timeSpanParser = timeParser;

            const rows = [];
            for (const row of actual.rows()) {
                rows.push(row);
                assert.strictEqual(
                    JSON.stringify(row),
                    JSON.stringify(new KustoResultRow(row.columns, row.raw, dateParser, timeParser)));
            }

            assert.strictEqual(rows.length, 3);
        });
    });
});
