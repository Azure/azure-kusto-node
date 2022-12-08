import * as path from "path";
// in case you run into any typescript error when configuring `devServer`
import "webpack-dev-server";
const webpack = require("webpack");

let production = process.env.NODE_ENV === "production";

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
    mode: "development",
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

if (production) {
    config.mode = "production";
    config.devtool = "inline-source-map";
}

export default config;
