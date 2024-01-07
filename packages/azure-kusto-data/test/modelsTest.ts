// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { KustoResultColumn, KustoResultRow, KustoResultTable } from "../src/models";
import v2 from "./data/response/v2";
import { parseKustoTimestampToMillis } from "../src/timeUtils";

const v2Response = v2;

describe("KustoResultRow", () => {
    describe("#constructor()", () => {
        const rawColumns = [
            {
                ColumnName: "Timestamp",
                ColumnType: "datetime",
            },
            {
                ColumnName: "Name",
                ColumnType: "string",
            },
            {
                ColumnName: "Altitude",
                ColumnType: "long",
            },
            {
                ColumnName: "Temperature",
                ColumnType: "real",
            },
            {
                ColumnName: "IsFlying",
                ColumnType: "bool",
            },
            {
                ColumnName: "TimeFlying",
                ColumnType: "timespan",
            },
        ];

        const inputColumns = rawColumns.map((c, i) => new KustoResultColumn(c, i));

        it.concurrent("initialize properly", () => {
            const inputValues = ["2016-06-06T15:35:00Z", "foo", 101, 3.14, false, "1.02:03:04.567"];

            const actual = new KustoResultRow(inputColumns, inputValues);

            assert.strictEqual(actual.columns.length, inputColumns.length);
        });

        it.concurrent("column ordinal affects order", () => {
            const inputValues = ["2016-06-06T15:35:00Z", "foo", 101, 3.14, false, "1.02:03:04.567"];

            const reverseOrderColumns = rawColumns.slice().reverse();
            const actual = new KustoResultRow(
                reverseOrderColumns.map((c, i) => new KustoResultColumn(c, rawColumns.length - i - 1)),
                inputValues
            );

            const asJson = actual.toJSON();
            const expectedValues = [
                new Date(inputValues[0] as string),
                inputValues[1],
                inputValues[2],
                inputValues[3],
                inputValues[4],
                parseKustoTimestampToMillis(inputValues[5] as string),
            ];

            for (let index = 0; index < inputColumns.length; index++) {
                const currentActual = asJson[inputColumns[index].name as string];
                if (typeof currentActual === "object") {
                    assert.strictEqual((currentActual as object).toString(), expectedValues[index]?.toString());
                } else {
                    assert.strictEqual(currentActual, expectedValues[index]);
                }
            }
        });

        it.concurrent("custom parsers", () => {
            const inputValues = ["2016-06-06T15:35:00Z", "foo", 101, 3.14, false, "1.02:03:04.567"];

            const reverseOrderColumns = rawColumns.slice().reverse();
            const actual = new KustoResultRow(
                reverseOrderColumns.map((c, i) => new KustoResultColumn(c, rawColumns.length - i - 1)),
                inputValues,
                (t) => (t || "") + "-date",
                (t) => (t || "") + "-time"
            );

            const asJson = actual.toJSON();
            const expectedValues = ["2016-06-06T15:35:00Z-date", inputValues[1], inputValues[2], inputValues[3], inputValues[4], "1.02:03:04.567-time"];

            for (let index = 0; index < inputColumns.length; index++) {
                const currentActual = asJson[inputColumns[index].name as string];
                if (typeof currentActual === "object") {
                    assert.strictEqual((currentActual as object).toString(), expectedValues[index].toString());
                } else {
                    assert.strictEqual(currentActual, expectedValues[index]);
                }
            }
        });

        it.concurrent("default parsers nulls", () => {
            const dates = ["2016-06-06T15:35:00Z", "", null];
            const times = ["1.02:03:04.0050006", "", null];

            const columns = [
                new KustoResultColumn({ ColumnName: "date", ColumnType: "datetime" }, 0),
                new KustoResultColumn({ ColumnName: "time", ColumnType: "timespan" }, 1),
            ];
            const actual = [
                new KustoResultRow(columns, [dates[0], times[0]]),
                new KustoResultRow(columns, [dates[1], times[1]]),
                new KustoResultRow(columns, [dates[2], times[2]]),
            ];

            assert.strictEqual((actual[0].date as Date).toString(), new Date(dates[0]!).toString());
            assert.strictEqual(actual[0].time, 93784005.0006);
            assert.strictEqual(actual[1].date, null);
            assert.strictEqual(actual[1].time, null);
            assert.strictEqual(actual[2].date, null);
        });

        it.concurrent("mismatching data - less data than columns", () => {
            const inputValues = ["2016-06-06T15:35:00Z", "foo", 101, 3.14, false, "1.02:03:04.567"];

            const actual = new KustoResultRow(inputColumns, inputValues);

            assert.strictEqual(actual.columns.length, inputColumns.length);
        });

        it.concurrent("mismatching data - less columns than data ", () => {
            const inputValues = ["2016-06-06T15:35:00Z", "foo", 101, 3.14, false, "1.02:03:04.567"];

            const actual = new KustoResultRow(inputColumns, inputValues);

            assert.strictEqual(actual.columns.length, inputColumns.length);
        });

        it.concurrent("mismatching data - type mismatch ", () => {
            const inputValues = ["2016-06-06T15:35:00Z", "foo", 101, 3.14, false, "1.02:03:04.567"];

            const actual = new KustoResultRow(inputColumns, inputValues);

            assert.strictEqual(actual.columns.length, inputColumns.length);
        });

        it.concurrent("iterate data", () => {
            const inputValues = ["2016-06-06T15:35:00Z", "foo", 101, 3.14, false, "1.02:03:04.567"];

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

        it.concurrent("mapped props", () => {
            const inputValues = ["2016-06-06T15:35:00Z", "foo", 101, 3.14, false, "1.02:03:04.567"];

            const expectedValues = [new Date("2016-06-06T15:35:00Z"), "foo", 101, 3.14, false, 93784567];

            const actual = new KustoResultRow(inputColumns, inputValues).toJSON<{
                Timestamp: number;
                Name: string;
                Altitude: number;
                Temperature: number;
                IsFlying: boolean;
                TimeFlying: number;
            }>();

            assert.strictEqual(actual.Timestamp.toString(), expectedValues[0].toString());
            assert.strictEqual(actual.Name, expectedValues[1]);
            assert.strictEqual(actual.Altitude, expectedValues[2]);
            assert.strictEqual(actual.Temperature, expectedValues[3]);
            assert.strictEqual(actual.IsFlying, expectedValues[4]);
            assert.strictEqual(actual.TimeFlying.toString(), expectedValues[5].toString());
        });

        it.concurrent("value at", () => {
            const inputValues = ["2016-06-06T15:35:00Z", "foo", 101, 3.14, false, "1.02:03:04.567"];

            const expectedValues = [new Date("2016-06-06T15:35:00Z"), "foo", 101, 3.14, false, 93784567];

            const actual = new KustoResultRow(inputColumns, inputValues);

            for (let i = 0; i < inputValues.length; i++) {
                if (typeof expectedValues[i] === "object") {
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
                ColumnName: "Timestamp",
                ColumnType: "datetime",
            },
            {
                ColumnName: "Name",
                ColumnType: "string",
            },
            {
                ColumnName: "Altitude",
            },
            {
                ColumnType: "real",
            },
            {
                ColumnName: "IsFlying",
                ColumnType: "bool",
            },
            {
                ColumnName: "TimeFlying",
                ColumnType: "timespan",
            },
        ];

        it.concurrent("valid input", () => {
            const actual = new KustoResultColumn(rawColumns[1], 0);

            assert.strictEqual(actual.name, rawColumns[1].ColumnName);
        });

        it.concurrent("invalid input - missing props", () => {
            const actualMissingType = new KustoResultColumn(rawColumns[2], 0);
            const actualMissingName = new KustoResultColumn(rawColumns[3], 0);

            assert.strictEqual(actualMissingName.name, null);
            assert.strictEqual(actualMissingType.type, null);
        });
    });
});

describe("KustoResultTable", () => {
    describe("#constructor()", () => {
        it.concurrent("valid initialization", () => {
            const actual = new KustoResultTable(v2Response[2]);

            assert.strictEqual(actual.columns.length, 6);
            assert.strictEqual(actual._rows.length, 3);
        });
        it.concurrent("iterate over rows", () => {
            const actual = new KustoResultTable(v2Response[2]);

            const rows = [];
            for (const row of actual.rows()) {
                rows.push(row);
                assert.strictEqual(JSON.stringify(row), JSON.stringify(new KustoResultRow(row.columns, row.raw)));
            }

            assert.strictEqual(rows.length, 3);
        });
        it.concurrent("iterate over rows with custom parsers", () => {
            const actual = new KustoResultTable(v2Response[2]);
            const dateParser = (t: string | null) => (t || "") + "-date";
            const timeParser = (t: string | null) => (t || "") + "-time";
            actual.dateTimeParser = dateParser;
            actual.timeSpanParser = timeParser;

            const rows = [];
            for (const row of actual.rows()) {
                rows.push(row);
                assert.strictEqual(JSON.stringify(row), JSON.stringify(new KustoResultRow(row.columns, row.raw, dateParser, timeParser)));
            }

            assert.strictEqual(rows.length, 3);
        });

        describe("test defaultTimespanParser", () => {
            it.concurrent("test nanoseconds", () => {
                const actual = new KustoResultTable(v2Response[2]);
                const timeParser = actual.timeSpanParser;
                const time = timeParser("00:00:00.000000005");
                assert.strictEqual(time, 0.000005);
            });

            it.concurrent("test complex timespan", () => {
                const actual = new KustoResultTable(v2Response[2]);
                const timeParser = actual.timeSpanParser;
                const time = timeParser("1.02:03:04.0050006");
                assert.strictEqual(time, 93784005.0006);
            });

            it.concurrent("test negative", () => {
                const actual = new KustoResultTable(v2Response[2]);
                const timeParser = actual.timeSpanParser;
                const time = timeParser("-1.02:03:04.0050006");
                // 2 digits precision
                assert.strictEqual(time, -93784005.0006);
            });
        });
    });
});
