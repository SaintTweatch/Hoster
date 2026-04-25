'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dzm-srv-'));
process.env.DATA_DIR = path.join(tmp, 'database');
process.env.SERVERS_DIR = path.join(tmp, 'servers');
process.env.LOGS_DIR = path.join(tmp, 'logs');
process.env.CONFIGS_DIR = path.join(tmp, 'configs');

const fse = require('fs-extra');
fse.ensureDirSync(process.env.DATA_DIR);
fse.ensureDirSync(process.env.SERVERS_DIR);

const db = require('../db');
db.init();

const ServerManager = require('../services/serverManager');

test('createServer persists the server row and seeds default config', () => {
  const row = ServerManager.createServer({
    name: 'My DayZ',
    port: 2302,
    queryPort: 27016,
    branch: 'public',
    autoStart: false,
    autoRestart: true,
  });
  assert.ok(row.id);
  assert.equal(row.name, 'My DayZ');
  assert.equal(row.port, 2302);
  assert.equal(row.query_port, 27016);

  const cfgRow = db.get().prepare('SELECT payload FROM server_configs WHERE server_id = ?').get(row.id);
  assert.ok(cfgRow);
  const cfg = JSON.parse(cfgRow.payload);
  assert.equal(cfg.hostname, 'My DayZ');
  assert.equal(cfg.steamQueryPort, 27016);
});

test('createServer rejects invalid name and port', () => {
  assert.throws(() => ServerManager.createServer({ name: '', port: 2302, queryPort: 27016 }));
  assert.throws(() => ServerManager.createServer({ name: 'ok', port: 999999, queryPort: 27016 }));
});

test('updateServer applies allowed fields and rejects nonsense', () => {
  const row = ServerManager.createServer({
    name: 'For Update',
    port: 2402,
    queryPort: 27116,
    branch: 'public',
    autoStart: false,
    autoRestart: false,
  });
  const updated = ServerManager.updateServer(row.id, { auto_restart: true, port: 2502 });
  assert.equal(updated.auto_restart, 1);
  assert.equal(updated.port, 2502);
  assert.throws(() => ServerManager.updateServer(row.id, { branch: 'fake' }));
});

test('listServers returns rows with derived status', () => {
  const list = ServerManager.listServers();
  assert.ok(Array.isArray(list));
  assert.ok(list.every((s) => typeof s.status === 'string'));
});
