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

(function(API, Utils) {
  'use strict';

  /**
   * @namespace Handlers
   * @memberof OSjs
   */

  /**
   * Callback for all Handler methods
   * @param {String} [error] Error from response (if any)
   * @param {Mixed} result Result from response (if any)
   * @callback CallbackHandler
   */

  var _handlerInstance;

  /////////////////////////////////////////////////////////////////////////////
  // DEFAULT HANDLING CODE
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Default Handler Implementation
   *
   * <pre><b>
   * YOU CAN ONLY GET AN INSTANCE WITH `Core.getHandler()`
   * </b></pre>
   *
   * @summary Used for communication, resources, settings and session handling
   * @throws {Error} If trying to construct multiple handlers
   *
   * @example
   * OSjs.Core.getHandler()
   *
   * @constructor Handler
   * @memberof OSjs.Core
   * @see OSjs.Core.getHandler
   */
  var Handler = function() {
    /*eslint consistent-this: "off"*/

    if ( _handlerInstance ) {
      throw Error('Cannot create another Handler Instance');
    }

    this._saveTimeout = null;

    /**
     * If user is logged in
     * @name loggedId
     * @memberof OSjs.Core.Handler#
     * @type {Boolean}
     */
    this.loggedIn   = false;

    /**
     * If browser is offline
     * @name offline
     * @memberof OSjs.Core.Handler#
     * @type {Boolean}
     */
    this.offline    = false;

    /**
     * User data
     * @name userData
     * @memberof OSjs.Core.Handler#
     * @type {Object}
     * @example
     * {
     *  id: -1,
     *  username: 'foo',
     *  groups: []
     * }
     */
    this.userData   = {
      id      : 0,
      username: 'root',
      name    : 'root user',
      groups  : ['admin']
    };

    /**
     * Connection management
     * @name connection
     * @memberof OSjs.Core.Handler#
     * @type {HandlerConnection}
     */
    var conf = API.getConfig('Connection');
    this.connection = new OSjs.Connections[conf.Type](this);
    this.authenticator = new OSjs.Auth[conf.Authenticator](this);
    this.storage = new OSjs.Storage[conf.Storage](this);

    _handlerInstance = this;
  };

  /**
   * Initializes the handler
   *
   * @function init
   * @memberof OSjs.Core.Handler#
   * @see OSjs.API.initialize
   *
   * @param   {CallbackHandler}      callback        Callback function
   */
  Handler.prototype.init = function(callback) {
    console.group('Handler::init()');

    var self = this;
    API.setLocale(API.getConfig('Locale'));

    if ( typeof navigator.onLine !== 'undefined' ) {
      Utils.$bind(window, 'offline', function(ev) {
        self.onOffline();
      });
      Utils.$bind(window, 'online', function(ev) {
        self.onOnline();
      });
    }

    this.connection.init(function(err) {
      console.groupEnd();

      if ( err ) {
        callback(err);
      } else {
        self.storage.init(function() {
          self.authenticator.init(function() {
            callback();
          });
        });
      }
    });
  };

  /**
   * Destroy the handler
   *
   * @function destroy
   * @memberof OSjs.Core.Handler#
   */
  Handler.prototype.destroy = function() {
    Utils.$unbind(window, 'offline');
    Utils.$unbind(window, 'online');

    if ( this.authenticator ) {
      this.authenticator.destroy();
    }
    this.authenticator = null;

    if ( this.storage ) {
      this.storage.destroy();
    }
    this.storage = null;

    if ( this.connection ) {
      this.connection.destroy();
    }
    this.connection = null;

    _handlerInstance = null;
  };

  /**
   * Default login method
   *
   * @function login
   * @memberof OSjs.Core.Handler#
   *
   * @param   {Object}           login         Login data
   * @param   {CallbackHandler}  callback      Callback function
   */
  Handler.prototype.login = function(login, callback) {
    console.info('Handler::login()', login);

    var self = this;
    this.authenticator.login(login, function(err, res) {
      if ( err ) {
        callback(err);
      } else {
        self.onLogin(res, callback);
      }
    });
  };

  /**
   * Default logout method
   *
   * @function logout
   * @memberof OSjs.Core.Handler#
   *
   * @param   {Boolean}          save          Save session?
   * @param   {CallbackHandler}  callback      Callback function
   */
  Handler.prototype.logout = function(save, callback) {
    console.info('Handler::logout()');

    var self = this;

    function _finished() {
      self.authenticator.logout(function(err, res) {
        if ( res  ) {
          self.loggedIn = false;
        }
        callback(err, res);
      });
    }

    if ( save ) {
      this.saveSession(function() {
        _finished(true);
      });
      return;
    }
    _finished(true);
  };

  /**
   * Default method for saving current sessions
   *
   * @function saveSession
   * @memberof OSjs.Core.Handler#
   *
   * @param   {CallbackHandler}  callback      Callback function
   */
  Handler.prototype.saveSession = function(callback) {
    var data = [];
    API.getProcesses().forEach(function(proc, i) {
      if ( proc && (proc instanceof OSjs.Core.Application) ) {
        data.push(proc._getSessionData());
      }
    });
    OSjs.Core.getSettingsManager().set('UserSession', null, data, callback);
  };

  /**
   * Get last saved sessions
   *
   * @function getLastSession
   * @memberof OSjs.Core.Handler#
   *
   * @param   {CallbackHandler}  callback      Callback function
   */
  Handler.prototype.getLastSession = function(callback) {
    callback = callback || function() {};

    var res = OSjs.Core.getSettingsManager().get('UserSession');
    var list = [];
    (res || []).forEach(function(iter, i) {
      var args = iter.args;
      args.__resume__ = true;
      args.__windows__ = iter.windows || [];

      list.push({name: iter.name, args: args});
    });

    callback(false, list);
  };

  /**
   * Default method to restore last running session
   *
   * @function loadSession
   * @memberof OSjs.Core.Handler#
   *
   * @param   {Function}  callback      Callback function => fn()
   */
  Handler.prototype.loadSession = function(callback) {
    callback = callback || function() {};

    console.info('Handler::loadSession()');

    this.getLastSession(function(err, list) {
      if ( err ) {
        callback();
      } else {
        API.launchList(list, null, null, callback);
      }
    });
  };

  /**
   * Default method to save given settings pool
   *
   * @function saveSettings
   * @memberof OSjs.Core.Handler#
   *
   * @param   {String}           [pool]        Pool Name
   * @param   {Mixed}            storage       Storage data
   * @param   {CallbackHandler}  callback      Callback function
   */
  Handler.prototype.saveSettings = function(pool, storage, callback) {
    var self = this;
    clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(function() {
      self.storage.settings(pool, storage, callback);
      clearTimeout(self._saveTimeout);
    }, 250);
  };

  /**
   * Default method to perform a resolve on a VFS File object.
   *
   * This should return the URL for given resource.
   *
   * @function getVFSPath
   * @memberof OSjs.Core.Handler#
   *
   * @param   {OSjs.VFS.File}       item      The File Object
   *
   * @return  {String}
   */
  Handler.prototype.getVFSPath = function(item) {
    var base = API.getConfig('Connection.FSURI', '/');
    if ( item ) {
      return base + '/get/' + item.path;
    }
    return base + '/upload';
  };

  /**
   * Gets the default options for API calls
   *
   * @function getAPICallOptions
   * @memberof OSjs.Core.Handler#
   *
   * @return  {Object}
   */
  Handler.prototype.getAPICallOptions = function() {
    return {};
  };

  /**
   * Default method to perform a call to the backend (API)
   *
   * Please note that this function is internal, and if you want to make
   * a actual API call, use "API.call()" instead.
   *
   * @param {String}    method      API method name
   * @param {Object}    args        API method arguments
   * @param {Function}  cbSuccess   On success
   * @param {Function}  cbError     On error
   * @param {Object}    [options]   Options passed on to the connection request method (ex: Utils.ajax)
   *
   * @function callAPI
   * @memberof OSjs.Core.Handler#
   * @see OSjs.Core.handler#getAPICallOptions
   * @see OSjs.Core.Handler#_callAPI
   * @see OSjs.Core.Handler#_callVFS
   * @see OSjs.Core.API.call
   */
  Handler.prototype.callAPI = function(method, args, cbSuccess, cbError, options) {
    args = args || {};
    options = Utils.mergeObject(this.getAPICallOptions(), options || {});
    cbSuccess = cbSuccess || function() {};
    cbError = cbError || function() {};

    if ( this.offline ) {
      cbError('You are currently off-line and cannot perform this operation!');
    } else if ( (API.getConfig('Connection.Type') === 'standalone') ) {
      cbError('You are currently running locally and cannot perform this operation!');
    } else {
      if ( method.match(/^FS/) ) {
        return this._callVFS(method, args, options, cbSuccess, cbError);
      }
      return this._callAPI(method, args, options, cbSuccess, cbError);
    }

    return false;
  };

  /**
   * Wrapper for server API XHR calls
   *
   * @function _callAPI
   * @memberof OSjs.Core.Handler#
   * @see OSjs.Core.Handler.callAPI
   *
   * @return {Boolean}
   */
  Handler.prototype._callAPI = function(method, args, options, cbSuccess, cbError) {
    return this.connection._request(false, method, args, options, cbSuccess, cbError);
  };

  /**
   * Wrapper for server VFS XHR calls
   *
   * @function _callVFS
   * @memberof OSjs.Core.Handler#
   * @see OSjs.Core.Handler.callAPI
   *
   * @return {Boolean}
   */
  Handler.prototype._callVFS = function(method, args, options, cbSuccess, cbError) {
    return this.connection._request(true, method, args, options, cbSuccess, cbError);
  };

  //
  // Events
  //

  /**
   * Called when login() is finished
   *
   * @function onLogin
   * @memberof OSjs.Core.Handler#
   *
   * @param   {Object}           data          JSON Data from login action (userData, userSettings, etc)
   * @param   {CallbackHandler}  callback      Callback function
   */
  Handler.prototype.onLogin = function(data, callback) {
    callback = callback || function() {};

    var userSettings = data.userSettings;
    if ( !userSettings || userSettings instanceof Array ) {
      userSettings = {};
    }

    this.userData = data.userData;

    // Ensure we get the user-selected locale configured from WM
    function getUserLocale() {
      var curLocale = API.getConfig('Locale');
      var detectedLocale = Utils.getUserLocale();

      if ( API.getConfig('LocaleOptions.AutoDetect', true) && detectedLocale ) {
        console.info('Auto-detected user locale via browser', detectedLocale);
        curLocale = detectedLocale;
      }

      var result = OSjs.Core.getSettingsManager().get('CoreWM');
      if ( !result ) {
        try {
          result = userSettings.CoreWM;
        } catch ( e )  {}
      }
      return result ? (result.language || curLocale) : curLocale;
    }

    document.getElementById('LoadingScreen').style.display = 'block';

    API.setLocale(getUserLocale());
    OSjs.Core.getSettingsManager().init(userSettings);

    if ( data.blacklistedPackages ) {
      OSjs.Core.getPackageManager().setBlacklist(data.blacklistedPackages);
    }

    this.loggedIn = true;
    this.authenticator.onLogin(data, callback);
  };

  /**
   * Called upon a VFS request
   *
   * You can use this to interrupt/hijack operations.
   *
   * It is what gets called 'before' a VFS request takes place
   *
   * @function onVFSRequest
   * @memberof OSjs.Core.Handler#
   *
   * @param   {String}    vfsModule     VFS Module Name
   * @param   {String}    vfsMethod     VFS Method Name
   * @param   {Object}    vfsArguments  VFS Method Arguments
   * @param   {Function}  callback      Callback function
   */
  Handler.prototype.onVFSRequest = function(vfsModule, vfsMethod, vfsArguments, callback) {
    // If you want to interrupt/hijack or modify somehow, just send the two arguments to the
    // callback: (error, result)
    callback(/* continue normal behaviour */);
  };

  /**
   * Called upon a VFS request completion
   *
   * It is what gets called 'after' a VFS request has taken place
   *
   * @function onVFSRequestCompleted
   * @memberof OSjs.Core.Handler#
   *
   * @param   {String}    vfsModule     VFS Module Name
   * @param   {String}    vfsMethod     VFS Method Name
   * @param   {Object}    vfsArguments  VFS Method Arguments
   * @param   {String}    vfsError      VFS Response Error
   * @param   {Mixed}     vfsResult     VFS Response Result
   * @param   {Function}  callback      Callback function
   */
  Handler.prototype.onVFSRequestCompleted = function(vfsModule, vfsMethod, vfsArguments, vfsError, vfsResult, callback) {
    // If you want to interrupt/hijack or modify somehow, just send the two arguments to the
    // callback: (error, result)
    callback(/* continue normal behaviour */);
  };

  /**
   * When browser goes online
   *
   * @function onOnline
   * @memberof OSjs.Core.Handler#
   */
  Handler.prototype.onOnline = function() {
    console.warn('Handler::onOnline()', 'Going online...');
    this.offline = false;

    var wm = OSjs.Core.getWindowManager();
    if ( wm ) {
      wm.notification({title: 'Warning!', message: 'You are On-line!'});
    }
  };

  /**
   * When browser goes offline
   *
   * @function onOffline
   * @memberof OSjs.Core.Handler#
   */
  Handler.prototype.onOffline = function() {
    console.warn('Handler::onOffline()', 'Going offline...');
    this.offline = true;

    var wm = OSjs.Core.getWindowManager();
    if ( wm ) {
      wm.notification({title: 'Warning!', message: 'You are Off-line!'});
    }
  };

  /**
   * Get data for logged in user
   *
   * @function getUserData
   * @memberof OSjs.Core.Handler#
   *
   * @return  {Object}      JSON With user data
   */
  Handler.prototype.getUserData = function() {
    return this.userData || {};
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Core.Handler = Handler;

  /**
   * Get running 'Handler' instance
   *
   * @function getHandler
   * @memberof OSjs.Core
   *
   * @return {OSjs.Core.Handler}
   */
  OSjs.Core.getHandler = function() {
    return _handlerInstance;
  };

})(OSjs.API, OSjs.Utils);

