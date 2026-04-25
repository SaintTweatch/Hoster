'use strict';

const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuid } = require('uuid');
const pidusage = require('pidusage');

const db = require('../db');
const paths = require('../utils/paths');
const logger = require('../utils/logger');
const validators = require('../utils/validators');
const logService = require('./logService');
const configService = require('./configService');
const modManager = require('./modManager');
const { broadcast, TOPICS } = require('../websocket/wsServer');

/** @type {Map<string, ServerProcess>} */
const running = new Map();

const STATUS = Object.freeze({
  STOPPED: 'stopped',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  CRASHED: 'crashed',
  INSTALLING: 'installing',
  UPDATING: 'updating',
});

class ServerProcess {
  constructor(serverRow) {
    this.id = serverRow.id;
    this.row = serverRow;
    this.child = null;
    this.pid = null;
    this.status = STATUS.STOPPED;
    this.startedAt = null;
    this.lastExitCode = null;
    this.crashCount = 0;
    this.intentionalStop = false;
    this.statsTimer = null;
    this.scheduleTimers = [];
  }

  setStatus(status, extra = {}) {
    this.status = status;
    broadcast(TOPICS.SERVER_STATUS, {
      serverId: this.id,
      status,
      pid: this.pid,
      startedAt: this.startedAt,
      ...extra,
    });
    db.recordEvent(this.id, 'status', status);
  }

  startStatsLoop() {
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = setInterval(async () => {
      if (!this.pid) return;
      try {
        const stats = await pidusage(this.pid);
        broadcast(TOPICS.SERVER_STATS, {
          serverId: this.id,
          cpu: Number(stats.cpu.toFixed(2)),
          memory: stats.memory,
          uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
        });
      } catch (_) {
        // Process likely just exited; let the exit handler manage state.
      }
    }, 3000);
  }

  stopStatsLoop() {
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;
  }
}

function getServerRow(serverId) {
  const row = db.get().prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  if (!row) {
    const err = new Error(`Server ${serverId} not found`);
    err.status = 404;
    throw err;
  }
  return row;
}

function listServers() {
  const rows = db.get().prepare('SELECT * FROM servers ORDER BY created_at ASC').all();
  return rows.map((row) => ({ ...row, status: getStatus(row.id) }));
}

function getStatus(serverId) {
  const proc = running.get(serverId);
  return proc ? proc.status : STATUS.STOPPED;
}

function getProcess(serverId) {
  let proc = running.get(serverId);
  if (!proc) {
    proc = new ServerProcess(getServerRow(serverId));
    running.set(serverId, proc);
  }
  return proc;
}

function detectExecutable(installDir) {
  if (process.platform === 'win32') {
    const candidates = ['DayZServer_x64.exe', 'DayZServer.exe'];
    for (const c of candidates) {
      const p = path.join(installDir, c);
      if (fs.existsSync(p)) return c;
    }
    return 'DayZServer_x64.exe';
  }
  return 'DayZServer';
}

function defaultProfileDir(serverId) {
  return path.join(paths.SERVERS_DIR, serverId, 'profiles');
}

function createServer({ name, port, queryPort, branch, autoStart, autoRestart }) {
  validators.assert(validators.isValidName(name), 'Invalid server name');
  validators.assert(validators.isValidPort(port), 'Invalid port');
  validators.assert(validators.isValidPort(queryPort), 'Invalid query port');
  validators.assert(['public', 'experimental'].includes(branch || 'public'), 'branch must be "public" or "experimental"');

  const id = uuid();
  const slug = `${validators.slugify(name)}-${id.slice(0, 8)}`;
  const installPath = path.join(paths.SERVERS_DIR, id);

  fs.ensureDirSync(installPath);
  fs.ensureDirSync(defaultProfileDir(id));

  db.get()
    .prepare(
      `INSERT INTO servers (id, name, slug, install_path, executable, port, query_port, profile_dir, branch, auto_start, auto_restart)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      name,
      slug,
      installPath,
      detectExecutable(installPath),
      Number(port),
      Number(queryPort),
      defaultProfileDir(id),
      branch || 'public',
      autoStart ? 1 : 0,
      autoRestart ? 1 : 0
    );

  // Seed default config
  configService.saveConfigPayload(id, {
    ...configService.DEFAULT_CONFIG,
    hostname: name,
    steamQueryPort: Number(queryPort),
  });

  db.recordEvent(id, 'created', `Server "${name}" created at ${installPath}`);
  return getServerRow(id);
}

function updateServer(serverId, patch) {
  const row = getServerRow(serverId);
  const allowed = ['name', 'port', 'query_port', 'branch', 'auto_start', 'auto_restart', 'restart_schedule', 'cpu_count', 'extra_params', 'executable'];
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (patch[key] === undefined) continue;
    let v = patch[key];
    if (key === 'name') {
      validators.assert(validators.isValidName(v), 'Invalid name');
    }
    if (key === 'port' || key === 'query_port') {
      validators.assert(validators.isValidPort(v), `Invalid ${key}`);
      v = Number(v);
    }
    if (key === 'branch') {
      validators.assert(['public', 'experimental'].includes(v), 'branch must be "public" or "experimental"');
    }
    if (key === 'auto_start' || key === 'auto_restart') v = v ? 1 : 0;
    if (key === 'cpu_count') v = v == null ? null : Math.max(1, Math.min(64, Number(v)));
    if (key === 'restart_schedule' && v) {
      validators.assert(typeof v === 'string' && /^[0-9, ]+$/.test(v), 'restart_schedule must be a comma-separated list of hours (0-23)');
    }
    if (key === 'extra_params' && v) {
      validators.assert(typeof v === 'string' && v.length < 1024, 'extra_params too long');
    }
    fields.push(`${key} = ?`);
    values.push(v);
  }

  if (!fields.length) return row;
  values.push(serverId);
  db.get()
    .prepare(`UPDATE servers SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...values);

  rescheduleRestarts(serverId);
  return getServerRow(serverId);
}

function deleteServer(serverId, { wipeFiles = false } = {}) {
  const row = getServerRow(serverId);
  const proc = running.get(serverId);
  if (proc && proc.status !== STATUS.STOPPED) {
    throw Object.assign(new Error('Stop the server before deleting it.'), { status: 409 });
  }
  db.get().prepare('DELETE FROM servers WHERE id = ?').run(serverId);
  running.delete(serverId);
  if (wipeFiles) {
    try { fs.removeSync(row.install_path); } catch (_) {}
  }
  return true;
}

function buildLaunchArgs(row, mods) {
  const args = [];
  args.push(`-config=serverDZ.cfg`);
  args.push(`-port=${Number(row.port)}`);
  args.push(`-profiles=profiles`);
  if (row.cpu_count) args.push(`-cpuCount=${Number(row.cpu_count)}`);
  args.push('-dologs');
  args.push('-adminlog');
  args.push('-netlog');
  args.push('-freezecheck');

  const modArgs = modManager.buildModParams(row.install_path, mods);
  args.push(...modArgs);

  if (row.extra_params) {
    const tokens = String(row.extra_params).split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      if (validators.isSafeShellArg(t)) args.push(t);
    }
  }
  return args;
}

async function start(serverId) {
  const row = getServerRow(serverId);
  const proc = getProcess(serverId);
  if (proc.status === STATUS.RUNNING || proc.status === STATUS.STARTING) return proc;

  if (!await fs.pathExists(row.install_path)) {
    throw Object.assign(new Error('Install directory missing. Install the server first.'), { status: 409 });
  }
  const exe = path.join(row.install_path, row.executable || detectExecutable(row.install_path));
  if (!await fs.pathExists(exe)) {
    throw Object.assign(new Error(`Executable not found: ${exe}. Install or update the server first.`), { status: 409 });
  }

  // Re-write serverDZ.cfg from current saved config
  const cfg = configService.loadConfigPayload(serverId);
  await configService.writeServerDZ(row.install_path, cfg);
  await fs.ensureDir(row.profile_dir || defaultProfileDir(serverId));

  // Prepare mods: ensure enabled mods are installed, copy keys
  const mods = modManager.listMods(serverId).filter((m) => m.enabled);
  for (const mod of mods) {
    if (!mod.installed || !mod.installed_path || !await fs.pathExists(mod.installed_path)) {
      try {
        await modManager.installModForServer({ serverId, modId: mod.id, installDir: row.install_path });
      } catch (err) {
        logger.warn(`Mod ${mod.workshop_id} install failed: ${err.message}`);
      }
    }
  }
  await modManager.syncInstalledStateFromDisk(serverId, row.install_path);

  // Re-read mod folder layout for the launch param
  const installedFolders = await modManager.detectInstalledMods(row.install_path);
  const enabledMods = mods
    .filter((m) => installedFolders.find((f) => f.folder === `@${m.workshop_id}`))
    .map((m) => ({ ...m, folder: `@${m.workshop_id}` }));

  const args = buildLaunchArgs(row, enabledMods);
  logger.info(`Starting server ${serverId} -> ${exe} ${args.join(' ')}`);

  proc.intentionalStop = false;
  proc.setStatus(STATUS.STARTING);

  const child = spawn(exe, args, {
    cwd: row.install_path,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.child = child;
  proc.pid = child.pid;
  proc.startedAt = Date.now();

  child.stdout.on('data', (chunk) => logService.append(serverId, chunk.toString('utf8'), 'stdout'));
  child.stderr.on('data', (chunk) => logService.append(serverId, chunk.toString('utf8'), 'stderr'));

  child.on('error', (err) => {
    logger.error(`Server ${serverId} spawn error: ${err.message}`);
    logService.append(serverId, `[manager] spawn error: ${err.message}`, 'system');
    proc.setStatus(STATUS.CRASHED);
    proc.stopStatsLoop();
  });

  child.on('exit', (code, signal) => {
    proc.lastExitCode = code;
    proc.stopStatsLoop();
    proc.child = null;
    proc.pid = null;
    const wasRunning = proc.status === STATUS.RUNNING || proc.status === STATUS.STARTING;
    const exitedCleanly = code === 0 || proc.intentionalStop;

    logService.append(
      serverId,
      `[manager] process exited code=${code} signal=${signal || 'none'}`,
      'system'
    );

    if (proc.intentionalStop) {
      proc.setStatus(STATUS.STOPPED);
    } else if (wasRunning && !exitedCleanly) {
      proc.crashCount += 1;
      proc.setStatus(STATUS.CRASHED, { exitCode: code });
      if (row.auto_restart) {
        const delay = Math.min(60000, 5000 * Math.max(1, proc.crashCount));
        logger.warn(`Server ${serverId} crashed, auto-restart in ${delay}ms`);
        setTimeout(() => {
          start(serverId).catch((err) => {
            logger.error(`Auto-restart failed for ${serverId}: ${err.message}`);
          });
        }, delay).unref();
      }
    } else {
      proc.setStatus(STATUS.STOPPED);
    }
  });

  // Heuristic: once we see any output, assume RUNNING. Otherwise fall back to a 5s timer.
  const markRunningOnce = (() => {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      if (proc.child) proc.setStatus(STATUS.RUNNING);
      proc.startStatsLoop();
    };
  })();
  child.stdout.once('data', markRunningOnce);
  child.stderr.once('data', markRunningOnce);
  setTimeout(markRunningOnce, 5000).unref();

  return proc;
}

async function stop(serverId, { force = false } = {}) {
  const proc = running.get(serverId);
  if (!proc || !proc.child) return false;
  proc.intentionalStop = true;
  proc.setStatus(STATUS.STOPPING);
  if (process.platform === 'win32') {
    // SIGTERM doesn't really apply on Windows; use taskkill.
    spawn('taskkill', force ? ['/PID', String(proc.pid), '/T', '/F'] : ['/PID', String(proc.pid), '/T'], {
      windowsHide: true,
    });
  } else {
    try { proc.child.kill(force ? 'SIGKILL' : 'SIGTERM'); } catch (_) {}
  }
  return true;
}

async function restart(serverId) {
  const proc = running.get(serverId);
  if (proc && proc.child) {
    await new Promise((resolve) => {
      proc.child.once('exit', () => resolve());
      stop(serverId).catch(() => {});
      setTimeout(resolve, 15000).unref();
    });
  }
  return start(serverId);
}

function rescheduleRestarts(serverId) {
  const proc = getProcess(serverId);
  for (const t of proc.scheduleTimers) clearTimeout(t);
  proc.scheduleTimers = [];

  const row = getServerRow(serverId);
  if (!row.restart_schedule) return;
  const hours = String(row.restart_schedule)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 23);

  for (const h of hours) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(h, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const ms = next.getTime() - now.getTime();
    const t = setTimeout(() => {
      logger.info(`Scheduled restart for ${serverId} firing now`);
      restart(serverId).catch((err) => logger.error(err.message));
      rescheduleRestarts(serverId);
    }, ms);
    proc.scheduleTimers.push(t);
  }
}

async function bootstrap() {
  const rows = db.get().prepare('SELECT * FROM servers').all();
  for (const row of rows) {
    rescheduleRestarts(row.id);
    if (row.auto_start) {
      try {
        await start(row.id);
      } catch (err) {
        logger.warn(`Auto-start failed for ${row.id}: ${err.message}`);
      }
    }
  }
}

async function shutdownAll() {
  const promises = [];
  for (const [id, proc] of running) {
    if (proc.child) promises.push(stop(id));
  }
  await Promise.all(promises);
}

module.exports = {
  STATUS,
  listServers,
  getServerRow,
  getStatus,
  createServer,
  updateServer,
  deleteServer,
  start,
  stop,
  restart,
  bootstrap,
  shutdownAll,
  rescheduleRestarts,
  detectExecutable,
};
