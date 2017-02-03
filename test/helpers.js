const Webpack = require("webpack/lib/webpack");
const path = require("path");
const fs = require("fs");
const SimpleCompiler = require("../src/compiler");

function runLoader(entry, file, query, cssLoaderQuery) {
    query = query || {
        recursion: 1,
        spinalCase: true,
        allowNonClassCombinators: true
    };
    cssLoaderQuery = cssLoaderQuery || {
        modules: true,
        localIdentName: "_[local]_[name]",
        importLoaders: 1,
        camelCase: 'dashes'
    };
    return new Promise((resolve, reject) => {
        const config = {
            entry: [ entry ],
            context: __dirname,
            output: {
                filename: 'dead-css-test-output',
            },
            module: {
                rules: [
                    {
                        test: /\.css$/,
                        use: [
                            {
                                loader: "css-loader",
                                query: cssLoaderQuery
                            },
                            {
                                loader: require.resolve("../src/index.js"),
                                query: query
                            }
                        ]
                    }
                ]
            },
            plugins: [
                {
                    apply(compiler) {
                        compiler.plugin("compilation", (compilation) => {
                            compilation.plugin("seal", () => {
                                try {
                                    const modules = compilation.modules.filter((m) => (m.request && m.request.includes(file)));
                                    const simpleCompiler = new SimpleCompiler(modules);
                                    simpleCompiler.compile(modules[0].request).then((exports) => {
                                        resolve(exports.default.toString());
                                    }).catch((err) => reject(err));
                                } catch (e) {
                                    reject(e);
                                }
                            });
                        });
                        compiler.plugin("after-compile", (comp, callback) => {
                            // Remove all chunk assets
                            comp.chunks.forEach(function(chunk) {
                                chunk.files.forEach(function(r) {
                                    delete comp.assets[r];
                                });
                            });
                            callback();
                        });
                    }
                }
            ]
        };

        const compiler = new Webpack(config);

        compiler.run((err) => {
            if (err) reject(err);
        });
    });
}

function test(entry, file, expected) {
    return (new Promise((resolve, reject) => {
        fs.readFile(path.join(__dirname, expected), "utf8", (err, data) => {
            if (err) return reject(err);
            resolve(data);
        });
    })).then((data) =>
        runLoader("./" + entry, file).then((result) => result.should.be.eql(data))
    ).catch((err) => {
        throw (err);
    });
}

module.exports = test;
