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
   * Authenticator Base Class
   *
   * @abstract
   * @constructor Authenticator
   * @memberof OSjs.Core
   */
  function Authenticator(handler) {
    this.handler = handler;
  }

  /**
   * Initializes the Authenticator
   *
   * @function init
   * @memberof OSjs.Core.Authenticator#
   *
   * @param   {CallbackHandler}      callback        Callback function
   */
  Authenticator.prototype.init = function(callback) {
    this.onCreateUI(callback);
  };

  /**
   * Destroys the Authenticator
   *
   * @function destroy
   * @memberof OSjs.Core.Authenticator#
   */
  Authenticator.prototype.destroy = function() {
    this.handler = null;
  };

  /**
   * Log in user
   *
   * @function login
   * @memberof OSjs.Core.Authenticator#
   *
   * @param   {Object}               data            Login form data
   * @param   {CallbackHandler}      callback        Callback function
   */
  Authenticator.prototype.login = function(data, callback) {
    this.handler.callAPI('login', data, function(response) {
      if ( response.result ) {
        callback(false, response.result);
      } else {
        var error = response.error || API._('ERR_LOGIN_INVALID');
        callback(API._('ERR_LOGIN_FMT', error), false);
      }
    }, function(error) {
      callback(API._('ERR_LOGIN_FMT', error), false);
    });
  };

  /**
   * Log out user
   *
   * @function logout
   * @memberof OSjs.Core.Authenticator#
   *
   * @param   {CallbackHandler}      callback        Callback function
   */
  Authenticator.prototype.logout = function(callback) {
    var opts = {};
    this.handler.callAPI('logout', opts, function(response) {
      if ( response.result ) {
        callback(false, true);
      } else {
        callback('An error occured: ' + (response.error || 'Unknown error'));
      }
    }, function(error) {
      callback('Logout error: ' + error);
    });
  };

  /**
   * When login has occured
   *
   * @function onLogin
   * @memberof OSjs.Core.Authenticator#
   *
   * @param   {Object}               data            Login data
   * @param   {CallbackHandler}      callback        Callback function
   */
  Authenticator.prototype.onLogin = function(data, callback) {
    callback(null, true);
  };

  /**
   * When login UI is requested
   *
   * @function onCreateUI
   * @memberof OSjs.Core.Authenticator#
   *
   * @param   {CallbackHandler}      callback        Callback function
   */
  Authenticator.prototype.onCreateUI = function(callback) {
    var self = this;
    var container = document.getElementById('Login');
    var login = document.getElementById('LoginForm');
    var u = document.getElementById('LoginUsername');
    var p = document.getElementById('LoginPassword');
    var s = document.getElementById('LoginSubmit');

    if ( !container ) {
      throw new Error('Could not find Login Form Container');
    }

    function _restore() {
      s.removeAttribute('disabled');
      u.removeAttribute('disabled');
      p.removeAttribute('disabled');
    }

    function _lock() {
      s.setAttribute('disabled', 'disabled');
      u.setAttribute('disabled', 'disabled');
      p.setAttribute('disabled', 'disabled');
    }

    login.onsubmit = function(ev) {
      _lock();
      if ( ev ) {
        ev.preventDefault();
      }

      self.handler.login({
        username: u.value,
        password: p.value
      }, function(err) {
        if ( err ) {
          alert(err);
          _restore();
        } else {
          container.parentNode.removeChild(container);
          callback();
        }
      });
    };

    container.style.display = 'block';

    _restore();
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Core.Authenticator = Authenticator;

})(OSjs.API, OSjs.Utils);

