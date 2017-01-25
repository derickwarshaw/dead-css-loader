const vm = require("vm");
const babel = require("babel-core");
const path = require("path");
const postcss = require("postcss");
const deadcss = require("postcss-modules-dead-css");
const _ = require("lodash");
const webpackSources = require("webpack-sources");

class DeadCSSPlugin {

    constructor(options) {
        this.compiledModules = {};
        this.compiledById = [];

        this.options = {
            filename: false,
            ignore: [],
            allowIds: false,
            allowNonClassSelectors: false,
            allowNonClassCombinators: false
        };
        if (options) {
            Object.assign(this.options, options);
        }
    }

    apply(compiler) {
        const plugin = this;
        compiler.plugin("compilation", function(compilation) {
            compilation.plugin("after-optimize-modules", plugin.run.bind(plugin));
            if (plugin.options.filename) {
                compilation.plugin("after-optimize-chunk-assets", plugin.runExtractedText(compilation).bind(plugin));
            }
        });
    }

    run(modules) {
        let cssModules = modules.filter(this.filterModules, this);

        this.compileModules(cssModules);

        if (!this.options.filename) {
            cssModules = cssModules.map(this.filterModuleCss, this);

            // Apply filtered css to the final modules array
            cssModules.map(function(module) {
                modules[module.id]._source = new webpackSources.OriginalSource(
                    module.source, 
                    modules[module.id]._source._name
                );
            });
        }
    }

    runExtractedText(compilation) {
        return (chunks) => {
            const filename = this.options.filename;
            if (compilation.assets[filename]) {
                const modules = compilation.modules.filter(this.filterModules, this);

                const args = { usedSelectors: [], ignore: [] };
                modules.map((module) => {
                    args.usedSelectors = _.concat(
                        args.usedSelectors, 
                        this.getModuleUsedSelectors(module)
                    );
                    args.ignore = _.concat(
                        args.ignore, 
                        this.getModuleIgnoredSelectors(module)
                    );
                }, this);

                const source = compilation.assets[filename].source();
                const sourceMap = this.cleanMap(compilation.assets[filename].map());
                const usedSelectors = _.uniq(args.usedSelectors);
                const ignore = _.uniq(args.ignore);

                const result = this.filterCss(source, sourceMap, usedSelectors, ignore);

                if(sourceMap && result.map) {
                    const map = this.cleanMap(result.map.toJSON());
                    compilation.assets[filename] = new webpackSources.SourceMapSource(result.css, filename, map);
                } else {
                    compilation.assets[filename] = new webpackSources.OriginalSource(result.css, filename);
                }

            }
        };
    }

    cleanMap(map) {
        if (map.sources) {
            map.sources = map.sources.map((url) => url.split("://").pop());
        }
        return map;
    }

    filterModules(module) {
        if (module.error || !module.loaders) return false;

        if (this.options.filename) {
            const extractText = module.loaders[0] &&
                typeof (module.loaders[0].loader) === "string" &&
                module.loaders[0].loader.includes("/extract-text-webpack-plugin/");

            let cssLoader = false;
            for (let i = 1; i < module.loaders.length; i++) {
                cssLoader |= module.loaders[i].loader.includes("/css-loader/");
            }

            return extractText && cssLoader;
        }

        return module.loaders[0] &&
            typeof (module.loaders[0].loader) === "string" &&
            module.loaders[0].loader.includes("/css-loader/");
    }

    compileRequire(context){
        return function(moduleName) {
            if(moduleName.indexOf("css-base") >= 0) {
                return require("css-loader/lib/css-base");
            }
            moduleName = path.join(context, moduleName.split("!").pop());
            return this.compiledModules[moduleName];
        }
    }

    // Keep trying to compile modules until all imports are resolved
    compileModules(modules) {
        let compiled;
        let loop = 0;
        do {
            if (loop++ > modules.length) {
                throw this.lastError;
            }

            compiled = true;
            this.lastError = false;
            for (let i = 0; i < modules.length; i++) {
                compiled &= this.compileModule(modules[i]);
            }
        } while (!compiled);
    }

    // Compile CSS module in order to extract $css object
    compileModule(module) {
        const name = module._source._name.split("!").pop();

        if (this.compiledModules.hasOwnProperty(name)) return true;

        const source = module._source.source();

        const m = { exports: {}, id: module.index };
        try {
            const result = babel.transform(source, {
                presets: ['es2015']
            });
            const fn = vm.runInThisContext("(function(module, exports, require) {" + result.code + "\n})", "module.js");
            fn(m, m.exports, this.compileRequire(module.context).bind(this));
        } catch(e) {
            this.lastError = e;
            return false;
        }

        this.compiledById[module.index] = this.compiledModules[name] = m.exports;
        return true;
    }

    getModuleUsedSelectors(module) {
        const exports = this.compiledById[module.index];
        const usedExports = module.usedExports;

        return _.flatten(usedExports
            .filter((selector) => selector !== "$css")
            .map((selector) => exports[selector].split(" ")));
    }

    getModuleIgnoredSelectors(module) {
        const exports = this.compiledById[module.index];
        return this.options.ignore.map((sel) => {
            return exports[sel] ? exports[sel] : sel;
        });
    }

    filterCss(source, sourceMap, usedSelectors, ignore) {
        return postcss([
            deadcss({
                used: usedSelectors,
                ignore: ignore,
                allowIds: this.options.allowIds,
                allowNonClassSelectors: this.options.allowNonClassSelectors,
                allowNonClassCombinators: this.options.allowNonClassCombinators
            })
        ]).process(source, {
            from: sourceMap ? sourceMap.file : undefined,
            to: module.request,
            map: {
                prev: sourceMap,
                sourcesContent: true,
                inline: false,
                annotation: false
            }
        });
    }

    // Filter dead css and contruct new $css object
    filterModuleCss(module) {
        if (module.usedExports === true || module.usedExports.indexOf('default') !== -1) {
            return {
                id: module.id,
                source: module._source.source()
            }
        }

        const usedSelectors = this.getModuleUsedSelectors(module);
        const ignore = this.getModuleIgnoredSelectors(module);
        const exports = this.compiledById[module.index];
        const source = exports.$css.content;
        const sourceMap = exports.$css.sourceMap;

        const result = this.filterCss(source, sourceMap, usedSelectors, ignore);

        const cssAsString = JSON.stringify(result.css);

        let map = "";
        if(sourceMap && result.map) {
            map = this.cleanMap(result.map.toJSON());
        }
        map = JSON.stringify(map);

        module.$css = "export const $css = {\n" +
            "\t id: module.id,\n" +
            "\t content: " +  cssAsString + ",\n" + 
            "\t imports: cssImports" +
            (sourceMap && result.map ? ",\n\t sourceMap: " + map : "") + 
            "\n}";

        const r = /\/\/ module\n[^]*\/\/ exports\n/;

        return {
            id: module.index,
            source: module._source.source().replace(r, this.replace(module.$css))
        }
    }

    // Replace the old css without changing file size and locations
    replace(css) {
        return function(match) {
            const newCode = "// module\n" + 
                css + 
                "// exports\n";

            const len = match.length,
                lines = match.split("\n").length,
                newLen = newCode.length,
                newLines = newCode.split("\n").length;

            let padding = "";

            const lineDiff = lines - newLines;
            if (lineDiff > 0) {
                padding = padding + "\n".repeat(lineDiff);
            }
            const lenDiff = len - (newLen + lineDiff);
            if (lenDiff > 0) {
                padding = " ".repeat(lenDiff) + padding;
            }

            return "// module\n" + 
                css + padding +  
                "// exports\n";
        };
    }
}

module.exports = DeadCSSPlugin;
