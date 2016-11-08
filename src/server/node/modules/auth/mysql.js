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
const _mysql = require('mysql');
const _bcrypt = require('bcrypt');
const _utils = require('./../../core/utils.js');

var pool;

module.exports.login = function(http, data) {
  const q = 'SELECT `id`, `username`, `name`, `password` FROM `users` WHERE `username` = ? LIMIT 1;';
  const a = [data.username];

  return new Promise(function(resolve, reject) {
    function _invalid() {
      reject('Invalid credentials');
    }

    function _auth(row) {
      const hash = row.password.replace(/^\$2y(.+)$/i, '\$2a$1');
      _bcrypt.compare(data.password, hash, function(err, res) {
        if ( err ) {
          reject(err);
        } else if ( res === true ) {
          resolve({
            id: parseInt(row.id),
            username: row.username,
            name: row.name
          });
        } else {
          _invalid();
        }
      });
    }

    _utils.mysqlQuery(pool, q, a, function(err, row, fields) {
      if ( err ) {
        reject(err);
      } else if ( !row ) {
        _invalid();
      } else {
        _auth(row);
      }
    }, true);
  });
};

module.exports.logout = function(http) {
  return new Promise(function(resolve) {
    resolve(true);
  });
};

module.exports.manage = function(http) {
  return new Promise(function(resolve, reject) {
    reject('Not available');
  });
};

module.exports.initSession = function(http) {
  return new Promise(function(resolve) {
    resolve(true);
  });
};

module.exports.checkPermission = function(http, type, options) {
  return new Promise(function(resolve) {
    resolve(true);
  });
};

module.exports.checkSession = function(http) {
  return new Promise(function(resolve, reject) {
    if ( http.session.get('username') ) {
      resolve();
    } else {
      reject('You have no OS.js Session, please log in!');
    }
  });
};

module.exports.register = function(config) {
  var ccfg = _utils.mysqlConfiguration(config);
  pool = _mysql.createPool(ccfg);
};

module.exports.destroy = function() {
};
