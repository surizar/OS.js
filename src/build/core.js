/*!
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2016, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */
(function(_fs, _path, _utils, _manifest) {
  'use strict';

  var ROOT = _path.dirname(_path.dirname(_path.join(__dirname)));

  var _ugly;
  var Cleancss;

  try {
    _ugly = require('uglify-js');
  } catch ( e ) {}
  try {
    Cleancss = require('clean-css');
  } catch ( e ) {}

  /////////////////////////////////////////////////////////////////////////////
  // HELPERS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Filter a file reference by string
   */
  function _filter(i, opts) {
    if ( i.match(/^dev:/) && opts.target !== 'dist-dev' ) {
      return false;
    }
    if ( i.match(/^prod:/) && opts.target !== 'dist' ) {
      return false;
    }
    return true;
  }

  /**
   * Wrapper for reading JS
   */
  function _readJS(opts, list) {
    return list.filter(function(i) {
      return _filter(i, opts);
    }).map(function(i) {
      var path = _path.join(ROOT, i.replace(/^(dev|prod):/, ''));
      var data = opts.compress ? _ugly.minify(path, {comments: false}).code : _fs.readFileSync(path).toString();

      if ( opts.target !== 'nw' ) {
        data = data.replace(/\/\*\![\s\S]*?\*\//, '')
          .replace(/console\.(log|debug|info|group|groupStart|groupEnd|count)\((.*)\);/g, '')
          .replace(/(?:\/\*(?:[\s\S]*?)\*\/)|(?:^\s*\/\/(?:.*)$)/gm, '')
          .replace(/^\s*[\r\n]/gm, '');
      }

      return data;
    }).join('\n');
  }

  /**
   * Wrapper for reading CSS
   */
  function _readCSS(opts, list) {
    return list.filter(function(i) {
      return _filter(i, opts);
    }).map(function(i) {
      var path = _path.join(ROOT, i.replace(/^(dev|prod):/, ''))
      var data = _fs.readFileSync(path).toString();
      if ( opts.compress ) {
        data = new Cleancss().minify(data).styles;
      }

      if ( opts.target !== 'nw' ) {
        data = data.replace(/\/\*\![\s\S]*?\*\//, '')
          .replace('@charset "UTF-8";', '')
          .replace(/(?:\/\*(?:[\s\S]*?)\*\/)|(?:^\s*\/\/(?:.*)$)/gm, '')
          .replace(/^\s*[\r\n]/gm, '');
      }
      return data;
    }).join('\n');
  }

  /**
   * Create a 'index.html' file
   */
  function _createIndex(opts, dist, fn, test) {
    var tpldir = _path.join(ROOT, 'src', 'templates', 'dist', opts.build.dist.template);
    var outdir = _path.join(ROOT, dist || 'dist-dev');
    var fileName = test ? 'test.html' : 'index.html';
    var scripts = [];
    var styles = [];

    fn(function(i) {
      if ( opts.verbose ) {
        _utils.log('-', i);
      }
      styles.push('    <link type="text/css" rel="stylesheet" href="' + i + '" />');
    }, function(i) {
      if ( opts.verbose ) {
        _utils.log('-', i);
      }
      scripts.push('    <script type="text/javascript" charset="utf-8" src="' + i + '"></script>');
    }, test);

    var loginHTML = '';
    var loginName = opts.build.dist.login || 'default';
    var loginFile = _path.join(ROOT, 'src', 'templates', 'dist', 'login', loginName + '.html');
    if ( _fs.existsSync(loginFile) ) {
      loginHTML = _fs.readFileSync(loginFile).toString();
    }

    var tpl = _fs.readFileSync(_path.join(tpldir, fileName)).toString();
    tpl = _utils.replaceAll(tpl, '%STYLES%', styles.join('\n'));
    tpl = _utils.replaceAll(tpl, '%SCRIPTS%', scripts.join('\n'));
    tpl = _utils.replaceAll(tpl, '%LOGIN%', loginHTML);

    _fs.writeFileSync(_path.join(outdir, fileName), tpl);
  }

  function getBuildFiles(opts) {
    var javascripts = opts.javascript;
    var stylesheets = opts.stylesheets;
    var locales = opts.locales;

    if ( opts.overlays ) {
      Object.keys(opts.overlays).forEach(function(k) {
        var a = opts.overlays[k];
        if ( a ) {
          if ( a.javascript instanceof Array ) {
            javascripts = javascripts.concat(a.javascript);
          }
          if ( a.stylesheets instanceof Array ) {
            stylesheets = stylesheets.concat(a.stylesheets);
          }
          if ( a.locales instanceof Array ) {
            locales = locales.concat(a.locales);
          }
        }
      });
    }

    return {
      javascript: javascripts,
      stylesheets: stylesheets,
      locales: locales
    };
  }

  /////////////////////////////////////////////////////////////////////////////
  // HELPERS
  /////////////////////////////////////////////////////////////////////////////

  var TARGETS = {
    'dist': function(opts, done) {
      var jsh = _utils.readTemplate('dist/header.js');
      var cssh = _utils.readTemplate('dist/header.css');

      function _nw(cb) {
        if ( opts.nw ) {
          var dest = _path.join(ROOT, 'dist');

          _fs.mkdirSync(_path.join(dest, 'vfs'));
          _fs.mkdirSync(_path.join(dest, 'vfs', 'home'));
          _fs.mkdirSync(_path.join(dest, 'vfs', 'home', 'demo'));

          _fs.copySync(
            _path.join(ROOT, 'README.md'),
            _path.join(dest, 'vfs', 'home', 'demo', 'README.md')
          );
          _fs.copySync(
            _path.join(ROOT, 'src', 'templates', 'nw', 'package.json'),
            _path.join(dest, 'package.json')
          );
          _fs.copySync(
            _path.join(ROOT, 'src', 'server', 'packages.json'),
            _path.join(dest, 'packages.json')
          );

          // Install dependencies
          _fs.copySync(
            _path.join(ROOT, 'src', 'server', 'node'),
            _path.join(dest, 'node_modules', 'osjs')
          );
          _fs.copySync(
            _path.join(ROOT, 'src', 'templates', 'nw', 'index.js'),
            _path.join(dest, 'node_modules', 'osjs', 'index.js')
          );

          var cmd = 'cd "' + dest + '" && npm install';
          require('child_process').exec(cmd, function(err, stdout, stderr) {
            console.log(stderr, stdout);
            cb();
          });
        } else {
          cb();
        }
      }

      var build = getBuildFiles(opts.build);
      var end = opts.compress ? '.min' : '';
      _fs.writeFileSync(_path.join(ROOT, 'dist', 'osjs' + end +  '.js'), jsh + _readJS(opts, build.javascript));
      _fs.writeFileSync(_path.join(ROOT, 'dist', 'locales' + end +  '.js'), jsh + _readJS(opts, build.locales));
      _fs.writeFileSync(_path.join(ROOT, 'dist', 'osjs' + end +  '.css'), cssh + _readCSS(opts, build.stylesheets));

      var appendString = '';
      if ( opts.client.Connection.AppendVersion ) {
        appendString = '?ver=' + opts.client.Connection.AppendVersion;
      }

      _createIndex(opts, 'dist', function(addStyle, addScript) {
        if ( opts.compress ) {
          addStyle('osjs.min.css' + appendString);
          addScript('osjs.min.js' + appendString);
          addScript('locales.min.js' + appendString);
        } else {
          addStyle('osjs.css' + appendString);
          addScript('osjs.js' + appendString);
          addScript('locales.js' + appendString);
        }

        if ( opts.standalone ) {
          addScript('_dialogs.js');
        }
      });

      if ( opts.standalone ) {
        var src = _path.join(ROOT, 'src', 'client', 'dialogs.html');
        _utils.createStandaloneScheme(src, '/dialogs.html', _path.join(ROOT, 'dist', '_dialogs.js'));
      }

      _nw(done);
    },

    'dist-dev': function(opts, done) {
      function adder(addStyle, addScript, test) {
        var build = getBuildFiles(opts.build);
        var jss = (test ? ['vendor/mocha.js', 'vendor/chai.js', 'client/test/test.js'] : []).concat(build.javascript);
        var csss = (test ? ['vendor/mocha.css'] : []).concat(build.stylesheets);

        jss.forEach(function(i) {
          addScript(i.replace(/src\/client\/(.*)/, 'client/$1'));
        });

        build.locales.forEach(function(i) {
          addScript(i.replace(/src\/client\/(.*)/, 'client/$1'));
        });

        csss.forEach(function(i) {
          if ( _filter(i, {target: 'dist-dev'}) ) {
            addStyle(i.replace(/^(dev|prod):/, '').replace(/src\/client\/(.*)/, 'client/$1'));
          }
        });
      };

      _createIndex(opts, 'dist-dev', adder);
      _createIndex(opts, 'dist-dev', adder, true);

      done();
    }
  };

  /////////////////////////////////////////////////////////////////////////////
  // API
  /////////////////////////////////////////////////////////////////////////////

  /**
   * grunt build:core
   *
   * Builds all core files and generates dist directories
   */
  function buildFiles(opts, done) {
    if ( !TARGETS[opts.target] ) {
      return done('Invalid target', false);
    }

    var tpldir = _path.join(ROOT, 'src', 'templates', 'dist', opts.build.dist.template);
    var outdir = _path.join(ROOT, opts.target);

    Object.keys(opts.build.statics).forEach(function(f) {
      var dst = _path.join(ROOT, opts.build.statics[f]);
      var path = f;

      if ( f.substr(0, 1) === '?' ) {
        path = path.substr(1);
        if ( _fs.existsSync(dst) ) {
          return;
        } else {
          _fs.mkdirSync(_path.dirname(dst));
        }
      }

      var src = _path.join(ROOT, path);
      if ( opts.verbose ) {
        _utils.log('-', opts.build.statics[f]);
      }
      _fs.copySync(src, dst);
    });

    var ignore = ['index.html'];
    _fs.readdirSync(tpldir).forEach(function(iter) {
      if ( ignore.indexOf(iter) < 0 ) {
        if ( opts.verbose ) {
          _utils.log('-', _path.join(tpldir, iter));
        }
        _fs.copySync(_path.join(tpldir, iter), _path.join(outdir, iter));
      }
    });

    TARGETS[opts.target](opts, done)
  }

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  module.exports.buildFiles = buildFiles;

})(require('node-fs-extra'), require('path'), require('./utils.js'), require('./manifest.js'));