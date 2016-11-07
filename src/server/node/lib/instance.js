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
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS' AND
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

/**
 * @namespace lib.instance
 */

/**
 * An object with information about the current environment
 * @property  {String}      [dist=dist]     Which dist to use
 * @property  {Number}      [port=AUTO]     Which port to start on
 * @typedef ServerOptions
 */

/**
 * An object with information about the current environment
 * @property  {api.logger}    LOGGER      The logger instance
 * @property  {String}        DIST        The dist environment name
 * @property  {Object}        CONFIG      The configuration tree
 * @property  {Object}        API         API methods dictionary
 * @property  {Array}         VFS         VFS Transport module list
 * @property  {Object}        AUTH        The Authentication module
 * @property  {Object}        STORAGE     The Storage module
 * @property  {Object}        DIRS        Directories tuple
 * @property  {Object}        PACKAGES    The package list
 * @typedef ServerInstance
 */

const _child = require('child_process');
const _fs = require('node-fs-extra');
const _path = require('path');

const _osjs = {
  http: require('./http.js'),
  logger: require('./logger.js'),
  auth: require('./auth.js'),
  vfs: require('./vfs.js'),
  utils: require('./utils.js')
};

///////////////////////////////////////////////////////////////////////////////
// GLOBALS
///////////////////////////////////////////////////////////////////////////////

var children = [];

const instance = {
  LOGGER: null,
  PORT: 8000,
  DIST: 'dist',
  LOGLEVEL: -2,
  CONFIG: {},
  API: {},
  VFS: [],
  PACKAGES: {},
  AUTH: null,
  STORAGE: null,
  DIRS: {
    root: _path.resolve(__dirname + '/../../../../'),
    modules: _path.resolve(__dirname + '/../modules'),
    server: _path.resolve(__dirname + '/../../'),
    packages: _path.resolve(__dirname, '/../../../../src/packages')
  }
};

function logger() {
  return instance.LOGGER;
}

///////////////////////////////////////////////////////////////////////////////
// LOADERS
///////////////////////////////////////////////////////////////////////////////

/*
 * Loads generated configuration file
 */
function loadConfiguration(opts) {
  const path = _path.join(instance.DIRS.server, 'settings.json');

  function _load(resolve, reject) {
    _fs.readFile(path, function(err, file) {
      if ( err ) {
        return reject(err);
      }

      const config = JSON.parse(file);

      instance.CONFIG = config;
      if ( config.http.port ) {
        instance.PORT = config.http.port;
      }

      Object.keys(opts).forEach(function(k) {
        if ( typeof instance[k] !== 'undefined' && typeof opts[k] !== 'undefined' ) {
          instance[k] = opts[k];
        }
      });

      if ( opts.ROOT ) {
        instance.DIRS.root = opts.ROOT;
      }

      if ( typeof opts.LOGLEVEL === 'number' ) {
        instance.LOGLEVEL = opts.LOGLEVEL;
      } else if ( typeof config.logging === 'number' ) {
        instance.LOGLEVEL = config.logging;
      }

      instance.DIRS.packages = _path.join(instance.DIRS.root, 'src/packages');
      instance.LOGGER = _osjs.logger.create(instance.LOGLEVEL);

      Object.keys(config.proxies).forEach(function(k) {
        instance.LOGGER.lognt('INFO', 'Using:', instance.LOGGER.colored('Proxy', 'bold'), k);
      });

      resolve();
    });
  }

  return new Promise(_load);
}

/*
 * Loads and registers all API methods
 */
function loadAPI() {
  const dirname = _path.join(instance.DIRS.modules, 'api');

  function _load(resolve, reject) {
    _fs.readdir(dirname, function(err, list) {
      if ( err ) {
        return reject(err);
      }

      _osjs.utils.iterate(list, function(filename, index, next) {
        if ( filename.substr(0, 1) !== '.' ) {
          const path = _path.join(dirname, filename);
          logger().lognt('INFO', 'Loading:', logger().colored('API', 'bold'), path.replace(instance.DIRS.root, ''));

          const methods = require(path);
          Object.keys(methods).forEach(function(k) {
            instance.API[k] = methods[k];
          });
        }
        next();
      }, resolve);
    });
  }

  return new Promise(_load);
}

/*
 * Loads and registers Authentication module(s)
 */
function loadAuth() {
  const name = instance.CONFIG.http.authenticator || 'demo';

  function _load(resolve, reject) {
    const path = _path.join(instance.DIRS.modules, 'auth/' + name + '.js');
    logger().lognt('INFO', 'Loading:', logger().colored('Authenticator', 'bold'), path.replace(instance.DIRS.root, ''));

    const a = require(path);
    const c = instance.CONFIG.modules.auth[name] || {};
    a.register(c);
    instance.AUTH = a;
    resolve();
  }

  return new Promise(_load);
}

/*
 * Loads and registers Storage module(s)
 */
function loadStorage() {
  const name = instance.CONFIG.http.storage || 'demo';

  function _load(resolve, reject) {
    const path = _path.join(instance.DIRS.modules, 'storage/' + name + '.js');
    logger().lognt('INFO', 'Loading:', logger().colored('Storage', 'bold'), path.replace(instance.DIRS.root, ''));

    const a = require(path);
    const c = instance.CONFIG.modules.storage[name] || {};
    a.register(c);
    instance.STORAGE = a;
    resolve();
  }

  return new Promise(_load);
}

/*
 * Loads and registers VFS module(s)
 */
function loadVFS() {
  const dirname = _path.join(instance.DIRS.modules, 'vfs');

  function _load(resolve, reject) {
    _fs.readdir(dirname, function(err, list) {
      if ( err ) {
        return reject(err);
      }

      _osjs.utils.iterate(list, function(filename, index, next) {
        if ( ['.', '_'].indexOf(filename.substr(0, 1)) === -1 ) {
          const path = _path.join(dirname, filename);
          logger().lognt('INFO', 'Loading:', logger().colored('VFS Transport', 'bold'), path.replace(instance.DIRS.root, ''));
          instance.VFS.push(require(path));
        }
        next();
      }, resolve);
    });
  }

  return new Promise(_load);
}

/*
 * Loads generated package manifest
 */
function registerPackages(servers) {
  const path = _path.join(instance.DIRS.server, 'packages.json');
  logger().lognt('INFO', 'Loading:', logger().colored('Configuration', 'bold'), path.replace(instance.DIRS.root, ''));

  function _createOldInstance(instance) {
    return {
      request: null,
      response: null,
      config: instance.CONFIG,
      handler: null,
      logger: logger()
    };
  }

  function _registerApplication() {
    if ( typeof module.register === 'function' ) {
      module.register(instance, packages[path], {
        http: servers.httpServer,
        ws: servers.websocketServer,
        proxy: servers.proxyServer
      });

      return false;
    } else if ( typeof module._onServerStart === 'function' ) {
      // Backward compatible with old API
      module._onServerStart(server.httpServer, _createOldInstance(instance), packages[path]);
    }

    return true;
  }

  function _registerExtension(module) {
    if ( typeof module.api === 'object' ) {
      Object.keys(module.api).forEach(function(k) {
        instance.API[k] = module.api[k];
      });

      return false;
    } else if ( typeof module.register === 'function' ) {
      // Backward compatible with old API
      var backAPI = {};
      module.register(backAPI, {}, _createOldInstance(instance));

      Object.keys(backAPI).forEach(function(k) {
        instance.API[k] = function(http, resolve, reject, args) {
          backAPI[k](_createOldInstance(instance), args, function(err, res) {
            if ( err ) {
              reject(err);
            } else {
              resolve(res);
            }
          });
        };
      });
    }

    return true;
  }

  function _launchSpawners(pn, module, metadata) {
    if ( metadata.spawn && metadata.spawn.enabled ) {
      const spawner = _path.join(instance.DIRS.packages, pn, metadata.spawn.exec);
      logger().lognt('INFO', 'Launching', logger().colored('Spawner', 'bold'), spawner.replace(instance.DIRS.root, ''));
      children.push(_child.fork(spawner, [], {
        stdio: 'pipe'
      }));
    }
  }

  function _load(resolve, reject) {
    _fs.readFile(path, function(err, file) {
      if ( err ) {
        return reject(err);
      }

      const manifest = JSON.parse(file);
      const packages = manifest[instance.DIST];

      Object.keys(packages).forEach(function(path) {
        const metadata = packages[path];

        var filename = 'api.js';
        if ( metadata.build && metadata.build.index ) {
          filename = _path.resolve(metadata.build.index);
        }

        metadata._indexFile = filename;

        const check = _path.join(instance.DIRS.packages, path, filename);
        if ( metadata.enabled !== false && _fs.existsSync(check) ) {
          var deprecated = false;
          if ( metadata.type === 'extension' ) {
            logger().lognt('INFO', 'Loading:', logger().colored('Application', 'bold'), check.replace(instance.DIRS.root, ''));
            deprecated = _registerExtension(require(check));
            _launchSpawners(path, module, metadata);
          } else {
            logger().lognt('INFO', 'Loading:', logger().colored('Extension', 'bold'), check.replace(instance.DIRS.root, ''));
            deprecated = _registerApplication(require(check));
          }

          if ( typeof module.api === 'undefined' ) {
            deprecated = true;
          }

          if ( deprecated ) {
            logger().lognt('WARN', logger().colored('Warning:', 'yellow'), path, logger().colored('is using the deprecated Application API(s)', 'bold'));
          }
        }
      });

      instance.PACKAGES = Object.freeze(packages);

      resolve(servers);
    });
  }

  return new Promise(_load);
}

///////////////////////////////////////////////////////////////////////////////
// REQUESTS
///////////////////////////////////////////////////////////////////////////////

function request(http) {
  // We use JSON as default responses, no matter what
  function _rejectResponse(err) {
    logger().log('ERROR', logger().colored(err, 'red'), err.stack || '<no stack trace>');

    if ( !http.isfs && !http.isapi ) {
      http.respond.error(err, 403);
    } else {
      http.respond.json({
        error: String(err),
        result: false
      }, 403);
    }
  }
  function _resolveResponse(result) {
    http.respond.json({
      error: null,
      result: result
    });
  }

  // Wrapper for checking permissions
  function _checkPermission(type, options) {
    const skip = type === 'api' && ['login'].indexOf(options.method) !== -1;

    return new Promise(function(resolve, reject) {
      if ( skip ) {
        resolve();
      } else {
        _osjs.auth.checkSession(http).then(resolve).catch(_rejectResponse);
      }
    }).then(function() {
      return new Promise(function(resolve, reject) {
        if ( skip ) {
          resolve();
        } else {
          _osjs.auth.checkPermission(http, type, options).then(resolve).catch(_rejectResponse);
        }
      });
    }).catch(_rejectResponse);
  }

  // Wrappers for performing API calls
  function _vfsCall() {
    var method = http.endpoint.replace(/(^get\/)?/, '');
    var args = http.data;

    if ( http.endpoint.match(/^get\//) ) {
      method = 'read';
      args = {path: http.endpoint.replace(/(^get\/)?/, '')};
    }

    _checkPermission('fs', {method: method, args: args}).then(function() {
      _osjs.vfs.request(http, method, args).then(_resolveResponse).catch(_rejectResponse);
    }).catch(_rejectResponse);
  }

  function _apiCall() {
    _checkPermission('api', {method: http.endpoint}, http.data).then(function() {
      instance.API[http.endpoint](http, http.data).then(_resolveResponse).catch(_rejectResponse);
    }).catch(_rejectResponse);
  }

  function _staticResponse() {
    function _serve() {
      const path = _path.join(instance.DIRS.root, instance.DIST, http.path);
      http.respond.file(path);
    }

    function _deny() {
      http.respond.error('Access denied', 403);
    }

    const pmatch = http.path.match(/^\/?packages\/(.*\/.*)\/(.*)/);
    if ( pmatch && pmatch.length === 3 ) {
      _checkPermission('package', {path: pmatch[1]}).then(function() {
        _osjs.auth.checkSession(http)
          .then(_serve).catch(_deny);
      }).catch(_deny);
    } else {
      _serve();
    }
  }

  // Take on the HTTP request
  _osjs.auth.initSession(http).then(function() {
    if ( http.request.method === 'GET' ) {
      if ( http.isfs ) {
        _vfsCall();
      } else {
        _staticResponse();
      }
    } else {
      if ( http.isfs ) {
        _vfsCall();
      } else {
        if ( typeof instance.API[http.endpoint] === 'function' ) {
          _apiCall();
        } else {
          http.respond.json({
            error: 'No such API method'
          }, 500);
        }
      }
    }
  });

}

///////////////////////////////////////////////////////////////////////////////
// EXPORTS
///////////////////////////////////////////////////////////////////////////////

/**
 * Performs a server request
 *
 * @param   {ServerRequest} http          OS.js Server Request
 *
 * @function request
 * @memberof lib.instance
 */
module.exports.request = request;

/**
 * Destroys the current instance
 *
 * @param   {ServerRequest} http          OS.js Server Request
 *
 * @function destroy
 * @memberof lib.instance
 */
module.exports.destroy = function destroy() {
  if ( instance.AUTH ) {
    instance.AUTH.destroy();
  }

  children.forEach(function(c) {
    c.kill();
  });

  _osjs.http.destroy();
};

/**
 * Initializes OS.js Server
 *
 * @param   {ServerOptions}   opts           Server Options
 *
 * @function init
 * @memberof lib.instance
 */
module.exports.init = function init(opts) {
  return new Promise(function(resolve, reject) {
    loadConfiguration(opts)
      .then(loadAPI)
      .then(loadAuth)
      .then(loadStorage)
      .then(loadVFS)
      .then(function() {
        return _osjs.http.init(instance);
      })
      .then(registerPackages)
      .then(function(servers) {
        resolve(Object.freeze(instance));
      })
      .catch(reject);
  });
};

/**
 * Runs the OS.js Server
 *
 * @function run
 * @memberof lib.instance
 */
module.exports.run = function run(port) {
  return _osjs.http.run(instance.PORT);
};

/**
 * Gets the `instance` object
 *
 * @function getInstance
 * @memberof lib.instance
 * @return {ServerInstance}
 */
module.exports.getInstance = function() {
  return Object.freeze(instance);
};

/**
 * Gets the `Authenticator`
 *
 * @function getAuthenticator
 * @memberof lib.instance
 */
module.exports.getAuth = function() {
  return instance.AUTH;
};

/**
 * Gets the `Storage`
 *
 * @function getStorage
 * @memberof lib.instance
 */
module.exports.getStorage = function() {
  return instance.STORAGE;
};

/**
 * Gets the `Config`
 *
 * @function getConfig
 * @memberof lib.instance
 */
module.exports.getConfig = function() {
  return Object.freeze(instance.CONFIG);
};

/**
 * Gets the `Logger"
 *
 * @function getLogger
 * @memberof lib.instance
 */
module.exports.getLogger = function() {
  return instance.LOGGER;
};
