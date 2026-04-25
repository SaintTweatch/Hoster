'use strict';

const path = require('path');
const fs = require('fs-extra');

const ROOT = path.resolve(__dirname, '..', '..');

const PATHS = {
  ROOT,
  BACKEND_DIR: path.join(ROOT, 'backend'),
  FRONTEND_DIR: path.join(ROOT, 'frontend'),
  DATA_DIR: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'database'),
  SERVERS_DIR: process.env.SERVERS_DIR ? path.resolve(process.env.SERVERS_DIR) : path.join(ROOT, 'servers'),
  CONFIGS_DIR: process.env.CONFIGS_DIR ? path.resolve(process.env.CONFIGS_DIR) : path.join(ROOT, 'configs'),
  LOGS_DIR: process.env.LOGS_DIR ? path.resolve(process.env.LOGS_DIR) : path.join(ROOT, 'logs'),
  STEAMCMD_DIR: process.env.STEAMCMD_PATH
    ? path.resolve(process.env.STEAMCMD_PATH)
    : path.join(ROOT, 'steamcmd'),
  WORKSHOP_CACHE: path.join(ROOT, 'steamcmd', 'workshop_cache'),
};

PATHS.DB_FILE = path.join(PATHS.DATA_DIR, 'dayz-manager.sqlite');

async function ensureRuntimeDirs() {
  await Promise.all([
    fs.ensureDir(PATHS.DATA_DIR),
    fs.ensureDir(PATHS.SERVERS_DIR),
    fs.ensureDir(PATHS.CONFIGS_DIR),
    fs.ensureDir(PATHS.LOGS_DIR),
    fs.ensureDir(PATHS.STEAMCMD_DIR),
  ]);
}

/**
 * Resolve a path that must remain inside one of the allow-listed roots.
 * Throws if the resolved path escapes the boundary.
 *
 * @param {string} base
 * @param {string} requested
 * @returns {string}
 */
function safeResolve(base, requested) {
  if (typeof requested !== 'string' || !requested.length) {
    throw new Error('Path is required');
  }
  const target = path.resolve(base, requested);
  const rel = path.relative(base, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Refusing to access path outside of ${base}: ${requested}`);
  }
  return target;
}

/**
 * Returns a server's install directory, creating safe subpaths.
 * @param {string} serverId
 */
function serverDir(serverId) {
  return path.join(PATHS.SERVERS_DIR, serverId);
}

module.exports = Object.assign(PATHS, { ensureRuntimeDirs, safeResolve, serverDir });
