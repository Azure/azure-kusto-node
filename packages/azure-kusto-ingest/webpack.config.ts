import * as path from 'path';
// in case you run into any typescript error when configuring `devServer`
import 'webpack-dev-server';
const webpack = require('webpack');

let production = process.env.NODE_ENV === "production";

let config = {
  entry: {
    index: "./dist-esm/src/index"
  },
  target:"web",
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
    aliasFields: ['browser'],
    fallback:{ "stream": require.resolve("stream-browserify")},
    extensions: [".ts", ".js"],
  },
  devtool: "inline-source-map",
  mode: "development",
  devServer: {
    static: "./dist-esm",
    // hot: true
  },
  plugins: [
    new webpack.ProvidePlugin({
           process: 'process/browser',
    }),
],
};

if (production) {
  config.mode = "production";
  config.devtool = "inline-source-map";
}

export default config;