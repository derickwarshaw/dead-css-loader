# webpack-dead-css

A webpack plugin for removing unused CSS Modules code. Requires [this fork](https://github.com/simlrh/css-loader/tree/es6) of css-loader and [this fork](https://github.com/simlrh/style-loader/tree/es6) of style-loader.

This plugin uses webpack 2's static analysis to determine which CSS Modules classnames have been used in a project, and removes any rulesets for unused classnames from the CSS.

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
              sourceMap: true
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new DeadCSSPlugin({
      ignore: ['ignoredClass'],
      allowIds: false,
      allowNonClassCombinators: false,
      allowNonClassSelectors: false
    }),
  ]
};
```
