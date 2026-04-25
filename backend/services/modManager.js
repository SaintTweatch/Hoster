'use strict';

const fs = require('fs-extra');
const path = require('path');

const db = require('../db');
const paths = require('../utils/paths');
const logger = require('../utils/logger');
const steam = require('./steamcmdService');
const validators = require('../utils/validators');

/**
 * Read the mod's "name" from its meta.cpp / mod.cpp if available.
 *
 * @param {string} modDir
 */
async function readModDisplayName(modDir) {
  const candidates = ['meta.cpp', 'mod.cpp'];
  for (const fname of candidates) {
    const p = path.join(modDir, fname);
    if (await fs.pathExists(p)) {
      try {
        const txt = await fs.readFile(p, 'utf8');
        const m = /name\s*=\s*"([^"]+)"/i.exec(txt);
        if (m) return m[1].trim();
      } catch (_) {
        // ignore
      }
    }
  }
  return path.basename(modDir);
}

/**
 * Detect installed mod folders inside a server's install directory.
 *
 * @param {string} installDir
 */
async function detectInstalledMods(installDir) {
  if (!installDir || !(await fs.pathExists(installDir))) return [];
  const entries = await fs.readdir(installDir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith('@')) continue;
    const dir = path.join(installDir, entry.name);
    const name = await readModDisplayName(dir);
    result.push({ folder: entry.name, path: dir, name });
  }
  return result;
}

/**
 * Sync the database mods table with what is actually installed on disk.
 *
 * @param {string} serverId
 * @param {string} installDir
 */
async function syncInstalledStateFromDisk(serverId, installDir) {
  const installed = await detectInstalledMods(installDir);
  const installedFolders = new Set(installed.map((m) => m.folder));
  const stmt = db.get();
  const rows = stmt.prepare('SELECT * FROM server_mods WHERE server_id = ?').all(serverId);

  for (const row of rows) {
    const folder = `@${row.workshop_id}`;
    const exists = installedFolders.has(folder) || (row.installed_path && fs.pathExistsSync(row.installed_path));
    stmt
      .prepare('UPDATE server_mods SET installed = ?, installed_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(exists ? 1 : 0, exists ? path.join(installDir, folder) : null, row.id);
  }
  return installed;
}

function listMods(serverId) {
  return db
    .get()
    .prepare(
      `SELECT id, server_id, workshop_id, name, enabled, load_order, kind, installed, installed_path, created_at, updated_at
       FROM server_mods WHERE server_id = ? ORDER BY load_order ASC, id ASC`
    )
    .all(serverId);
}

function addMod(serverId, { workshopId, name, kind = 'client', enabled = 1 }) {
  validators.assert(validators.isValidWorkshopId(workshopId), 'Invalid workshop id');
  validators.assert(['client', 'server'].includes(kind), 'kind must be "client" or "server"');
  const existing = db
    .get()
    .prepare('SELECT id FROM server_mods WHERE server_id = ? AND workshop_id = ? AND kind = ?')
    .get(serverId, String(workshopId), kind);
  if (existing) {
    throw Object.assign(new Error('Mod already added for this server'), { status: 409 });
  }
  const max = db
    .get()
    .prepare('SELECT COALESCE(MAX(load_order), 0) AS m FROM server_mods WHERE server_id = ?')
    .get(serverId).m;
  const info = db
    .get()
    .prepare(
      `INSERT INTO server_mods (server_id, workshop_id, name, enabled, load_order, kind)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(serverId, String(workshopId), name || `@${workshopId}`, enabled ? 1 : 0, max + 1, kind);
  return db.get().prepare('SELECT * FROM server_mods WHERE id = ?').get(info.lastInsertRowid);
}

function updateMod(modId, patch) {
  const allowed = ['name', 'enabled', 'load_order', 'kind'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (patch[key] === undefined) continue;
    let v = patch[key];
    if (key === 'enabled') v = v ? 1 : 0;
    if (key === 'load_order') v = Number(v) || 0;
    if (key === 'kind') {
      validators.assert(['client', 'server'].includes(v), 'kind must be "client" or "server"');
    }
    fields.push(`${key} = ?`);
    values.push(v);
  }
  if (!fields.length) return null;
  values.push(modId);
  db.get()
    .prepare(`UPDATE server_mods SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...values);
  return db.get().prepare('SELECT * FROM server_mods WHERE id = ?').get(modId);
}

function deleteMod(modId) {
  return db.get().prepare('DELETE FROM server_mods WHERE id = ?').run(modId).changes;
}

function setLoadOrder(serverId, orderedModIds) {
  const update = db.get().prepare('UPDATE server_mods SET load_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND server_id = ?');
  const tx = db.get().transaction((ids) => {
    ids.forEach((id, idx) => update.run(idx + 1, id, serverId));
  });
  tx(orderedModIds);
  return listMods(serverId);
}

/**
 * Build the "-mod=" / "-servermod=" launch parameter strings for an enabled mod set.
 *
 * @param {string} installDir
 * @param {Array<{folder?: string, workshop_id?: string, kind?: string}>} mods
 */
function buildModParams(installDir, mods) {
  const client = [];
  const server = [];
  for (const m of mods) {
    const folder = m.folder || `@${m.workshop_id}`;
    if (!folder) continue;
    if (!validators.isSafeShellArg(folder)) continue;
    const target = m.kind === 'server' ? server : client;
    target.push(folder);
  }
  const out = [];
  if (client.length) out.push(`-mod=${client.join(';')}`);
  if (server.length) out.push(`-servermod=${server.join(';')}`);
  return out;
}

/**
 * Copy bikey files from a mod's keys/ subfolder into the server's keys/ folder.
 *
 * @param {string} modDir
 * @param {string} serverDir
 */
async function copyKeys(modDir, serverDir) {
  const candidates = ['keys', 'key', 'Keys'];
  for (const dir of candidates) {
    const keyDir = path.join(modDir, dir);
    if (!(await fs.pathExists(keyDir))) continue;
    const target = path.join(serverDir, 'keys');
    await fs.ensureDir(target);
    const files = await fs.readdir(keyDir);
    for (const f of files) {
      if (!/\.bikey$/i.test(f)) continue;
      const src = path.join(keyDir, f);
      const dst = path.join(target, f);
      try {
        await fs.copy(src, dst, { overwrite: true });
      } catch (err) {
        logger.warn(`Failed to copy key ${src} -> ${dst}: ${err.message}`);
      }
    }
    return true;
  }
  return false;
}

/**
 * Install (or update) a workshop mod into the server's install directory.
 * Performs SteamCMD download + symlink/copy into the server folder + key copy.
 *
 * @param {{ serverId: string, modId: number, installDir: string }} opts
 */
async function installModForServer({ serverId, modId, installDir, onLine = null }) {
  const mod = db.get().prepare('SELECT * FROM server_mods WHERE id = ? AND server_id = ?').get(modId, serverId);
  if (!mod) throw Object.assign(new Error('Mod not found'), { status: 404 });

  const cachedDir = await steam.downloadWorkshopMod({ serverId, workshopId: mod.workshop_id, onLine });

  const folder = `@${mod.workshop_id}`;
  const target = path.join(installDir, folder);
  await fs.ensureDir(installDir);

  // Hard-copy the mod into the server folder. (Symlinks would be faster, but
  // require admin on Windows. Copying keeps the workflow portable.)
  await fs.remove(target);
  await fs.copy(cachedDir, target, { overwrite: true, errorOnExist: false });

  await copyKeys(target, installDir);

  db.get()
    .prepare(
      'UPDATE server_mods SET installed = 1, installed_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
    .run(target, modId);

  return target;
}

module.exports = {
  detectInstalledMods,
  syncInstalledStateFromDisk,
  listMods,
  addMod,
  updateMod,
  deleteMod,
  setLoadOrder,
  buildModParams,
  copyKeys,
  installModForServer,
};
