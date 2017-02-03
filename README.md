# dead-css-loader [![Build Status](https://travis-ci.org/simlrh/dead-css-loader.svg?branch=master)](https://travis-ci.org/simlrh/dead-css-loader)

A webpack loader that removes unused CSS Modules code. Requires [this fork](https://github.com/simlrh/css-loader/tree/es6) of css-loader and [this fork](https://github.com/simlrh/style-loader/tree/es6) of style-loader. To use with extract-text-webpack-plugin you need [this fork](https://github.com/simlrh/extract-text-webpack-plugin/tree/es6).

The loader uses webpack 2's static analysis to determine which CSS Modules classnames have been used in a project, and removes any rulesets for unused classnames from the CSS.

See a demo at [webpack-dead-css-demo](https://github.com/simlrh/webpack-dead-css-demo).

## Usage

See [postcss-modules-dead-css](https://github.com/simlrh/postcss-modules-dead-css) for the meaning of the plugin options.

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: "babel-loader",
            query: {
              // Enables tree-shaking
              "presets": [ ["es2015", { "modules": false }] ]
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: [
          "style-loader",
          { 
            loader: "css-loader",
            options: {
              modules: true,
              camelCase: 'dashes',
              importLoaders: 1
            }
          }
          {
            loader: "dead-css-loader",
            query: {
              ignore: ['ignoredClass'],
              allowIds: false,
              allowNonClassCombinators: false,
              allowNonClassSelectors: false
            }
          }
        ]
      }
    ]
  }
};
```

extract-text-webpack-plugin's loader doesn't work with dead-css-loader, so use dead-css-loader's own extracting loader:

```js
const DeadCss = require("dead-css-loader");
const ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
  module: {
    rules: [
      /* ... */
      {
        test: /\.css$/,
        use: [
          DeadCss.extract(),
          "style-loader",
          { 
            loader: "css-loader",
            options: {
              modules: true,
              camelCase: 'dashes',
              importLoaders: 1
            }
          }
          {
            loader: "dead-css-loader",
            query: {
              ignore: ['ignoredClass'],
              allowIds: false,
              allowNonClassCombinators: false,
              allowNonClassSelectors: false
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new ExtractTextPlugin("style.css")
  ]
}
```
