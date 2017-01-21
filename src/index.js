const vm = require("vm");
const babel = require("babel-core");
const cssLoader = require.resolve("css-loader");
const path = require("path");
const postcss = require("postcss");
const deadcss = require("postcss-dead-css");
const _ = require("lodash");

class DeadCSSPlugin {

    constructor(options) {
        this.compiledModules = {};
        this.compiledById = [];

        this.options = {
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
        const run = this.run.bind(this);
        compiler.plugin("compilation", function(compilation) {
            compilation.plugin("after-optimize-modules", run);
        });
    }

    run(modules) {
        let cssModules = modules.filter(this.filterModules);

        this.compileModules(cssModules);

        cssModules = cssModules.map(this.filterCss, this);

        // Apply filtered css to the final modules array
        cssModules.map(function(module) {
            modules[module.id]._source._value = module.source;
        });
    }

    filterModules(module) {
        return module.loaders && module.loaders[0] &&
            module.loaders[0].loader === cssLoader;
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
            compiled = true;
            this.lastError = false;
            for (let i = 0; i < modules.length; i++) {
                compiled &= this.compileModule(modules[i]);
            }
            if (loop++ == 100) {
                throw this.lastError;
            }
        } while (!compiled);
    }

    // Compile CSS module in order to extract $css object
    compileModule(module) {
        const name = module._source._name.split("!").pop();

        if (this.compiledModules.hasOwnProperty(name)) return true;

        const source = module._source._value;

        try {
            var result = babel.transform(source, {
                presets: ['es2015']
            });
            var fn = vm.runInThisContext("(function(module, exports, require) {" + result.code + "\n})", "module.js");
            var m = { exports: {}, id: module.index };
            fn(m, m.exports, this.compileRequire(module.context).bind(this));
        } catch(e) {
            this.lastError = e;
            return false;
        }
        delete m.exports.toString;
        delete m.exports.i;

        this.compiledById[module.index] = this.compiledModules[name] = m.exports;
        return true;
    }

    // Filter dead css and contruct new $css object
    filterCss(module) {
        const exports = this.compiledById[module.index];

        // all selectors used, return original source
        if (module.usedExports.indexOf('default') !== -1) {
            return {
                id: module.index,
                source: module._source._value
            };
        }

        const usedSelectors = _.flatten(module.usedExports
            .filter((selector) => selector !== "$css")
            .map((selector) => exports[selector].split(" ")));
        const ignore = this.options.ignore.map((sel) => exports[sel]);

        const result = postcss([
            deadcss({
                used: usedSelectors,
                ignore
            })
        ]).process(exports.$css.content, {
            from: exports.$css.file,
            to: module.request,
            map: {
                prev: exports.$css.sourceMap,
                sourcesContent: true,
                inline: false,
                annotation: false
            }
        });

        let map;

        if(exports.$css.sourceMap && result.map) {
            map = result.map.toJSON();
            if(map.sources) {
                map.sources = map.sources.map(function(source) {
                    return '/.' + source.split('://').pop();
                }, this);
                map.sourceRoot = "webpack://";
            }
            map = JSON.stringify(map);
        }

        const cssAsString = JSON.stringify(result.css);

        module.$css = "export const $css = {\n" +
            "\t id: module.id,\n" +
            "\t content: " +  cssAsString + ",\n" + 
            "\t imports: cssImports" +
            (exports.$css.sourceMap && result.map ? ",\n\t sourceMap: " + map : "") + 
            "\n}";

        const r = /\/\/ module\n[^]*\/\/ exports\n/;

        return {
            id: module.index,
            source: module._source._value.replace(r, this.replace(module.$css))
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
