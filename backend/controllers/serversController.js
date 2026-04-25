'use strict';

const fs = require('fs-extra');
const path = require('path');

const ServerManager = require('../services/serverManager');
const steam = require('../services/steamcmdService');
const settings = require('../services/settingsService');
const modManager = require('../services/modManager');
const configService = require('../services/configService');
const logService = require('../services/logService');
const validators = require('../utils/validators');
const db = require('../db');
const { broadcast, TOPICS } = require('../websocket/wsServer');

async function list(_req, res) {
  res.json(ServerManager.listServers());
}

async function get(req, res) {
  const row = ServerManager.getServerRow(req.params.id);
  res.json({ ...row, status: ServerManager.getStatus(row.id) });
}

async function create(req, res) {
  const { name, port = 2302, queryPort = 27016, branch = 'public', autoStart = false, autoRestart = true } = req.body || {};
  const row = ServerManager.createServer({ name, port, queryPort, branch, autoStart, autoRestart });
  res.status(201).json(row);
}

async function update(req, res) {
  const row = ServerManager.updateServer(req.params.id, req.body || {});
  res.json(row);
}

async function remove(req, res) {
  const wipeFiles = req.query.wipe === '1' || req.query.wipe === 'true';
  ServerManager.deleteServer(req.params.id, { wipeFiles });
  res.json({ ok: true });
}

async function start(req, res) {
  const proc = await ServerManager.start(req.params.id);
  res.json({ ok: true, status: proc.status, pid: proc.pid });
}

async function stop(req, res) {
  const force = req.query.force === '1' || req.query.force === 'true';
  await ServerManager.stop(req.params.id, { force });
  res.json({ ok: true });
}

async function restart(req, res) {
  await ServerManager.restart(req.params.id);
  res.json({ ok: true });
}

async function install(req, res) {
  const row = ServerManager.getServerRow(req.params.id);
  const validate = !(req.query.validate === '0');
  const branch = (req.body && req.body.branch) || row.branch || 'public';

  // Synchronously block install attempts when no Steam credentials are
  // configured. The DayZ dedicated server (app 223350) is NOT anonymously
  // downloadable, so anonymous login silently fails inside SteamCMD with
  // "No subscription". Surface this clearly to the user up-front.
  const steamUser = settings.get('steam.username', '');
  if (!steamUser) {
    return res.status(412).json({
      error:
        'Steam credentials are not configured. The DayZ dedicated server requires a Steam account that owns DayZ. ' +
        'Open Settings and enter your Steam username and password.',
      code: 'STEAM_LOGIN_REQUIRED',
    });
  }

  res.status(202).json({ accepted: true, message: 'Install/update started.' });

  // Run async; report progress via websocket + per-server console log
  (async () => {
    try {
      broadcast(TOPICS.SERVER_STATUS, { serverId: row.id, status: ServerManager.STATUS.UPDATING });
      logService.append(
        row.id,
        '[manager] starting install/update via SteamCMD (this can take 5-15 minutes for ~7 GB on first install)',
        'system'
      );
      await steam.installOrUpdateServer({
        serverId: row.id,
        installDir: row.install_path,
        branch,
        validate,
        onLine: (line, percent) => {
          const tag = percent != null ? `[steamcmd ${percent.toFixed(1)}%]` : '[steamcmd]';
          logService.append(row.id, `${tag} ${line}`, 'system');
        },
      });
      const exe = ServerManager.detectExecutable(row.install_path);
      db.get().prepare('UPDATE servers SET executable = ? WHERE id = ?').run(exe, row.id);
      logService.append(row.id, `[manager] install/update complete - executable: ${exe}`, 'system');
      broadcast(TOPICS.SERVER_STATUS, { serverId: row.id, status: ServerManager.STATUS.STOPPED });
      broadcast(TOPICS.STEAM_PROGRESS, { serverId: row.id, kind: 'server-install', completed: true, percent: 100 });
    } catch (err) {
      logService.append(row.id, `[manager] install/update failed: ${err.message}`, 'system');
      broadcast(TOPICS.SERVER_STATUS, { serverId: row.id, status: ServerManager.STATUS.STOPPED, error: err.message });
      broadcast(TOPICS.STEAM_PROGRESS, { serverId: row.id, kind: 'server-install', error: err.message });
    }
  })();
}

async function getConfig(req, res) {
  const row = ServerManager.getServerRow(req.params.id);
  const cfg = configService.loadConfigPayload(row.id);
  res.json({
    payload: cfg,
    rendered: configService.renderServerDZ(cfg),
  });
}

async function saveConfig(req, res) {
  const row = ServerManager.getServerRow(req.params.id);
  const merged = configService.saveConfigPayload(row.id, req.body || {});
  await configService.writeServerDZ(row.install_path, merged);
  res.json({ ok: true, payload: merged });
}

async function getLogs(req, res) {
  const limit = Number(req.query.limit) || 500;
  const lines = logService.tail(req.params.id, limit);
  res.json({ lines });
}

async function listInstalledMods(req, res) {
  const row = ServerManager.getServerRow(req.params.id);
  const installed = await modManager.detectInstalledMods(row.install_path);
  res.json({ installed, mods: modManager.listMods(row.id) });
}

async function readFile(req, res) {
  const row = ServerManager.getServerRow(req.params.id);
  const rel = req.query.path;
  validators.assert(rel && typeof rel === 'string', 'path is required');
  validators.assert(!path.isAbsolute(rel), 'path must be relative');
  const target = require('../utils/paths').safeResolve(row.install_path, rel);
  if (!await fs.pathExists(target)) return res.status(404).json({ error: 'File not found' });
  const stat = await fs.stat(target);
  if (stat.size > 5 * 1024 * 1024) return res.status(413).json({ error: 'File too large to read' });
  const content = await fs.readFile(target, 'utf8');
  res.json({ path: rel, content, size: stat.size });
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  start,
  stop,
  restart,
  install,
  getConfig,
  saveConfig,
  getLogs,
  listInstalledMods,
  readFile,
};
