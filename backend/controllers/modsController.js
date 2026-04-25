'use strict';

const ServerManager = require('../services/serverManager');
const modManager = require('../services/modManager');
const steam = require('../services/steamcmdService');
const logService = require('../services/logService');
const { broadcast, TOPICS } = require('../websocket/wsServer');

async function list(req, res) {
  const row = ServerManager.getServerRow(req.params.serverId);
  await modManager.syncInstalledStateFromDisk(row.id, row.install_path);
  res.json(modManager.listMods(row.id));
}

async function add(req, res) {
  const row = ServerManager.getServerRow(req.params.serverId);
  const { workshopId, name, kind, enabled = true } = req.body || {};
  const mod = modManager.addMod(row.id, { workshopId, name, kind, enabled });
  res.status(201).json(mod);
}

async function update(req, res) {
  const updated = modManager.updateMod(Number(req.params.modId), req.body || {});
  if (!updated) return res.status(404).json({ error: 'Mod not found or no fields to update' });
  res.json(updated);
}

async function remove(req, res) {
  const changes = modManager.deleteMod(Number(req.params.modId));
  if (!changes) return res.status(404).json({ error: 'Mod not found' });
  res.json({ ok: true });
}

async function reorder(req, res) {
  const ids = (req.body && req.body.order) || [];
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'order must be an array of mod ids' });
  const list = modManager.setLoadOrder(req.params.serverId, ids.map(Number));
  res.json(list);
}

async function install(req, res) {
  const row = ServerManager.getServerRow(req.params.serverId);
  const modId = Number(req.params.modId);
  res.status(202).json({ accepted: true, message: 'Mod download started.' });
  (async () => {
    try {
      logService.append(row.id, `[mods] installing workshop mod (id=${modId})`, 'system');
      const target = await modManager.installModForServer({
        serverId: row.id,
        modId,
        installDir: row.install_path,
        onLine: (line, percent) => {
          const tag = percent != null ? `[steamcmd ${percent.toFixed(1)}%]` : '[steamcmd]';
          logService.append(row.id, `${tag} ${line}`, 'system');
        },
      });
      logService.append(row.id, `[mods] mod installed at ${target}`, 'system');
      broadcast(TOPICS.STEAM_PROGRESS, { serverId: row.id, kind: 'workshop-download', percent: 100, completed: true });
    } catch (err) {
      logService.append(row.id, `[mods] mod install failed: ${err.message}`, 'system');
      broadcast(TOPICS.STEAM_PROGRESS, { serverId: row.id, kind: 'workshop-download', error: err.message });
    }
  })();
}

module.exports = { list, add, update, remove, reorder, install };
