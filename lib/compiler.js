var handlebars = require('handlebars');
var isModuleName = /^\$/;
var JavaScriptCompiler = handlebars.JavaScriptCompiler;
var Visitor = handlebars.Visitor;

function versionCheck(hbCompiler, hbRuntime) {
  return hbCompiler.COMPILER_REVISION === (hbRuntime['default'] || hbRuntime).COMPILER_REVISION;
}

function findRequires(regex, buffer, source) {
  var match, isDoubleQuoted, ptr = { start: 0, end: 0 };

  if (typeof source === 'string') {
    if (regex.test(source)) {
      regex.lastIndex = 0;
      while (match = regex.exec(source)) {
        // handle source bits like `src=\"path/to/something\"` or just `"path/to/something"`
        isDoubleQuoted = !!match[1];
        if (match.index > 0) {
          var prefix = source.slice(ptr.end, match.index) + (isDoubleQuoted ? '\\"' : '') + '"';
          // if it matches past the start of the line, we need to split the source bit
          // and then concatenate the start back in to the output.
          if (ptr.end > 0) {
            buffer.push('+');
            buffer.push('"' + prefix);
          } else {
            buffer.push(prefix);
          }

          buffer.push('+');
        }

        // match[2] is the matching group that contains the require path
        buffer.push('require(' + JSON.stringify(match[2]) + ')');

        ptr.start = match.index;
        ptr.end = ptr.start + match[0].length;
      }

      // if there was information after the replaced require path, split it out
      // and concatenate it back in to the output.
      if (ptr.end && ptr.end < source.length) {
        buffer.push('+');
        buffer.push('"' + (isDoubleQuoted ? '\\"' : '') + source.slice(ptr.end));
      }
    } else {
      // no transformation needed
      buffer.push(source);
    }
  } else {
    // recursively replace require paths in all child source bits
    source.children = source.children.reduce(findRequires.bind(null, regex), []);
    buffer.push(source);
  }

  return buffer;
}

function createCustomCompiler(inlinesRegex) {
  function CustomCompiler() {
    JavaScriptCompiler.apply(this, arguments);
  }
  CustomCompiler.prototype = Object.create(JavaScriptCompiler.prototype);
  CustomCompiler.prototype.nameLookup = function(parent, name, type) {
    if (isModuleName.test(name)) {
      return ['require(', JSON.stringify(name.slice(1)), ')'];
    } else {
      return JavaScriptCompiler.prototype.nameLookup.call(this, parent, name, type);
    }
  };
  CustomCompiler.prototype.appendToBuffer = function(source, location, explicit) {
    if (inlinesRegex) {
      source = [].concat(source).reduce(findRequires.bind(null, inlinesRegex), []);
    }

    return JavaScriptCompiler.prototype.appendToBuffer.call(this, source, location, explicit);
  };

  // This is undocumented, but necessary. Otherwise certain types of lookups
  // (ones that spawn new compiler instances) won't call our implementation.
  CustomCompiler.prototype.compiler = CustomCompiler;

  return CustomCompiler;
}

module.exports = function (runtime, inlinesRegex) {
  if (!versionCheck(handlebars, runtime)) {
    throw new Error("Handlebars compiler version does not match runtime version");
  }

  var hb = handlebars.create();
  hb.JavaScriptCompiler = createCustomCompiler(inlinesRegex);

  return function (source, callback) {
    return hb.precompile(source);
  };
};
