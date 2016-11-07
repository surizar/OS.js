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
   * Attaches options to a XHR call
   */
  function appendRequestOptions(data, options) {
    options = options || {};

    var onprogress = options.onprogress || function() {};
    var ignore = ['onsuccess', 'onerror', 'onprogress', 'oncanceled'];

    Object.keys(options).forEach(function(key) {
      if ( ignore.indexOf(key) === -1 ) {
        data[key] = options[key];
      }
    });

    data.onprogress = function(ev) {
      if ( ev.lengthComputable ) {
        onprogress(ev, ev.loaded / ev.total);
      } else {
        onprogress(ev, -1);
      }
    };

    return data;
  }

  /**
   * Default Handler Connection Implementation
   *
   * <pre><b>
   * You only have access to this via the 'Handler' instance
   * </b></pre>
   *
   * @summary Wrappers for communicating over HTTP, WS and NW
   *
   * @constructor Connection
   * @memberof OSjs.Core
   */
  function Connection(handler) {
    this.index = 0;
    this.handler = handler;
  }

  /**
   * Initializes the instance
   *
   * @function init
   * @memberof OSjs.Core.Connection#
   */
  Connection.prototype.init = function(callback) {
    callback();
  };

  /**
   * Destroys the instance
   *
   * @function destroy
   * @memberof OSjs.Core.Connection#
   */
  Connection.prototype.destroy = function() {
    this.handler = null;
  };

  /**
   * Makes a HTTP POST call
   *
   * @function callPOST
   * @memberof OSjs.Core.Connection#
   *
   * @return {Boolean}
   */
  Connection.prototype.callPOST = function(form, options, onsuccess, onerror) {
    onerror = onerror || function() {
      console.warn('Connection::callPOST()', 'error', arguments);
    };

    Utils.ajax(appendRequestOptions({
      url: OSjs.VFS.Transports.Internal.path(),
      method: 'POST',
      body: form,
      onsuccess: function(result) {
        onsuccess(false, result);
      },
      onerror: function(result) {
        onerror('error', null, result);
      },
      oncanceled: function(evt) {
        onerror('canceled', null, evt);
      }
    }, options));

    return true;
  };

  /**
   * Makes a HTTP GET call
   *
   * @function callGET
   * @memberof OSjs.Core.Connection#
   *
   * @return {Boolean}
   */
  Connection.prototype.callGET = function(args, options, onsuccess, onerror) {
    onerror = onerror || function() {
      console.warn('Connection::callGET()', 'error', arguments);
    };

    var self = this;

    Utils.ajax(appendRequestOptions({
      url: args.url || OSjs.VFS.Transports.Internal.path(args.path),
      method: args.method || 'GET',
      responseType: 'arraybuffer',
      onsuccess: function(response, xhr) {
        if ( !xhr || xhr.status === 404 || xhr.status === 500 ) {
          onsuccess({error: xhr.statusText || response, result: null});
          return;
        }
        onsuccess({error: false, result: response});
      },
      onerror: function() {
        onerror.apply(self, arguments);
      }
    }, options));

    return true;
  };

  /**
   * Makes a HTTP XHR call
   *
   * @function callXHR
   * @memberof OSjs.Core.Connection#
   *
   * @return {Boolean}
   */
  Connection.prototype.callXHR = function(url, args, options, onsuccess, onerror) {
    onerror = onerror || function() {
      console.warn('Connection::callXHR()', 'error', arguments);
    };

    var self = this;

    Utils.ajax(appendRequestOptions({
      url: url,
      method: 'POST',
      json: true,
      body: args,
      onsuccess: function(/*response, request, url*/) {
        onsuccess.apply(self.handler, arguments);
      },
      onerror: function(/*error, response, request, url*/) {
        onerror.apply(self.handler, arguments);
      }
    }, options));

    return true;
  };

  /**
   * Perform a HTTP Request
   *
   * @function request
   * @memberof OSjs.Core.Connection#
   *
   * @return {Boolean}
   */
  Connection.prototype.request = function(url, args, options, onsuccess, onerror) {
    return this.callXHR(url, args, options, onsuccess, onerror);
  };

  /**
   * Wrapper for OS.js API calls
   *
   * @function _request
   * @memberof OSjs.Core.Connection#
   *
   * @return {Boolean}
   */
  Connection.prototype._request = function(isVfs, method, args, options, onsuccess, onerror) {
    // Some methods can only be handled via HTTP
    if ( isVfs ) {
      if ( method === 'FS:get' ) {
        return this.callGET(args, options, onsuccess, onerror);
      } else if ( method === 'FS:upload' ) {
        return this.callPOST(args, options, onsuccess, onerror);
      }
    }

    // Use AJAX or WebSocket for everything else
    var url = (function() {
      if ( isVfs ) {
        return API.getConfig('Connection.FSURI') + '/' + method.replace(/^FS\:/, '');
      }
      return API.getConfig('Connection.APIURI') + '/' + method;
    })();

    return this.request(url, args, options, onsuccess, onerror);
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Core.Connection = Connection;

})(OSjs.API, OSjs.Utils);

