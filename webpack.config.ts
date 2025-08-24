import * as path from "node:path";
// @ts-expect-error
import { NodeProtocolUrlPlugin } from "node-stdlib-browser/helpers/webpack/plugin";
import stdLibBrowser from "node-stdlib-browser";
import webpack from "webpack";

// This is a very lean example of a webpack config file to use for using the browser
// implementation of the package. It is using the compiled files of the ingest library and will load its index.js file.
// USAGE: npm run webpack

const config = {
    entry: {
        index: "./packages/azure-kusto-ingest/dist-esm/src/index",
    },
    target: "web",
    output: {
        filename: "[name].js", // The index.html script file
        path: path.resolve(__dirname, "dist"),
    },
    resolve: {
        aliasFields: ["browser"],
        extensions: [".ts", ".js"],
        alias: {
            ...stdLibBrowser,
            fs: false,
            os: false,
            process: false,
            "stream-http": false,
            https: false,
            http: false,
            crypto: false,
        },
    },
    devtool: "inline-source-map",
    devServer: {
        // We use static files so we can use the dist-esm js files with files mapping.
        // Maybe we can do better so we can use ts-loader module and load typescript files
        static: ["./packages/azure-kusto-ingest/dist-esm"],
        port: 3000, // This port should be open in the SPA aad app
    },
    plugins: [
        new NodeProtocolUrlPlugin(),
        new webpack.ProvidePlugin({
            process: stdLibBrowser.process,
            Buffer: [stdLibBrowser.buffer, "Buffer"],
        }),
    ],
    module: {
        rules: [
            {
                test: /\.m?js$/,
                resolve: {
                    fullySpecified: false,
                },
            },
        ],
    },
};

export default config;
