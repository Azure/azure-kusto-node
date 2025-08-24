import * as path from "path";
import * as webpack from "webpack";

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
        fallback: {
            stream: require.resolve("stream-browserify"),
        }, // Over fallbacks are in the package.json file
        extensions: [".ts", ".js"],
    },
    devtool: "inline-source-map",
    devServer: {
        // We use static files so we can use the dist-esm js files with files mapping.
        // Maybe we can do better so we can use ts-loader module and load typescript files
        static: ["./packages/azure-kusto-ingest/dist-esm"],
        port: 3000, // This port should be open in the SPA aad app
    },
    plugins: [
        // Work around for Buffer is undefined:
        // https://github.com/webpack/changelog-v5/issues/10
        new webpack.ProvidePlugin({
            Buffer: ["buffer", "Buffer"],
        }),
    ],
};

export default config;
