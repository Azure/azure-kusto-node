import * as path from "path";
import * as webpack from "webpack";
import DeclarationBundlerPlugin from "types-webpack-bundler";
// USAGE: npm run webpack

// different for dev and prod
export default (_env: any, argv: any) => {
    let config: webpack.Configuration = {
        entry: {
            ingest: {
                import: "./packages/azure-kusto-ingest/src/index-browser.ts",
                filename: "ingest." + argv.mode + ".js",
                library: {
                    name: "Kusto",
                    type: "umd",
                },
            },
            data: {
                import: "./packages/azure-kusto-data/src/index.ts",
                filename: "data." + argv.mode + ".js",
                library: {
                    name: ["Kusto", "data"],
                    type: "umd",
                },
            },
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    loader: "ts-loader",
                    exclude: /node_modules/,
                    options: {
                        projectReferences: true,
                    },
                },
            ],
        },
        target: "web",
        output: {
            filename: "[name].js",
            path: path.join(__dirname, "dist"),
            globalObject: "this",
        },
        resolve: {
            aliasFields: ["browser"],
            fallback: {
                fs: false,
                tls: false,
                net: false,
                path: false,
                zlib: false,
                http: false,
                https: false,
                crypto: false,
                os: false,
                stream: require.resolve("stream-browserify"),
            }, // Over fallbacks are in the package.json file
            extensions: [".ts", ".js"],
            // Add support for TypeScripts fully qualified ESM imports.
            extensionAlias: {
                ".js": [".js", ".ts"],
                ".cjs": [".cjs", ".cts"],
                ".mjs": [".mjs", ".mts"],
            },
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
            new DeclarationBundlerPlugin({
                moduleName: "Kusto",
                out: "./kusto.d.ts",
            }),
        ],
        devtool: "source-map",
    };

    if (argv.mode === "development") {
        (config as any).devServer = {
            port: 3000, // This port should be open in the SPA aad app
            static: [
                {
                    directory: path.join(__dirname, "sample"),
                    publicPath: "/",
                },
            ],
            // rewrite to /dist
            proxy: {
                "/dist": {
                    target: "http://localhost:3000",
                    pathRewrite: { "^/dist": "" },
                },
            },
        };
    }
    if (argv.mode === "production") {
        config.devtool = "source-map";
    }
    return config;
};
