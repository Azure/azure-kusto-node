const path = require("path");

module.exports = {
  entry: "./index.ts",
  module: {
    rules: [
        {
            test: /\.(t|j)sx?$/,
            use: ['ts-loader'],
            exclude: /node_modules/,
        },
        {
            enforce: "pre",
            test: /\.js$/,
            exclude: /node_modules/,
            loader: "source-map-loader",
        },
        {
            enforce: "pre",
            test: /\.js$/,
            exclude: /node_modules/,
            loader: "eslint-loader",
        }
    ]
  },
  resolve: {
      extensions: ['.tsx', '.ts', '.js', 'jsx'],
  },
  output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'dist'),
  },
  mode: 'development',
  // devtool:"inline-source-map"
};
