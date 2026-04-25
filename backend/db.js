'use strict';

const Database = require('better-sqlite3');
const fs = require('fs-extra');
const path = require('path');
const paths = require('./utils/paths');
const logger = require('./utils/logger');

let db = null;

function init() {
  if (db) return db;

  fs.ensureDirSync(path.dirname(paths.DB_FILE));
  db = new Database(paths.DB_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  applyMigrations(db);
  logger.info('SQLite ready at ' + paths.DB_FILE);
  return db;
}

function get() {
  if (!db) init();
  return db;
}

function applyMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      install_path TEXT NOT NULL,
      executable TEXT,
      port INTEGER NOT NULL DEFAULT 2302,
      query_port INTEGER NOT NULL DEFAULT 27016,
      profile_dir TEXT,
      branch TEXT NOT NULL DEFAULT 'public',
      experimental INTEGER NOT NULL DEFAULT 0,
      auto_start INTEGER NOT NULL DEFAULT 0,
      auto_restart INTEGER NOT NULL DEFAULT 1,
      restart_schedule TEXT,
      cpu_count INTEGER,
      extra_params TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS server_mods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      workshop_id TEXT NOT NULL,
      name TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      load_order INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'client',
      installed INTEGER NOT NULL DEFAULT 0,
      installed_path TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(server_id, workshop_id, kind),
      FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS server_configs (
      server_id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT,
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_events_server_created
      ON events(server_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      encrypted INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  database.prepare('INSERT OR IGNORE INTO schema_meta (key, value) VALUES (?, ?)').run('version', '2');
}

function recordEvent(serverId, kind, message) {
  try {
    get()
      .prepare('INSERT INTO events (server_id, kind, message) VALUES (?, ?, ?)')
      .run(serverId || null, String(kind), String(message || ''));
  } catch (err) {
    logger.error('Failed to record event: ' + err.message);
  }
}

module.exports = {
  init,
  get,
  recordEvent,
};
