<?php namespace OSjs\Core;
/*!
 * OS.js - JavaScript Operating System
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

use OSjs\Core\Instance;
use OSjs\Core\Request;
use OSjs\Core\Storage;
use OSjs\Core\VFS;

use Exception;

class Authenticator
{
  protected static $INSTANCE;

  protected function __construct() {
  }

  public function login(Request $request) {
    throw new Exception('Invalid login handle');
  }

  public function logout(Request $request) {
    foreach ( array_keys($_SESSION) as $k ) {
      unset($_SESSION[$k]);
    }

    return true;
    return parent::logout($request);
  }

  public static function CheckPermissions(Request $request, $type, Array $options = []) {
    $authenticator = self::getInstance();

    if ( !$authenticator->checkSession($request) ) {
      $error = 'You have no OS.js Session, please log in!';
      if ( ($request->isfs && $request->endpoint !=  'read') || $request->isapi ) {
        $request->respond()->json([
          'error' => $error
        ], 403);
      } else {
        $request->respond()->error($error, 403);
      }
    }

    if ( !$authenticator->checkPermission($request, $type, $options) ) {
      $error = 'Access denied!';
      if ( ($request->isfs && $request->endpoint !=  'read') || $request->isapi ) {
        $request->respond()->json([
          'error' => $error
        ], 403);
      } else {
        $request->respond()->error($error, 403);
      }
    }
  }

  final public function getConfig() {
    $name = strtolower(str_replace('OSjs\\Modules\\Auth\\', '', get_class($this)));
    return Instance::getConfig()->modules->auth->$name;
  }

  public function checkSession(Request $request) {
    if ( $request->isapi && in_array($request->endpoint, ['login']) ) {
      return true;
    }
    return isset($_SESSION['username']);
  }

  public function checkPermission(Request $request, $type, Array $options = []) {
    if ( $type === 'package' ) {
      $blacklist = Storage::getInstance()->getBlacklist($request);
      return !in_array($options['path'], $blacklist);
    }

    $checks = [];
    $config = Instance::GetConfig();

    if ( $type === 'fs' ) {
      $checks = ['fs'];
      $protocol = VFS::GetProtocol($options['arguments']);

      if ( $fsgroups = (array)$config->vfs->groups ) {
        if ( isset($fsgroups[$protocol]) ) {
          $g = $fsgroups[$protocol];
          $checks[] += is_array($g) ? $g : [$g];
        }
      }

      $mounts = (array) $config->vfs->mounts;
      if ( isset($mounts[$protocol]) && is_array($mounts[$protocol]) && isset($mounts[$protocol]['ro']) ) {
        if ( $mounts[$protocol]['ro'] && VFS::IsWritableEndpoint($request->endpoint) ) {
          return false;
        }
      }

    } else if ( $type === 'api' ) {
      $apigroups = (array)$config->api->groups;
      if ( isset($apigroups[$request->endpoint]) ) {
        $g = $apigroups[$request->endpoint];
        $checks = is_array($g) ? $g : [$g];
      }
    }

    if ( $checks ) {
      $groups = isset($_SESSION['groups']) ? $_SESSION['groups'] : [];
      if ( in_array('admin', $groups) ) {
        return true;
      } else if ( sizeof(array_diff($groups, $checks)) ) {
        return false;
      }
    }

    return true;
  }

  public static function getInstance() {
    if ( !self::$INSTANCE ) {
      $name = Instance::GetConfig()->http->authenticator;
      $name = 'OSjs\\Modules\\Auth\\' . ucfirst($name);
      self::$INSTANCE = new $name();
    }
    return self::$INSTANCE;
  }
}
