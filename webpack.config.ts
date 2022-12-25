// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from "path";
// in case you run into any typescript error when configuring `devServer`
import "webpack-dev-server";
import * as webpack from "webpack";
let config = {
    entry: {
        index: "./packages/azure-kusto-ingest/dist-esm/src/index",
    },
    target: "web",
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "dist"),
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: "ts-loader",
            },
        ],
    },
    resolve: {
        aliasFields: ["browser"],
        fallback: { stream: require.resolve("stream-browserify") },
        extensions: [".ts", ".js"],
    },
    devtool: "inline-source-map",
    devServer: {
        static: "./packages/azure-kusto-ingest/dist-esm",
        port: 3000, // This port should be open in the SPA aad app
    },
    plugins: [
        new webpack.ProvidePlugin({
            process: "process/browser",
        }),
        // Work around for Buffer is undefined:
        // https://github.com/webpack/changelog-v5/issues/10
        new webpack.ProvidePlugin({
            Buffer: ["buffer", "Buffer"],
        }),
    ],
};

export default config;
