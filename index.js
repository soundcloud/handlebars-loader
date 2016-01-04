var loaderUtils = require('loader-utils');
var createCompiler = require('./lib/compiler');

function createInlineDetectRegex(part) {
	// Create a regex that is used to operate over items in a Handlebars compiler buffer.
	// This creates a regex that consists of a few capture groups:
	// 1 - detect whether it's a double-quoted inline require pattern (like `"<img src=\"path/to/required/image\">"`)
	// 2 - wrap whatever was provided in options and add a pattern to capture the rest of a require pattern
	// e.g. given an input pattern of "dev-stuff", it should match:
	//   "dev-stuff/path/to/thing.jpg"
	//   "dev-stuff/thing"
	//   "<img src=\"dev-stuff/path/to/thing.jpg\">"
	return new RegExp('(\\\\?)"((?:' + part + ')(?:\\/[\\w\\-\\.]+)*)(?:\\\\?)"', 'g');
}

module.exports = function(source) {
	if (this.cacheable) this.cacheable();

	var query = this.query instanceof Object ? this.query : loaderUtils.parseQuery(this.query);

	var runtimePath = query.runtime || require.resolve('handlebars/runtime');
	var inlines = query.inlines && createInlineDetectRegex(query.inlines);

	var compiler = createCompiler(require(runtimePath), inlines);
	var template = compiler(source);

	// export as module if template is not blank
	return template
		? 'var Handlebars = require(' + JSON.stringify(runtimePath) + ');\n'
			+ 'module.exports = (Handlebars["default"] || Handlebars).template(' + template + ');'
		: 'module.exports = function(){return "";};';
};
