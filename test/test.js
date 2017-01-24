const should = require("should");
const sinon = require("sinon");
const Plugin = require("./../src/index");

describe("DeadCSSPlugin", () => {
	it("should initialise with default options", () => {
		const plugin = new Plugin();
		should.exist(plugin.options);
		plugin.options.should.eql({
			ignore: [],
			allowIds: false,
			allowNonClassSelectors: false,
			allowNonClassCombinators: false
		});
	});

	it("should register compilation callbacks", () => {
		let callbackName;
		let callback;
		const compiler = {
			plugin(arg1, arg2) {
				arg1.should.be.equal("compilation");

				const compilation = {
					plugin(arg1, arg2) {
						arg1.should.be.equal("after-optimize-modules");
						should.exist(arg2);
					}
				};

				sinon.spy(compilation, "plugin");
				arg2(compilation);
				compilation.plugin.calledOnce.should.be.exactly(true);
			}
		};

		sinon.spy(compiler, "plugin");

		const plugin = new Plugin();
		plugin.apply(compiler);

		compiler.plugin.calledOnce.should.be.exactly(true);
	});

	it("should filter unwanted modules", () => {
		const plugin = new Plugin();
		const modules = [
			{ error: true },
			{ loaders: [] },
			{ loaders: [true] },
			{ loaders: [{loader:true}]},
			{ loaders: [{loader:"/some/other/loader/index.js"}]},
			{ error: true, loaders: [{loader:"/path/to/css-loader/index.js"}]},
			{ loaders: [{loader:"/path/to/css-loader/index.js"}]}
		];
		const result = modules.filter(plugin.filterModules);
		result.should.be.eql([
			{ loaders: [{loader:"/path/to/css-loader/index.js"}]}
		]);
	});

	it("should create a custom require function", () => {
		const plugin = new Plugin();
		const myRequire = plugin.compileRequire("/context/").bind(plugin);
		should.not.exist(myRequire("module"));
		plugin.compiledModules["/context/module"] = {};
		should.exist(myRequire("module"));
		myRequire("module").should.be.eql({});
	});

	it("should attempt to compile modules", () => {
		const plugin = new Plugin();
		const module = {};
		let succeed = true;

		plugin.compileModule = ((arg1) => { if (!succeed) plugin.lastError = new Error(); return succeed; });
		sinon.spy(plugin, "compileModule");

		sinon.spy(plugin, "compileModules");
		plugin.compileModules([
			module
		]);
		plugin.compileModule.calledOnce.should.be.exactly(true);
		should.not.exist(plugin.compileModules.exceptions[0]);

		succeed = false;
		try {
			plugin.compileModules([
				module
			]);
		} catch(e) {
		}
		plugin.compileModule.callCount.should.be.exactly(100);
		plugin.compileModules.threw().should.be.exactly(true);
		should.exist(plugin.compileModules.exceptions[1]);
	});

	it("should compile individual modules", () => {
		const plugin = new Plugin();

		plugin.compileModule({
			context: "./",
			_source: {
				_name: "module1",
				_value: "export default { name: 'module1' };"
			}
		}).should.be.exactly(true);

		plugin.compiledModules.should.be.eql({
			"module1": { default: { name: "module1" } }
		});
	});

	it("should import compiled modules", () => {
		const plugin = new Plugin();

		plugin.compileModule({
			context: "./",
			_source: {
				_name: "module1",
				_value: "export default { name: 'module1' };"
			}
		});
		plugin.compileModule({
			context: "./",
			_source: {
				_name: "module2",
				_value: "import Module1 from './module1'; export default Module1.name;"
			}
		}).should.be.exactly(true);

		plugin.compiledModules.should.be.eql({
			"module1": { default: { name: "module1" } },
			"module2": { default: "module1" }
		});
	});

	it("should throw on invalid module", () => {
		const plugin = new Plugin();

		plugin.compileModule({
			_source: { 
				_name: "module1",
				_value: "load of gibberish"
			}
		}).should.be.exactly(false);

		plugin.compiledModules.should.be.eql({});
	});

	it("should create css replace function", () => {
		const plugin = new Plugin();

		const replace = plugin.replace("Short text\n");
		(typeof replace).should.equal("function");
		
		const result = "// module\nMuch longer text\n// exports".replace(/[^]*/, replace);
		result.should.equal("// module\nShort text\n      // exports\n");
	});

	it("should remove unused css", () => {
		const plugin = new Plugin();
		let modules = [
			{
				index: 0,
				usedExports: ['$css', 'usedClass'],
				exports: ['$css', 'usedClass', 'unusedClass'],
				loaders: [
					{ loader: '/css-loader/' }
				],
				_source: {
					_name: "module1",
					_value: "const cssImports = [];\n" +
					"// module\n" + 
					"export const $css = {\n" +
					"\t id: module.id,\n" +
					"\t content: '.usedClass { text-align:center; } .unusedClass { text-align:center; }',\n" + 
					"\t imports: cssImports\n" +
					"};\n" +
					"// exports\n" +
					"export const usedClass = 'usedClass';\n" +
					"export const unusedClass = 'unusedClass';\n"
				}	
			}
		]
		plugin.run(modules);

		const expected = 'const cssImports = [];\n// module\nexport const $css = {\n\t id: module.id,\n\t content: ".usedClass { text-align:center; }",\n\t imports: cssImports\n}                                     \n// exports\nexport const usedClass = \'usedClass\';\nexport const unusedClass = \'unusedClass\';\n';
		modules[0]._source._value.should.equal(expected);
	});
});
