import * as path from 'path';
import * as webpack from 'webpack';
// in case you run into any typescript error when configuring `devServer`
import 'webpack-dev-server';

const config: webpack.Configuration = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.bundle.js',
  },
  // context:"./source"
};

module.exports = {
  resolve: {
    aliasFields: ['browser'],
      fallback: {
          crypto: require.resolve("crypto-browserify") ,
          assert: require.resolve('assert'),
          http: require.resolve('stream-http'),
          https: require.resolve('https-browserify'),
          os: require.resolve('os-browserify/browser'),
          stream: require.resolve('stream-browserify'),
      }
  }
};

export default config;