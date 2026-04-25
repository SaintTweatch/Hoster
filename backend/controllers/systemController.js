'use strict';

const os = require('os');
const fs = require('fs-extra');

const paths = require('../utils/paths');
const steam = require('../services/steamcmdService');
const ServerManager = require('../services/serverManager');

async function info(_req, res) {
  const cpus = os.cpus();
  res.json({
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    hostname: os.hostname(),
    uptime: os.uptime(),
    cpu: {
      model: cpus[0]?.model || 'unknown',
      cores: cpus.length,
      load: os.loadavg(),
    },
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
    },
    paths: {
      root: paths.ROOT,
      data: paths.DATA_DIR,
      servers: paths.SERVERS_DIR,
      configs: paths.CONFIGS_DIR,
      logs: paths.LOGS_DIR,
      steamcmd: paths.STEAMCMD_DIR,
    },
    steamcmdInstalled: await steam.isInstalled(),
    serverCount: ServerManager.listServers().length,
  });
}

async function installSteamCmd(_req, res) {
  res.status(202).json({ accepted: true });
  steam
    .ensureSteamcmd()
    .catch(() => {
      // Errors already broadcast via WS in steamcmdService
    });
}

module.exports = { info, installSteamCmd };
