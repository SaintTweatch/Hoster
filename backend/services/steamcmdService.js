'use strict';

const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');
const yauzl = require('yauzl');

const paths = require('../utils/paths');
const logger = require('../utils/logger');
const settings = require('./settingsService');
const { broadcast, TOPICS } = require('../websocket/wsServer');

const STEAMCMD_URL_WIN = 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip';
const STEAMCMD_URL_LINUX = 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz';

// DayZ App IDs
const DAYZ_SERVER_APPID = '223350';
const DAYZ_SERVER_APPID_EXP = '1042420';
const DAYZ_CLIENT_APPID = '221100'; // Workshop mods are published under the client app id

let runningSteam = false; // simple mutex – avoid concurrent SteamCMD runs
let runningChild = null;  // currently active SteamCMD child (for interactive stdin)
let guardWaiter = null;   // { resolve, reject } waiting for user-entered guard code

function buildLoginArgs() {
  const username = (settings.get('steam.username', '') || '').trim();
  const password = settings.get('steam.password', '') || '';
  if (!username) {
    return { args: ['+login', 'anonymous'], anonymous: true };
  }
  // Three-arg login: user pass guardcode. We omit guardcode here and react
  // interactively via stdin if SteamCMD prompts for it.
  if (password) {
    return { args: ['+login', username, password], anonymous: false, username };
  }
  return { args: ['+login', username], anonymous: false, username };
}

function steamcmdBinary() {
  if (process.platform === 'win32') {
    return path.join(paths.STEAMCMD_DIR, 'steamcmd.exe');
  }
  return path.join(paths.STEAMCMD_DIR, 'steamcmd.sh');
}

async function isInstalled() {
  return fs.pathExists(steamcmdBinary());
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    fs.ensureDirSync(path.dirname(dest));
    const file = fs.createWriteStream(dest);
    const req = https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        downloadFile(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    });
    req.on('error', reject);
    file.on('error', reject);
  });
}

function unzip(src, destDir) {
  return new Promise((resolve, reject) => {
    yauzl.open(src, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      zip.readEntry();
      zip.on('entry', (entry) => {
        const fullPath = path.join(destDir, entry.fileName);
        if (/\/$/.test(entry.fileName)) {
          fs.ensureDirSync(fullPath);
          zip.readEntry();
          return;
        }
        fs.ensureDirSync(path.dirname(fullPath));
        zip.openReadStream(entry, (rsErr, readStream) => {
          if (rsErr) return reject(rsErr);
          const ws = fs.createWriteStream(fullPath);
          readStream.pipe(ws);
          ws.on('finish', () => zip.readEntry());
          ws.on('error', reject);
        });
      });
      zip.on('end', () => resolve());
      zip.on('error', reject);
    });
  });
}

async function ensureSteamcmd(progress = () => {}) {
  if (await isInstalled()) return steamcmdBinary();
  await fs.ensureDir(paths.STEAMCMD_DIR);
  progress({ phase: 'download-steamcmd', percent: 5, message: 'Downloading SteamCMD...' });
  if (process.platform === 'win32') {
    const zipPath = path.join(paths.STEAMCMD_DIR, 'steamcmd.zip');
    await downloadFile(STEAMCMD_URL_WIN, zipPath);
    progress({ phase: 'install-steamcmd', percent: 50, message: 'Extracting SteamCMD...' });
    await unzip(zipPath, paths.STEAMCMD_DIR);
    fs.removeSync(zipPath);
  } else {
    const tarPath = path.join(paths.STEAMCMD_DIR, 'steamcmd_linux.tar.gz');
    await downloadFile(STEAMCMD_URL_LINUX, tarPath);
    progress({ phase: 'install-steamcmd', percent: 50, message: 'Extracting SteamCMD...' });
    await new Promise((resolve, reject) => {
      const p = spawn('tar', ['-xzf', tarPath, '-C', paths.STEAMCMD_DIR]);
      p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('tar failed'))));
      p.on('error', reject);
    });
    try { fs.chmodSync(steamcmdBinary(), 0o755); } catch (_) {}
    fs.removeSync(tarPath);
  }
  progress({ phase: 'install-steamcmd', percent: 100, message: 'SteamCMD installed.' });
  return steamcmdBinary();
}

/**
 * Run SteamCMD with the given args. Streams output via progress callback.
 *
 * @param {string[]} args
 * @param {(line: string) => void} onLine
 */
function runSteamcmd(args, onLine = () => {}, opts = {}) {
  const { context = {} } = opts;
  return new Promise(async (resolve, reject) => {
    if (runningSteam) {
      return reject(new Error('SteamCMD is already running. Wait for the current job to complete.'));
    }
    runningSteam = true;

    let loginFailureReason = null;
    let guardPromptedKind = null; // 'email' | 'mobile' | 'generic'

    try {
      const bin = await ensureSteamcmd((p) => onLine(`[steamcmd] ${p.message || ''}`));
      const spawnOpts = {
        cwd: paths.STEAMCMD_DIR,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      };
      const child = spawn(bin, args, spawnOpts);
      runningChild = child;

      // Split on BOTH \r and \n. SteamCMD overwrites its progress line with bare
      // \r many times before printing a newline; without splitting on \r, callers
      // would see no output for minutes during a download.
      let pending = '';
      const handle = (buf) => {
        pending += buf.toString('utf8');
        const parts = pending.split(/[\r\n]+/);
        pending = parts.pop() || '';
        for (const line of parts) {
          if (line.trim().length === 0) continue;
          inspectLine(line);
          onLine(line);
        }
        // Even mid-line prompts should be inspected so we can react quickly.
        if (pending.length) inspectLine(pending);
      };

      const inspectLine = (line) => {
        const lower = line.toLowerCase();
        if (lower.includes('two-factor code')) {
          if (guardPromptedKind !== 'mobile') {
            guardPromptedKind = 'mobile';
            promptGuard('mobile', context);
          }
        } else if (lower.includes('steam guard code') || lower.includes('please check your email')) {
          if (guardPromptedKind !== 'email') {
            guardPromptedKind = 'email';
            promptGuard('email', context);
          }
        } else if (lower.includes('invalid password') || lower.includes('logon failed')) {
          loginFailureReason = 'Invalid Steam username or password.';
        } else if (lower.includes('rate limit') || lower.includes('rate-limit')) {
          loginFailureReason = 'Steam rate-limited login attempts. Wait a few minutes and try again.';
        } else if (lower.includes('account logon denied')) {
          loginFailureReason = 'Account logon denied. Check Steam Guard / email.';
        } else if (lower.includes('logged in ok') || lower.includes('waiting for user info...ok')) {
          // Login success: clear any guard waiter and remember success.
          if (guardWaiter) {
            const w = guardWaiter; guardWaiter = null;
            try { w.resolve(); } catch (_) {}
          }
          settings.set('steam.last_login_at', new Date().toISOString());
          settings.set('steam.last_login_ok', '1');
        }
      };

      child.stdout.on('data', handle);
      child.stderr.on('data', handle);
      child.on('error', (err) => {
        runningSteam = false;
        runningChild = null;
        reject(err);
      });
      child.on('exit', (code) => {
        runningSteam = false;
        runningChild = null;
        if (pending.trim().length) {
          try { onLine(pending); } catch (_) { /* ignore */ }
          pending = '';
        }
        if (guardWaiter) {
          const w = guardWaiter; guardWaiter = null;
          try { w.reject(new Error('SteamCMD exited before guard code was provided')); } catch (_) {}
        }
        if (loginFailureReason) {
          settings.set('steam.last_login_ok', '0');
          return reject(new Error(loginFailureReason));
        }
        if (code === 0 || code === 6 || code === 7) {
          // SteamCMD frequently exits with 7 even on success; accept 0/6/7
          resolve(code);
        } else {
          reject(new Error(`SteamCMD exited with code ${code}`));
        }
      });
    } catch (err) {
      runningSteam = false;
      runningChild = null;
      reject(err);
    }
  });
}

/** Send a line of text to the active SteamCMD process via stdin. */
function sendInput(text) {
  if (!runningChild || !runningChild.stdin || runningChild.stdin.destroyed) {
    throw new Error('No SteamCMD process is currently waiting for input.');
  }
  runningChild.stdin.write(String(text).replace(/[\r\n]/g, '') + '\n');
}

function isAwaitingInput() {
  return Boolean(runningChild && !runningChild.killed);
}

function promptGuard(kind, context = {}) {
  const message =
    kind === 'mobile'
      ? 'SteamCMD is requesting your Steam Mobile Authenticator code.'
      : 'SteamCMD is requesting the Steam Guard code from your email.';
  logger.info('[steamcmd] ' + message);
  broadcast(TOPICS.STEAM_PROGRESS, {
    serverId: context.serverId || null,
    kind: 'steam-guard-required',
    guardKind: kind,
    message,
  });
}

function progressFromLine(line) {
  // SteamCMD prints update progress like:
  //  Update state (0x5) downloading, progress: 12.34 (123 / 1000)
  const m = /progress:\s*([0-9]+(?:\.[0-9]+)?)/i.exec(line);
  if (m) return Math.max(0, Math.min(100, parseFloat(m[1])));
  return null;
}

/**
 * Install/update the DayZ dedicated server into a target directory.
 *
 * @param {{ serverId: string, installDir: string, branch?: 'public'|'experimental', validate?: boolean }} opts
 */
async function installOrUpdateServer({ serverId, installDir, branch = 'public', validate = true, onLine = null }) {
  await fs.ensureDir(installDir);
  const appId = branch === 'experimental' ? DAYZ_SERVER_APPID_EXP : DAYZ_SERVER_APPID;
  const login = buildLoginArgs();
  if (login.anonymous) {
    throw Object.assign(
      new Error(
        'Steam credentials are not configured. The DayZ dedicated server (app 223350) is not anonymously downloadable. ' +
          'Open Settings and enter the Steam account that owns DayZ.'
      ),
      { status: 412, code: 'STEAM_LOGIN_REQUIRED' }
    );
  }
  const args = [
    '+force_install_dir', installDir,
    ...login.args,
    '+app_update', appId,
  ];
  if (validate) args.push('validate');
  args.push('+quit');

  logger.info(`SteamCMD install/update server ${serverId} -> ${installDir} (app ${appId}) as ${login.username}`);
  await runSteamcmd(
    args,
    (line) => {
      const p = progressFromLine(line);
      logger.info('[steamcmd] ' + line);
      if (typeof onLine === 'function') {
        try { onLine(line, p); } catch (_) { /* ignore */ }
      }
      broadcast(TOPICS.STEAM_PROGRESS, {
        serverId,
        kind: 'server-install',
        line,
        percent: p,
      });
    },
    { context: { serverId } }
  );
  return { ok: true, installDir };
}

/**
 * Download a workshop mod for DayZ (uses anonymous login, public mods only).
 *
 * @param {{ serverId?: string, workshopId: string }} opts
 * @returns {Promise<string>} Path to downloaded mod folder.
 */
async function downloadWorkshopMod({ serverId, workshopId, onLine = null }) {
  if (!/^[0-9]{6,15}$/.test(String(workshopId))) {
    throw new Error('Invalid workshop id');
  }
  await fs.ensureDir(paths.WORKSHOP_CACHE);
  const login = buildLoginArgs();
  if (login.anonymous) {
    throw Object.assign(
      new Error(
        'Steam credentials are not configured. Workshop downloads for DayZ require an account that owns DayZ. ' +
          'Open Settings and enter your Steam credentials.'
      ),
      { status: 412, code: 'STEAM_LOGIN_REQUIRED' }
    );
  }
  const args = [
    '+force_install_dir', paths.WORKSHOP_CACHE,
    ...login.args,
    '+workshop_download_item', DAYZ_CLIENT_APPID, String(workshopId),
    '+quit',
  ];
  logger.info(`SteamCMD download workshop ${workshopId} as ${login.username}`);
  await runSteamcmd(
    args,
    (line) => {
      const p = progressFromLine(line);
      logger.info('[steamcmd] ' + line);
      if (typeof onLine === 'function') {
        try { onLine(line, p); } catch (_) { /* ignore */ }
      }
      broadcast(TOPICS.STEAM_PROGRESS, {
        serverId,
        kind: 'workshop-download',
        workshopId,
        line,
        percent: p,
      });
    },
    { context: { serverId } }
  );

  const downloaded = path.join(
    paths.WORKSHOP_CACHE,
    'steamapps',
    'workshop',
    'content',
    DAYZ_CLIENT_APPID,
    String(workshopId)
  );
  if (!(await fs.pathExists(downloaded))) {
    throw new Error('Workshop download did not produce expected folder: ' + downloaded);
  }
  return downloaded;
}

/**
 * Run an interactive `+login user pass +quit` to verify credentials and let
 * SteamCMD cache the session. Resolves with the cached session info.
 */
async function testLogin({ onLine = null } = {}) {
  const login = buildLoginArgs();
  if (login.anonymous) {
    throw Object.assign(new Error('Steam credentials are not set.'), { status: 412 });
  }
  const args = [...login.args, '+quit'];
  logger.info(`SteamCMD test login as ${login.username}`);
  await runSteamcmd(
    args,
    (line) => {
      logger.info('[steamcmd] ' + line);
      if (typeof onLine === 'function') {
        try { onLine(line, null); } catch (_) {}
      }
    },
    { context: {} }
  );
  return { ok: true, username: login.username };
}

/** Forcefully cancel the running SteamCMD process, if any. */
function cancel() {
  if (runningChild && !runningChild.killed) {
    try { runningChild.kill(); } catch (_) {}
  }
}

module.exports = {
  ensureSteamcmd,
  isInstalled,
  steamcmdBinary,
  installOrUpdateServer,
  downloadWorkshopMod,
  testLogin,
  sendInput,
  cancel,
  isAwaitingInput,
  DAYZ_SERVER_APPID,
  DAYZ_CLIENT_APPID,
};
