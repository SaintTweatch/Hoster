'use strict';

const db = require('../db');
const validators = require('../utils/validators');

function list(_req, res) {
  const rows = db
    .get()
    .prepare('SELECT id, name, payload, created_at FROM presets ORDER BY name ASC')
    .all();
  res.json(rows.map((r) => ({ ...r, payload: safeJson(r.payload) })));
}

function safeJson(s) {
  try { return JSON.parse(s); } catch (_) { return null; }
}

function create(req, res) {
  const { name, payload } = req.body || {};
  validators.assert(validators.isValidName(name || ''), 'Invalid preset name');
  validators.assert(payload && typeof payload === 'object', 'payload must be an object');
  const json = JSON.stringify(payload);
  try {
    const info = db
      .get()
      .prepare('INSERT INTO presets (name, payload) VALUES (?, ?)')
      .run(name, json);
    res.status(201).json({ id: info.lastInsertRowid, name, payload });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      db.get().prepare('UPDATE presets SET payload = ? WHERE name = ?').run(json, name);
      res.json({ name, payload, replaced: true });
    } else {
      throw err;
    }
  }
}

function remove(req, res) {
  db.get().prepare('DELETE FROM presets WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
}

module.exports = { list, create, remove };
