// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Config } from "jest";
import type { JestConfigWithTsJest } from "ts-jest";
import { createDefaultEsmPreset } from "ts-jest";

// Note that this preset and the moduleNameMapper are necessary to run test with ecmascript modules.
// See https://kulshekhar.github.io/ts-jest/docs/guides/esm-support/
const defaultEsmPreset = createDefaultEsmPreset();

const baseConfig: Config = {
    ...defaultEsmPreset,
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    testEnvironment: "node",
    prettierPath: "prettier",
    maxWorkers: 200,
    testMatch: ["**/test/**/*Test.ts"],
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

export default config;
