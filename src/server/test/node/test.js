(function() {
  'use strict';
  /*eslint strict: ["warn"]*/
  const assert = require('assert');

  const _req = require('request');
  const _path = require('path');
  const _fs = require('fs');
  const _osjs = require('../../node/core/instance.js');
  const _vfs = require('../../node/core/vfs.js');

  var instance;

  function _callAPI(m, a, cb) {
    instance.API.application({
      data: a
    }, a).then(function(result) {
      cb(null, result);
    }).catch(function(error) {
      cb(error);
    });
  }

  function _callVFS(m, a, cb) {
    _vfs._request({
      session: {
        get: function(key) {
          if ( key === 'username' ) {
            return 'demo';
          }
          return null;
        },
        set: function() {
        }
      },
      request: {}
    }, m, a).then(function(result) {
      cb(null, result);
    }).catch(function(error) {
      cb(error);
    });
  }

  /////////////////////////////////////////////////////////////////////////////
  // PREPARATION
  /////////////////////////////////////////////////////////////////////////////

  describe('Initialize OS.js server instance', function() {
    it('should initialize core', function(done) {
      _osjs.init({
        LOGLEVEL: 0,
        PORT: 8008,
        DIST: 'dist-dev'
      }).then(function(i) {
        instance = i;
        done();
      }).catch(function(error) {
        assert.equal(null, error);
      });
    });

    it('should have correct environment', function() {
      assert.equal('demo', instance.CONFIG.http.authenticator);
      assert.equal('demo', instance.CONFIG.http.storage);
      assert.equal('http', instance.CONFIG.http.connection);
    });

    it('should have correct permissions', function() {
      describe('#vfs', function() {
        const testPath = _path.join(instance.DIRS.root, 'vfs/home/demo');
        it('read access to demo area', function() {
          if ( _fs.accessSync ) {
            assert.doesNotThrow(function() {
              _fs.accessSync(testPath, _fs.R_OK);
            }, Error);
          } else {
            assert.equal(true, true);
          }
        });

        it('write access to demo area', function() {
          if ( _fs.accessSync ) {
            assert.doesNotThrow(function() {
              _fs.accessSync(testPath, _fs.W_OK);
            }, Error);
          } else {
            assert.equal(true, true);
          }
        });
      });
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // APIS
  /////////////////////////////////////////////////////////////////////////////

  describe('API', function() {

    describe('Application API', function() {
      describe('#call', function() {
        it('should return dummy data', function(done) {
          _callAPI('application', {
            path: 'default/Settings',
            method: 'test',
            args: {}
          }, function(error, result) {
            assert.equal(null, error);
            assert.equal('test', result);
            done();
          })
        });

        it('should trigger error on invalid method', function(done) {
          _callAPI('application', {
            path: 'default/Settings',
            method: 'xxx',
            args: {}
          }, function(error, result) {
            assert.notEqual(null, error);
            done();
          })
        });

        it('should trigger error on invalid package', function(done) {
          _callAPI('application', {
            path: 'doesnotexist/PackageName',
            method: 'xxx',
            args: {}
          }, function(error, result) {
            assert.notEqual(null, error);
            done();
          });
        });

      });
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // VFS
  /////////////////////////////////////////////////////////////////////////////

  describe('VFS', function() {
    var str = 'Mocha Testing';

    describe('#exists', function() {
      it('should not find folder', function(done) {
        var file = {path: 'home:///.mocha'};

        _callVFS('exists', file, function(error, result) {
          assert.equal(null, error);
          assert.equal(false, result);
          done();
        });
      });
    });

    describe('#exists', function() {
      it('should not find file', function(done) {
        _callVFS('exists', {path: 'home:///.mocha/test.txt'}, function(error, result) {
          assert.equal(null, error);
          assert.equal(false, result);
          done();
        });
      });
    });

    describe('#mkdir', function() {
      it('should create folder without error', function(done) {
        _callVFS('mkdir', {path: 'home:///.mocha'}, function(error, result) {
          assert.equal(null, error);
          assert.equal(true, result);
          done();
        });
      });
    });

    describe('#write', function() {
      it('should write file without error', function(done) {
        var data = (new Buffer(str).toString('base64'));
        var file = {
          path: 'home:///.mocha/test.txt',
          data: 'data:text/plain;base64,' + data
        };
        _callVFS('write', file, function(error, result) {
          assert.equal(null, error);
          assert.equal(true, result);
          done();
        });
      });
    });

    describe('#read', function() {
      it('should read file without error', function(done) {
        _callVFS('read', {path: 'home:///.mocha/test.txt', options: {raw: false, stream: false}}, function(error, result) {
          assert.equal(null, error);

          var result = result.replace(/^data\:(.*);base64\,/, '') || '';
          result = new Buffer(result, 'base64').toString('utf8');

          assert.equal(str, result);
          done();
        });
      });
    });

    describe('#scandir', function() {
      it('should find file (path and mime) without error', function(done) {
        var tst = 'home:///.mocha/test.txt';
        var found = {};
        _callVFS('scandir', {path: 'home:///.mocha'}, function(error, result) {
          assert.equal(null, error);

          try {
            result.forEach(function(f) {
              if ( f.filename === 'test.txt' ) {
                found = {
                  path: f.path,
                  mime: f.mime
                };
              }
            });
          } catch ( e ) {};
          assert.equal(tst, found.path);
          assert.equal('text/plain', found.mime);
          done();
        });
      });
    });

    describe('#move', function() {
      it('should rename/move file without error', function(done) {
        var file = {
          src: 'home:///.mocha/test.txt',
          dest: 'home:///.mocha/test2.txt'
        };
        _callVFS('move', file, function(error, result) {
          assert.equal(null, error);
          assert.equal(true, result);
          done();
        });
      });
    });

    describe('#copy', function() {
      it('should copy file without error', function(done) {
        var file = {
          src: 'home:///.mocha/test2.txt',
          dest: 'home:///.mocha/test3.txt'
        };
        _callVFS('copy', file, function(error, result) {
          assert.equal(null, error);
          assert.equal(true, result);
          done();
        });
      });

      it('should copy folder without error', function(done) {
        var file = {
          src: 'home:///.mocha',
          dest: 'home:///.mocha-copy'
        };
        _callVFS('copy', file, function(error, result) {
          assert.equal(null, error);
          assert.equal(true, result);
          done();
        });
      });
    });

    describe('#fileinfo', function() {
      it('should get file information without error', function(done) {
        _callVFS('fileinfo', {path: 'home:///.mocha/test2.txt'}, function(error, result) {
          assert.equal(null, error);
          assert.equal('home:///.mocha/test2.txt', result.path);
          assert.equal('test2.txt', result.filename);
          assert.equal('text/plain', result.mime);
          done();
        });
      });
    });

    describe('#delete', function() {
      it('should delete file without error', function(done) {
        _callVFS('delete', {path: 'home:///.mocha/test2.txt'}, function(error, result) {
          assert.equal(null, error);
          assert.equal(true, result);
          done();
        });
      });

      it('should delete folder without error', function(done) {
        _callVFS('delete', {path: 'home:///.mocha'}, function(error, result) {
          assert.equal(null, error);
          assert.equal(true, result);
          done();
        });
      });

      it('should delete copied folder without error', function(done) {
        _callVFS('delete', {path: 'home:///.mocha-copy'}, function(error, result) {
          assert.equal(null, error);
          assert.equal(true, result);
          done();
        });
      });
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // HTTP SERVER
  /////////////////////////////////////////////////////////////////////////////

  describe('Node HTTP Server', function() {
    var url;
    var cookie;

    function post(uurl, data, cb) {
      var opts = {
        url: uurl,
        method: 'POST',
        json: data
      };

      if ( cookie ) {
        var j = _req.jar();
        var ck = _req.cookie(cookie);
        j.setCookie(ck, url);
        opts.jar = j;
      }

      _req(opts, function(error, response, body) {
        cb((error || false), response, (error ? false : body));
      });
    }

    before(function() {
      url = 'http://localhost:' + String(instance.PORT);
      _osjs.run();
    });

    describe('#index', function() {
      it('should return 200', function(done) {
        _req({
          method: 'GET',
          url: url + '/'
        }, function(error, res) {
          assert.equal(200, res.statusCode);
          done();
        });
      });
    });

    describe('#login', function() {
      it('should return 200 with proper json result', function(done) {
        var data = {
          username: 'demo',
          password: 'demo'
        };

        var exp = {
          userData: {
            id: 0,
            username: 'demo',
            name: 'Demo User',
            groups: [ 'admin' ]
          },
          userSettings: {},
          blacklistedPackages: []
        };

        post(url + '/API/login', data, function(err, res, body) {
          assert.equal(false, err);
          assert.equal(200, res.statusCode);
          assert.equal(null, body.error);

          var expc = {
            userData: body.result.userData,
            userSettings: body.result.userSettings,
            blacklistedPackages: []
          };

          assert.equal(JSON.stringify(exp), JSON.stringify(expc));

          cookie = res.headers['set-cookie'][0];
          done();
        });
      });
    });

    describe('#api', function() {
      it('w/session - should return 200 with proper response', function(done) {
        var data = {
          path: 'default/Settings',
          method: 'test'
        };

        post(url + '/API/application', data, function(err, res, body) {
          assert.equal(false, err);
          assert.equal(200, res.statusCode);
          assert.equal(null, body.error);
          assert.equal('test', body.result);
          done();
        });
      });
    });

    after(function() {
      _osjs.destroy();
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // MISC
  /////////////////////////////////////////////////////////////////////////////

  /*
  describe('API', function() {
    describe('Package Management API', function() {
      describe('#list', function() {
        it('should return data', function(done) {
          instance.api.packages(serverObject, {
            command: 'list',
            args: {
              scope: 'system'
            }
          }, function(error, result) {
            assert.equal(false, error);
            assert.notEqual(0, Object.keys(result).length);
            done();
          });
        });
      });

      describe('#install', function() {
        it('should install', function(done) {
          instance.api.packages(serverObject, {
            command: 'install',
            args: {
              zip: 'osjs:///Test.zip',
              dest: 'home:///.packages/Test',
              paths: [1, 2, 3]
            }
          }, function(error, result) {
            assert.equal(false, error);
            assert.equal(true, result);
            done();
          });
        });

        it('should trigger error', function(done) {
          instance.api.packages(serverObject, {
            command: 'install',
            args: {
              zip: 'osjs:///Test.zip',
              dest: 'home:///.packages',
              paths: [1, 2, 3]
            }
          }, function(error, result) {
            assert.notEqual(false, error);
            done();
          });
        });
      });

      describe('#uninstall', function() {
        it('should uninstall', function(done) {
          instance.api.packages(serverObject, {
            command: 'uninstall',
            args: {
              path: 'home:///.packages/Test',
              paths: [1, 2, 3]
            }
          }, function(error, result) {
            assert.equal(false, error);
            assert.equal(true, result);
            done();
          });
        });
      });

    });
    */

    /*
    describe('cURL', function() {
      describe('#HEAD', function() {
        it('successfull HEAD request', function(done) {
          instance.api.curl({
            method: 'HEAD',
            url: 'http://os.js.org/test/curl-example.html'
          }, function(error, result) {
            assert.equal(false, error);
            assert.equal(200, result.httpCode);
            done();
          }, request, response, instance.config);
        });
      });

      describe('#GET', function() {
        var testFor = '<!DOCTYPE html><html><head></head><body>OS.js Test</body></html>\n';
        it('successfull GET request', function(done) {
          instance.api.curl({
            method: 'GET',
            url: 'http://os.js.org/test/curl-example.html'
          }, function(error, result) {
            assert.equal(false, error);
            assert.equal(200, result.httpCode);
            assert.equal(testFor, result.body);
            done();
          }, request, response, instance.config);
        });

        it('successfull GET binary/raw request', function(done) {
          instance.api.curl({
            method: 'GET',
            binary: true,
            url: 'http://os.js.org/test/curl-example.html'
          }, function(error, result) {
            var data = 'data:application/octet-stream;base64,' + (new Buffer(testFor).toString('base64'));
            assert.equal(false, error);
            assert.equal(200, result.httpCode);
            assert.equal(data, result.body);
            done();
          }, request, response, instance.config);
        });
      });

      describe('#POST', function() {
        var testFor = '<!DOCTYPE html><html><head></head><body>OS.js Test</body></html>';
        it('successfull POST request', function(done) {
          instance.api.curl({
            method: 'POST',
            url: 'http://os.js.org/test/curl-example.html'
          }, function(error, result) {
            assert.equal(false, error);
            assert.equal(405, result.httpCode); // Should be 405 because of github pages
            done();
          }, request, response, instance.config);
        });
      });

    });
  });
  */
})();
