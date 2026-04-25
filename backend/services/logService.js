'use strict';

const fs = require('fs-extra');
const path = require('path');
const paths = require('../utils/paths');
const { broadcast, TOPICS } = require('../websocket/wsServer');

const RING_SIZE = 2000;
const buffers = new Map(); // serverId -> { lines: string[], cursor: number }
const writers = new Map(); // serverId -> WriteStream

function ensureBuffer(serverId) {
  if (!buffers.has(serverId)) {
    buffers.set(serverId, { lines: new Array(RING_SIZE), cursor: 0, total: 0 });
  }
  return buffers.get(serverId);
}

function ensureWriter(serverId) {
  if (writers.has(serverId)) return writers.get(serverId);
  const dir = path.join(paths.LOGS_DIR, serverId);
  fs.ensureDirSync(dir);
  const file = path.join(dir, 'console.log');
  const stream = fs.createWriteStream(file, { flags: 'a' });
  writers.set(serverId, stream);
  return stream;
}

/**
 * Append a chunk of console output for a server, broadcast via WS, persist to file.
 *
 * @param {string} serverId
 * @param {string} chunk
 * @param {'stdout'|'stderr'|'system'} stream
 */
function append(serverId, chunk, stream = 'stdout') {
  if (!chunk) return;
  const lines = String(chunk).split(/\r?\n/);
  const buf = ensureBuffer(serverId);
  const out = ensureWriter(serverId);
  const ts = new Date().toISOString();

  for (const raw of lines) {
    if (!raw && raw !== '') continue;
    if (raw.length === 0) continue;
    const entry = { ts, stream, line: raw };
    buf.lines[buf.cursor] = entry;
    buf.cursor = (buf.cursor + 1) % RING_SIZE;
    buf.total += 1;
    try {
      out.write(`${ts} [${stream}] ${raw}\n`);
    } catch (_) { /* ignore */ }
    broadcast(TOPICS.SERVER_LOG, { serverId, ...entry });
  }
}

function tail(serverId, limit = 500) {
  const buf = buffers.get(serverId);
  if (!buf) return [];
  const result = [];
  const total = Math.min(buf.total, RING_SIZE);
  const start = (buf.cursor - total + RING_SIZE) % RING_SIZE;
  for (let i = 0; i < total; i++) {
    const e = buf.lines[(start + i) % RING_SIZE];
    if (e) result.push(e);
  }
  return result.slice(-Math.max(1, Math.min(limit, RING_SIZE)));
}

function clear(serverId) {
  buffers.delete(serverId);
  const w = writers.get(serverId);
  if (w) {
    try { w.end(); } catch (_) {}
    writers.delete(serverId);
  }
}

module.exports = { append, tail, clear };
