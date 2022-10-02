import * as path from 'path';
// in case you run into any typescript error when configuring `devServer`
import 'webpack-dev-server';
const webpack = require('webpack');

let production = process.env.NODE_ENV === "production";
// let crypto;
// try {crypto = require.resolve("crypto-browserify")
// } catch {}

// let assert;
// try {assert = require.resolve("assert")
// } catch {}

// let http;
// try {http = require.resolve("stream-http")
// } catch {}

// let crypto;
// try {crypto = require.resolve("crypto-browserify")
// } catch {}

// let crypto;
// try {crypto = require.resolve("crypto-browserify")
// } catch {}

let config = {
  entry: {
    index: "./src/index",
  },
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
 
  devtool: "inline-source-map",
  mode: "development",
  devServer: {
    static: "./dist",
    hot: true
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