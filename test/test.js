var assert = require('assert'),
    async = require('async'),
    fs = require('fs'),
    path = require('path'),
    sinon = require('sinon'),

    loader = require('../'),
    WebpackLoaderMock = require('./lib/WebpackLoaderMock'),

    TEST_TEMPLATE_DATA = {
      title: 'Title',
      description: 'Description',
      image: 'http://www.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50',
      object: {a: 'a', b: 'b', c: 'c'}
    };

function applyTemplate(source, options) {
  var requires = options && options.requireStubs || {},
      _require = sinon.spy(function (resource) {
        return requires[resource] || require(resource);
      }),
      _module = {};

  try {
    // evaluate the template file
    (new Function('module', 'require', source))(_module, _require);
    // execute template with data
    options.test(null, _module.exports(options.data), _require);
  } catch (err) {
    options.test(err);
  }
}

function loadTemplate(templateName) {
  return fs.readFileSync(path.join(__dirname, 'templates', templateName + '.handlebars')).toString();
}

function testTemplate(loader, template, options, testFn) {
  var resolveStubs = {}, loadedTemplate;

  for (var k in options.stubs) {
    resolveStubs[k] = k;
  }

  try {
    var loadedTemplate = loader.call(new WebpackLoaderMock({
      query: options.query,
      resolveStubs: resolveStubs
    }), loadTemplate(template));
  } catch (err) {
    // exit early
    return testFn(err);
  }

  applyTemplate(loadedTemplate, {
    data: options.data,
    requireStubs: options.stubs,
    test: testFn
  });
}

function getStubbedHandlebarsTemplateFunction() {
  return sinon.stub().returns(function () {
    return 'STUBBED';
  });
}

describe('handlebars-loader', function () {

  it('should load simple handlebars templates', function (done) {
    testTemplate(loader, 'simple', {
      data: TEST_TEMPLATE_DATA
    }, function (err, output, require) {
      assert.ok(output, 'generated output');
      // There will actually be 1 require for the main handlebars runtime library
      assert.equal(require.callCount, 1,
        'should not have required anything extra');
      done();
    });
  });

  it('supports module-style helpers', function (done) {
    testTemplate(loader, 'with-helpers', {
      data: TEST_TEMPLATE_DATA,
      stubs: {
        'title': function (text) { return 'Title: ' + text; }
      }
    }, function (err, output, require) {
      assert.ok(output, 'generated output');
      assert.ok(require.calledWith('title'),
        'should have required title helper');
      done();
    });
  });

  it('allows specifying inline requires', function (done) {
    testTemplate(loader, 'with-inline-requires', {
      query: '?inlines=images',
      stubs: {
        'image': function (text) { return 'Image URL: ' + text; },
        'images/path/to/image': 'http://www.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50'
      }
    }, function (err, output, require) {
      assert.ok(output, 'generated output');
      assert.ok(require.calledWith('images/path/to/image'),
        'should have required image path');
      done();
    });
  });

  it('allows overriding the handlebars runtime path', function (done) {
    var templateStub = getStubbedHandlebarsTemplateFunction();
    var handlebarsAPI = { template: templateStub };

    testTemplate(loader, 'simple', {
      query: '?runtime=handlebars/runtime.js', // runtime actually gets required() as part of version check, so we specify real path to runtime but specify the extension so we know loader is using our custom version.
      stubs: {
        'handlebars/runtime.js': {
          default: handlebarsAPI
        }
      }
    }, function (err, output, require) {
      assert.ok(output, 'generated output');
      assert.ok(require.calledWith('handlebars/runtime.js'),
        'should have required handlebars runtime from user-specified path');
      assert.ok(!require.calledWith('handlebars/runtime'),
        'should not have required default handlebars runtime');
      done();
    });
  });

  it('supports either the CommonJS or ES6 style of the handlebars runtime', function (done) {
    var templateStub = getStubbedHandlebarsTemplateFunction();
    // The loader will require the runtime by absolute path, need to know that
    // in order to stub it properly
    var runtimePath = require.resolve('handlebars/runtime');

    function testWithHandlebarsAPI(api) {
      return function (next) {
        var stubs = {};
        stubs[runtimePath] = api;
        testTemplate(loader, 'simple', {
          stubs: stubs
        }, next);
      };
    }

    async.series([
      testWithHandlebarsAPI({ template: templateStub }), // CommonJS style
      testWithHandlebarsAPI({ default: { template: templateStub } }) // ES6 style
    ], function (err, results) {
      assert.ok(!err, 'no errors');
      assert.ok(results.filter(Boolean).length === 2, 'generated output');
      done();
    });
  });

  it('properly catches errors in template syntax', function (done) {
    testTemplate(loader, 'invalid-syntax-error', {}, function (err, output, require) {
      assert.ok(err, 'got error');
      assert.ok(err.message.indexOf('Parse error') >= 0, 'error was handlebars parse error');
      done();
    });
  });

  it('properly catches errors when unknown helper found', function (done) {
    testTemplate(loader, 'invalid-unknown-helpers', {}, function (err, output, require) {
      assert.ok(err, 'got error');
      assert.ok(err.message.indexOf('Missing helper') >= 0, 'error was handlebars unknown helper error');
      done();
    });
  });

});
