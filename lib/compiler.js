var handlebars = require('handlebars');
var JavaScriptCompiler = handlebars.JavaScriptCompiler;
var Visitor = handlebars.Visitor;

function versionCheck(hbCompiler, hbRuntime) {
  return hbCompiler.COMPILER_REVISION === (hbRuntime["default"] || hbRuntime).COMPILER_REVISION;
}

function findRequires(requiresRegex, source) {
  if (typeof source === 'string') {
    return requiresRegex.test(source)
      ? 'require(' + source.replace(requiresRegex, '$1') + ')'
      : source;
  } else {
    source.children = source.children.map(findRequires.bind(null, requiresRegex));
    return source;
  }
}

function createCustomCompiler(requiresRegex) {
  function CustomCompiler() {
    JavaScriptCompiler.apply(this, arguments);
  }
  CustomCompiler.prototype = Object.create(JavaScriptCompiler.prototype);
  CustomCompiler.prototype.nameLookup = function(parent, name, type) {
    if (requiresRegex.test(name)) {
      return ['require', '(', JSON.stringify(name.replace(requiresRegex, '$1')), ')'];
    } else {
      return JavaScriptCompiler.prototype.nameLookup.call(this, parent, name, type);
    }
  };
  CustomCompiler.prototype.appendToBuffer = function(source, location, explicit) {
    var sourceWithRequiresReplaced = [].concat(source).map(findRequires.bind(null, requiresRegex));
    return JavaScriptCompiler.prototype.appendToBuffer.call(this, sourceWithRequiresReplaced, location, explicit);
  };

  return CustomCompiler;
}

module.exports = function (runtime, requiresRegex) {
  if (!versionCheck(handlebars, runtime)) {
    throw new Error("Handlebars compiler version does not match runtime version");
  }

  var hb = handlebars.create();
  hb.JavaScriptCompiler = createCustomCompiler(requiresRegex);

  return function (source, callback) {
    var ast = hb.parse(source);
    return hb.precompile(ast);
  };
};
