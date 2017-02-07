# dead-css-loader [![Build Status](https://travis-ci.org/simlrh/dead-css-loader.svg?branch=master)](https://travis-ci.org/simlrh/dead-css-loader) [![Donate](https://nourish.je/assets/images/donate.svg)](http://ko-fi.com/A250KJT)

A webpack loader that removes unused CSS Modules code. Requires [this fork](https://github.com/simlrh/css-loader/tree/es6) of css-loader and [this fork](https://github.com/simlrh/style-loader/tree/es6) of style-loader. To use with extract-text-webpack-plugin you need [this fork](https://github.com/simlrh/extract-text-webpack-plugin/tree/es6).

The loader runs a child compilation and uses webpack 2's tree shaking to determine which CSS Modules classnames have been used in a project, then removes any rulesets for unused classnames from the CSS before passing to the css-loader.

See a demo at [dead-css-loader-demo](https://github.com/simlrh/dead-css-loader-demo) or a screencast [here](https://www.youtube.com/watch?v=9ZC4dM_TMiY).

## Usage

The example below shows the default options.

If the CSS uses spinal-case-classnames set `spinalCase` to `true`. css-loader converts spinal-case to camelCase in order to export symbols as JavaScript. The `spinalCase` option tells the loader to convert camel case back to spinal case before stripping the CSS.

If a CSS module is imported which includes an unused class that itself imports a class from a second module, then although that re-export is marked as unused by tree shaking, the original export from the second module is still marked as used and won't be caught by a single child compilation. To fix this increase `recursion` to run a recursive compilation which will catch the fact that the re-export has been removed and the original export is now unused.

Set `plugins` to true if you need your plugins to run during child compilations. 


See [postcss-modules-dead-css](https://github.com/simlrh/postcss-modules-dead-css) for the meaning of the other options.

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
              spinalCase: false,
              recursion: 1,
              plugins: false,
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
              recursion: 1,
              plugins: false,
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
