// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { KustoResultColumn, KustoResultRow, KustoResultTable } from "../src/models.js";
import v2 from "./data/response/v2.js";
import { parseKustoTimestampToMillis } from "../src/timeUtils.js";

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
                inputValues,
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
                (t) => (t || "") + "-time",
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

        it.concurrent.each(["GET /health", null])("iterate data with a raw column containing %p", (value) => {
            const columns = [
                new KustoResultColumn({ ColumnName: "raw", ColumnType: "string" }, 0),
                new KustoResultColumn({ ColumnName: "status", ColumnType: "long" }, 1),
                new KustoResultColumn({ ColumnName: "level", ColumnType: "string" }, 2),
            ];
            const inputValues = [value, 200, "Info"];
            const actual = new KustoResultRow(columns, inputValues);

            assert.deepStrictEqual([...actual.values()], inputValues);
            assert.strictEqual(actual.raw, inputValues);
            assert.strictEqual(actual.getValueAt(0), value);
            assert.deepStrictEqual(actual.toJSON(), { raw: value, status: 200, level: "Info" });
        });

        it.concurrent.each(["message", "raw"])("support structurally typed proxy rows with a %s column", (name) => {
            const columns = [new KustoResultColumn({ ColumnName: name, ColumnType: "string" }, 0)];
            const inputValues = ["value"];
            const rowLike: Pick<KustoResultRow, "columns" | "raw" | "values" | "getValueAt" | "toJson" | "toJSON" | "toString"> = new Proxy(
                new KustoResultRow(columns, inputValues),
                {},
            );
            const actual: KustoResultRow = rowLike;
            const expected = { [name]: "value" };

            assert.strictEqual(actual.getValueAt(0), "value");
            assert.deepStrictEqual(actual.toJSON(), expected);
            assert.deepStrictEqual(actual.toJson(), expected);
            assert.strictEqual(actual.toString(), JSON.stringify(expected));
            assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected));
            assert.deepStrictEqual([...actual.values()], inputValues);
            assert.deepStrictEqual({ ...actual }, name === "message" ? { columns, raw: inputValues, message: "value" } : { columns, raw: inputValues });
        });

        it.concurrent.each(["columns", "values", "getValueAt", "toJSON", "toJson", "toString", "constructor", "hasOwnProperty", "__proto__"])(
            "preserve the row API and serialize a %s column",
            (name) => {
                const value = { message: "column value" };
                const inputValues = [value, "Info"];
                const table = new KustoResultTable({
                    TableName: "PrimaryResult",
                    Columns: [
                        { ColumnName: name, ColumnType: "dynamic" },
                        { ColumnName: "level", ColumnType: "string" },
                    ],
                    Rows: [inputValues],
                });
                const expected = { [name]: value, level: "Info" };
                const rows: KustoResultRow[] = [...table.rows(), table[0]];

                for (const actual of rows) {
                    assert.strictEqual(Object.getPrototypeOf(actual), KustoResultRow.prototype);
                    assert.strictEqual(actual.constructor, KustoResultRow);
                    assert.strictEqual(typeof actual.hasOwnProperty, "function");
                    assert.strictEqual(actual.columns, table.columns);
                    assert.strictEqual(actual.raw, inputValues);
                    assert.deepStrictEqual([...actual.values()], inputValues);
                    assert.strictEqual(actual.getValueAt(0), value);
                    assert.deepStrictEqual(actual.toJSON(), expected);
                    assert.deepStrictEqual(actual.toJson(), expected);
                    assert.strictEqual(actual.toString(), JSON.stringify(expected));
                    assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected));

                    actual.level = "Warning";
                    assert.strictEqual(actual.getValueAt(1), "Warning");
                    assert.deepStrictEqual(actual.toJSON(), { [name]: value, level: "Warning" });
                }

                const expectedTable = { name: "PrimaryResult", data: [expected] };
                assert.deepStrictEqual(table.toJSON(), expectedTable);
                assert.strictEqual(table.toString(), JSON.stringify(expectedTable));
                assert.strictEqual(JSON.stringify(table), JSON.stringify(expectedTable));
            },
        );
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

        it.concurrent("indexed rows use the current custom parsers, including null values", () => {
            const actual = new KustoResultTable({
                TableName: "PrimaryResult",
                Columns: [
                    { ColumnName: "ts", ColumnType: "datetime" },
                    { ColumnName: "dur", ColumnType: "timespan" },
                ],
                Rows: [
                    ["2026-01-01T00:00:00Z", "01:00:00"],
                    [null, null],
                ],
            });
            actual.dateTimeParser = (value) => `dt:${value}`;
            actual.timeSpanParser = (value) => `sp:${value}`;
            const expected = [
                { ts: "dt:2026-01-01T00:00:00Z", dur: "sp:01:00:00" },
                { ts: "dt:null", dur: "sp:null" },
            ];

            for (const [index, row] of [...actual.rows()].entries()) {
                const indexedRow: KustoResultRow = actual[index];
                assert.deepStrictEqual(row.toJSON(), expected[index]);
                assert.deepStrictEqual(indexedRow.toJSON(), expected[index]);
            }

            actual.dateTimeParser = (value) => `updated-dt:${value}`;
            actual.timeSpanParser = (value) => `updated-sp:${value}`;
            const updatedIndexedRow: KustoResultRow = actual[0];
            assert.deepStrictEqual(updatedIndexedRow.toJSON(), {
                ts: "updated-dt:2026-01-01T00:00:00Z",
                dur: "updated-sp:01:00:00",
            });
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
