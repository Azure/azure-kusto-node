// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const a = [
    {
        "FrameType": "DataSetHeader",
        "IsProgressive": false,
        "Version": "v2.0"
    },
    {
        "FrameType": "DataTable",
        "TableId": 0,
        "TableName": "@ExtendedProperties",
        "TableKind": "QueryProperties",
        "Columns": [
            {
                "ColumnName": "TableId",
                "ColumnType": "int"
            },
            {
                "ColumnName": "Key",
                "ColumnType": "string"
            },
            {
                "ColumnName": "Value",
                "ColumnType": "dynamic"
            }
        ],
        "Rows": [
            [
                1,
                "Visualization",
                "{\"Visualization\":null,\"Title\":null,\"XColumn\":null,\"Series\":null,\"YColumns\":null,\"XTitle\":null,\"YTitle\":null,\"XAxis\":null,\"YAxis\":null,\"Legend\":null,\"YSplit\":null,\"Accumulate\":false,\"IsQuerySorted\":false,\"Kind\":null}"
            ]
        ]
    },
    {
        "FrameType": "DataTable",
        "TableId": 1,
        "TableName": "temp",
        "TableKind": "PrimaryResult",
        "Columns": [
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
        ],
        "Rows": [
            ["2016-06-06T15:35:00Z", "foo", 101, 3.14, false, "1.01:02:03.004"],
            ["2016-06-07T16:00:00Z", "bar", 555, 2.71, true, null],
            [null, "", null, null, null, null]
        ]
    },
    {
        "FrameType": "DataTable",
        "TableId": 2,
        "TableName": "QueryCompletionInformation",
        "TableKind": "QueryCompletionInformation",
        "Columns": [
            {
                "ColumnName": "Timestamp",
                "ColumnType": "datetime"
            },
            {
                "ColumnName": "ClientRequestId",
                "ColumnType": "string"
            },
            {
                "ColumnName": "ActivityId",
                "ColumnType": "guid"
            },
            {
                "ColumnName": "SubActivityId",
                "ColumnType": "guid"
            },
            {
                "ColumnName": "ParentActivityId",
                "ColumnType": "guid"
            },
            {
                "ColumnName": "Level",
                "ColumnType": "int"
            },
            {
                "ColumnName": "LevelName",
                "ColumnType": "string"
            },
            {
                "ColumnName": "StatusCode",
                "ColumnType": "int"
            },
            {
                "ColumnName": "StatusCodeName",
                "ColumnType": "string"
            },
            {
                "ColumnName": "EventType",
                "ColumnType": "int"
            },
            {
                "ColumnName": "EventTypeName",
                "ColumnType": "string"
            },
            {
                "ColumnName": "Payload",
                "ColumnType": "string"
            }
        ],
        "Rows": [
            [
                "2018-05-01T09:32:38.916566Z",
                "unspecified;e8e72755-786b-4bdc-835d-ea49d63d09fd",
                "5935a050-e466-48a0-991d-0ec26bd61c7e",
                "8182b177-7a80-4158-aca8-ff4fd8e7d3f8",
                "6f3c1072-2739-461c-8aa7-3cfc8ff528a8",
                1,
                "Error",
                0,
                "S_OK (0)",
                4,
                "QueryInfo",
                "{\"Count\":1,\"Text\":\"Querycompletedsuccessfully\"}"
            ],
            [
                "2018-05-01T09:32:38.916566Z",
                "unspecified;e8e72755-786b-4bdc-835d-ea49d63d09fd",
                "5935a050-e466-48a0-991d-0ec26bd61c7e",
                "8182b177-7a80-4158-aca8-ff4fd8e7d3f8",
                "6f3c1072-2739-461c-8aa7-3cfc8ff528a8",
                6,
                "Stats",
                0,
                "S_OK (0)",
                0,
                "QueryResourceConsumption",
                "{\"ExecutionTime\":0.0156222,\"resource_usage\":{\"cache\":{\"memory\":{\"hits\":13,\"misses\":0,\"total\":13},\"disk\":{\"hits\":0,\"misses\":0,\"total\":0}},\"cpu\":{\"user\":\"00: 00: 00\",\"kernel\":\"00: 00: 00\",\"totalcpu\":\"00: 00: 00\"},\"memory\":{\"peak_per_node\":16777312}},\"dataset_statistics\":[{\"table_row_count\":3,\"table_size\":191}]}"
            ]
        ]
    },
    {
        "FrameType": "DataSetCompletion",
        "HasErrors": false,
        "Cancelled": false
    }
];

export default a;