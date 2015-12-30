var loaderUtils = require("loader-utils");
var createCompiler = require("./lib/compiler");

module.exports = function(source) {
	if (this.cacheable) this.cacheable();

	var query = this.query instanceof Object ? this.query : loaderUtils.parseQuery(this.query);

	var runtimePath = query.runtime || require.resolve("handlebars/runtime");
	var inline = query.inline && new RegExp(query.inline, 'g');

	var compiler = createCompiler(require(runtimePath), inline);
	var template = compiler(source);

	// export as module if template is not blank
	return template
		? 'var Handlebars = require(' + JSON.stringify(runtimePath) + ');\n'
			+ 'module.exports = (Handlebars["default"] || Handlebars).template(' + template + ');'
		: 'module.exports = function(){return "";};';
};
