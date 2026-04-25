#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Postinstall guard: verify that better-sqlite3 actually loads against the
 * currently running Node.js version. If a prebuilt binary was fetched for a
 * different ABI, recompile from source.
 *
 * This is what saves you from the dreaded:
 *   "Error: was compiled against a different Node.js version using
 *    NODE_MODULE_VERSION X. This version of Node.js requires NODE_MODULE_VERSION Y"
 */

const path = require('path');
const { execSync } = require('child_process');

function tryLoad() {
  try {
    require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'));
    return true;
  } catch (err) {
    return err;
  }
}

const result = tryLoad();
if (result === true) {
  console.log('[postinstall] better-sqlite3 native binding loads cleanly. ✅');
  process.exit(0);
}

console.warn('[postinstall] better-sqlite3 binding mismatch detected:');
console.warn('   ' + (result.message || result));
console.warn('[postinstall] Rebuilding from source against Node ' + process.version + '...');

try {
  // Force a true source build. better-sqlite3's install script is
  //   "prebuild-install || node-gyp rebuild --release"
  // Without this env var, prebuild-install will happily fetch a binary that
  // doesn't match the running Node ABI and we'll end up right back here.
  const env = Object.assign({}, process.env, {
    npm_config_build_from_source: 'better-sqlite3',
  });
  execSync('npm rebuild better-sqlite3 --foreground-scripts', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env,
  });
} catch (err) {
  console.error('[postinstall] Rebuild failed. You can retry manually with:');
  console.error('   $env:npm_config_build_from_source = "better-sqlite3"');
  console.error('   npm --prefix backend rebuild better-sqlite3 --foreground-scripts');
  console.error('On Windows you need MSBuild + Python (Visual Studio Build Tools with the');
  console.error('"Desktop development with C++" workload). On Linux: build-essential + python3.');
  process.exit(1);
}

const recheck = tryLoad();
if (recheck !== true) {
  console.error('[postinstall] better-sqlite3 still failing to load:', recheck.message || recheck);
  process.exit(1);
}
console.log('[postinstall] better-sqlite3 rebuilt successfully. ✅');
