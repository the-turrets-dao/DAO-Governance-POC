const path = require('path')
const glob = require('glob')
const TerserPlugin = require('terser-webpack-plugin')
const nodeExternals = require('webpack-node-externals')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const { last } = require('lodash')

const entryArray = glob.sync('./src/*.js')

const entryObject = entryArray.reduce((acc, item) => {
  const name = last(item.split('/')).replace('.js', '')
  acc[name] = item
  return acc
}, {})

module.exports = {
  mode: 'production',
  entry: entryObject,
  output: {
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2',
    filename: '[name].js'
  },
  target: 'node',
  devtool: false,
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()]
  },
  externalsPresets: { node: true },
  externals: [
    nodeExternals({
      allowlist: [
        // Place packages here you want to be bundled into your txFunction executable
      ]
    }),
    /bignumber\.js/,
    /stellar-sdk/,
    /node-fetch/,
    /lodash/
  ],
  module: {
    rules: [
      {
        test: /\.c?js$/, exclude: /node_modules/, loader: 'babel-loader'
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin(),
  ]
}
