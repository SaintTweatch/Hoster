'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Use a temp data directory so tests don't write into the user's database.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dzm-test-'));
process.env.DATA_DIR = path.join(tmp, 'database');
process.env.SERVERS_DIR = path.join(tmp, 'servers');
process.env.LOGS_DIR = path.join(tmp, 'logs');
process.env.CONFIGS_DIR = path.join(tmp, 'configs');

const paths = require('../utils/paths');
const fse = require('fs-extra');
fse.ensureDirSync(paths.DATA_DIR);
fse.ensureDirSync(paths.SERVERS_DIR);

const db = require('../db');
db.init();

const configService = require('../services/configService');
const validators = require('../utils/validators');

test('renderServerDZ produces a valid serverDZ.cfg with sane defaults', () => {
  const cfg = { ...configService.DEFAULT_CONFIG, hostname: 'Test Server', maxPlayers: 50 };
  const out = configService.renderServerDZ(cfg);
  assert.match(out, /hostname = "Test Server";/);
  assert.match(out, /maxPlayers = 50;/);
  assert.match(out, /class Missions/);
  assert.match(out, /template = "dayzOffline.chernarusplus";/);
});

test('validateConfig rejects bad maxPlayers', () => {
  assert.throws(() => configService.validateConfig({ ...configService.DEFAULT_CONFIG, maxPlayers: 9999 }));
});

test('validators detect unsafe shell args', () => {
  assert.equal(validators.isSafeShellArg('@CF'), true);
  assert.equal(validators.isSafeShellArg('@bad;rm -rf /'), false);
  assert.equal(validators.isSafeShellArg('-mod=@a;@b'), false); // ; is unsafe
});

test('validators accept valid workshop ids', () => {
  assert.equal(validators.isValidWorkshopId('1559212036'), true);
  assert.equal(validators.isValidWorkshopId('abc'), false);
});

test('saveConfigPayload + loadConfigPayload round-trip via SQLite', () => {
  const id = 'test-server-1';
  // server_configs has a foreign key to servers; create a parent row first.
  db.get()
    .prepare("INSERT INTO servers (id, name, slug, install_path) VALUES (?, ?, ?, ?)")
    .run(id, 'Roundtrip Server', 'rt-1', '/tmp/rt');
  configService.saveConfigPayload(id, { hostname: 'Roundtrip', maxPlayers: 30 });
  const loaded = configService.loadConfigPayload(id);
  assert.equal(loaded.hostname, 'Roundtrip');
  assert.equal(loaded.maxPlayers, 30);
});
