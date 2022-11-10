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
  // plugins:
  //   // Work around for Buffer is undefined:
  //   // https://github.com/webpack/changelog-v5/issues/10
  //   // Required for "rhea" package
  //   new webpack.ProvidePlugin({
  //       Buffer: ['buffer', 'Buffer'],
  //   })
  // ,
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
    fallback: {
        crypto:require.resolve('crypto-browserify')  ,
        assert :require.resolve('assert'),
        http : require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
        zlib: require.resolve('browserify-zlib'),
        url: false,
        "fs": false

    },
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