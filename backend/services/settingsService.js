'use strict';

/**
 * Application-wide settings (key/value store) with optional encryption for
 * sensitive fields (like Steam credentials). Values are encrypted with
 * AES-256-GCM using a key derived from the SESSION_SECRET env var, so the
 * .env file effectively guards the credentials. Compromise of the .env file
 * is equivalent to compromise of the credentials, which is the same threat
 * model SteamCMD itself exposes.
 */

const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');

const ALG = 'aes-256-gcm';
const KDF_SALT = 'dayz-manager:settings:v1';

function getKey() {
  const secret = process.env.SESSION_SECRET || 'dayz-manager-default-session-secret-change-me';
  return crypto.scryptSync(secret, KDF_SALT, 32);
}

function encrypt(plain) {
  if (plain == null || plain === '') return '';
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

function decrypt(payload) {
  if (!payload) return '';
  const parts = String(payload).split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted setting payload');
  }
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const enc = Buffer.from(parts[3], 'base64');
  const decipher = crypto.createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

const SENSITIVE_KEYS = new Set(['steam.password']);

function setRaw(key, value, encrypted = false) {
  const stmt = db.get().prepare(`
    INSERT INTO app_settings (key, value, encrypted, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      encrypted = excluded.encrypted,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(key, value, encrypted ? 1 : 0);
}

function getRaw(key) {
  const row = db.get().prepare('SELECT value, encrypted FROM app_settings WHERE key = ?').get(key);
  return row || null;
}

function set(key, value) {
  if (SENSITIVE_KEYS.has(key)) {
    setRaw(key, value ? encrypt(value) : '', true);
  } else {
    setRaw(key, value == null ? '' : String(value), false);
  }
}

function get(key, fallback = '') {
  const row = getRaw(key);
  if (!row) return fallback;
  if (row.encrypted) {
    if (!row.value) return fallback;
    try {
      return decrypt(row.value);
    } catch (err) {
      logger.error(`Failed to decrypt setting ${key}: ${err.message}. Returning fallback.`);
      return fallback;
    }
  }
  return row.value == null || row.value === '' ? fallback : row.value;
}

function setMany(obj) {
  const tx = db.get().transaction((entries) => {
    for (const [k, v] of entries) set(k, v);
  });
  tx(Object.entries(obj));
}

/**
 * Public-facing snapshot of settings (sensitive fields are NEVER returned
 * in plaintext; only a `hasPassword` boolean is exposed).
 */
function getPublicSettings() {
  return {
    steam: {
      username: get('steam.username', ''),
      hasPassword: Boolean(get('steam.password', '')),
      lastLoginAt: get('steam.last_login_at', ''),
      lastLoginOk: get('steam.last_login_ok', '') === '1',
    },
  };
}

function clearPassword() {
  set('steam.password', '');
}

module.exports = {
  set,
  get,
  setMany,
  getPublicSettings,
  clearPassword,
  encrypt,
  decrypt,
};
