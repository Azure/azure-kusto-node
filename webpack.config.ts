import * as path from "path";
import "webpack-dev-server";
import * as webpack from "webpack";

// This is a very lean example of a webpack config file to use for using the browser
// implementation of the package. It is using the compiled files of the ingest library and will load its index.js file.
// USAGE: npm run webpack

let config = {
    entry: {
        index: "./packages/azure-kusto-ingest/dist-esm/src/index",
    },
    target: "web",
    output: {
        filename: "[name].js", // The index.html script file
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
        fallback: { stream: require.resolve("stream-browserify") }, // Over fallbacks are in the package.json file
        extensions: [".ts", ".js"],
    },
    devtool: "inline-source-map",
    devServer: {
        static: ["./packages/azure-kusto-ingest/dist-esm"], // We use static files so we can use the dist-esm files - maybe we can do better
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
