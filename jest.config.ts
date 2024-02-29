// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Config } from "jest";
import type { JestConfigWithTsJest } from "ts-jest";

const baseConfig: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    prettierPath: "prettier",
    maxWorkers: 200,
    testMatch: ["**/test/**/*Test.ts"],
    extensionsToTreatAsEsm: [".ts", ".tsx"],
    transform: {
        "^.+\\.(t|j)sx?$": "@swc/jest",
    },
};

const config: JestConfigWithTsJest = {
    testTimeout: 240000,
    maxConcurrency: 200,
    projects: [
        {
            displayName: "azure-kusto-data",
            rootDir: "packages/azure-kusto-data",
            ...baseConfig,
        },
        {
            displayName: "azure-kusto-ingest",
            rootDir: "packages/azure-kusto-ingest",
            ...baseConfig,
        },
    ],
};

export { config };
