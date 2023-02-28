// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import base from "./webpack.config.base";
import DeclarationBundlerPlugin from "types-webpack-bundler";

export default (_env: any, argv: { mode: string }) => {
    const config = base(_env, argv);
    config.entry = {
        data: {
            import: "./packages/azure-kusto-data/src/index.ts",
            filename: `data.${argv.mode}.js`,
            library: {
                name: ["Kusto", "data"],
                type: "umd",
            },
        },
    };

    config.plugins?.push(
        new DeclarationBundlerPlugin({
            moduleName: "Kusto",
            out: `./data.${argv.mode}.d.ts`,
        })
    );

    return config;
};
