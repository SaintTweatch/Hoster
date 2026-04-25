'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dzm-mods-'));
process.env.DATA_DIR = path.join(tmp, 'database');
process.env.SERVERS_DIR = path.join(tmp, 'servers');
process.env.LOGS_DIR = path.join(tmp, 'logs');
process.env.CONFIGS_DIR = path.join(tmp, 'configs');

const fse = require('fs-extra');
fse.ensureDirSync(process.env.DATA_DIR);
fse.ensureDirSync(process.env.SERVERS_DIR);

const db = require('../db');
db.init();

const modManager = require('../services/modManager');

test('detectInstalledMods finds @-prefixed folders', async () => {
  const installDir = path.join(process.env.SERVERS_DIR, 'install-1');
  fse.ensureDirSync(path.join(installDir, '@CF'));
  fse.writeFileSync(path.join(installDir, '@CF', 'meta.cpp'), 'name = "CF"; publishedid = 0;');
  fse.ensureDirSync(path.join(installDir, '@VPPAdminTools'));
  fse.ensureDirSync(path.join(installDir, 'addons'));
  const found = await modManager.detectInstalledMods(installDir);
  const folders = found.map((m) => m.folder).sort();
  assert.deepStrictEqual(folders, ['@CF', '@VPPAdminTools']);
});

test('buildModParams produces -mod and -servermod', () => {
  const args = modManager.buildModParams('/tmp', [
    { folder: '@CF', kind: 'client' },
    { folder: '@VPPAdminTools', kind: 'client' },
    { folder: '@DayZServerHelper', kind: 'server' },
  ]);
  assert.deepStrictEqual(args, ['-mod=@CF;@VPPAdminTools', '-servermod=@DayZServerHelper']);
});

test('addMod / listMods / setLoadOrder works', () => {
  // create a fake server row
  const id = 'srv-test';
  db.get()
    .prepare(
      "INSERT INTO servers (id, name, slug, install_path, port, query_port) VALUES (?, ?, ?, ?, 2302, 27016)"
    )
    .run(id, 'Test', 'srv-test-slug', '/tmp/srv-test');

  const m1 = modManager.addMod(id, { workshopId: '1559212036', name: '@CF' });
  const m2 = modManager.addMod(id, { workshopId: '1828439124', name: '@Trader' });
  const list = modManager.listMods(id);
  assert.equal(list.length, 2);
  assert.equal(list[0].load_order, 1);
  assert.equal(list[1].load_order, 2);

  const reordered = modManager.setLoadOrder(id, [m2.id, m1.id]);
  assert.equal(reordered[0].id, m2.id);
  assert.equal(reordered[0].load_order, 1);
});
