// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import base from "./webpack.config.base";
import DeclarationBundlerPlugin from "types-webpack-bundler";

export default (_env: any, argv: { mode: string }) => {
    const config = base(_env, argv);
    config.entry = {
        ingest: {
            import: "./packages/azure-kusto-ingest/src/index-browser.ts",
            filename: `ingest.${argv.mode}.js`,
            library: {
                name: "Kusto",
                type: "umd",
            },
        },
    };

    config.plugins?.push(
        new DeclarationBundlerPlugin({
            moduleName: "Kusto",
            out: `./ingest.${argv.mode}.d.ts`,
        })
    );

    return config;
};
