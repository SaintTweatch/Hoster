'use strict';

const NAME_RE = /^[A-Za-z0-9 _\-\.]{1,64}$/;
const ID_RE = /^[A-Za-z0-9_\-]{1,64}$/;
const WORKSHOP_ID_RE = /^[0-9]{6,15}$/;
const PORT_RE = /^[0-9]{1,5}$/;

function assert(cond, msg, status = 400) {
  if (!cond) {
    const err = new Error(msg);
    err.status = status;
    throw err;
  }
}

function isValidName(value) {
  return typeof value === 'string' && NAME_RE.test(value);
}

function isValidId(value) {
  return typeof value === 'string' && ID_RE.test(value);
}

function isValidWorkshopId(value) {
  return typeof value === 'string' && WORKSHOP_ID_RE.test(value);
}

function isValidPort(value) {
  if (value === '' || value == null) return false;
  if (!PORT_RE.test(String(value))) return false;
  const n = Number(value);
  return n > 0 && n < 65536;
}

/**
 * Sanitize a string to a value safe for embedding in serverDZ.cfg quoted strings.
 * @param {string} value
 */
function sanitizeCfgString(value) {
  return String(value == null ? '' : value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, '\\"');
}

/**
 * Sanitize a hostname/identifier value for use in folder names.
 * @param {string} value
 */
function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'server';
}

/**
 * Reject argv tokens with shell metacharacters; we always pass argv arrays
 * to child_process.spawn (no shell), but be paranoid for fallbacks.
 *
 * @param {string} arg
 */
function isSafeShellArg(arg) {
  return typeof arg === 'string' && !/[`$;&|<>"'\\\n\r]/.test(arg);
}

module.exports = {
  assert,
  isValidName,
  isValidId,
  isValidWorkshopId,
  isValidPort,
  sanitizeCfgString,
  slugify,
  isSafeShellArg,
};
