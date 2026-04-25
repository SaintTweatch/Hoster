'use strict';

const fs = require('fs');
const path = require('path');
const paths = require('./paths');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const CURRENT_LEVEL = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;

function ensureLogStream() {
  try {
    if (!fs.existsSync(paths.LOGS_DIR)) {
      fs.mkdirSync(paths.LOGS_DIR, { recursive: true });
    }
    const file = path.join(paths.LOGS_DIR, 'manager.log');
    return fs.createWriteStream(file, { flags: 'a' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to open log file', err);
    return null;
  }
}

const stream = ensureLogStream();

function writeLine(level, msg) {
  if (LEVELS[level] < CURRENT_LEVEL) return;
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${msg}`;
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](line);
  if (stream) {
    try {
      stream.write(line + '\n');
    } catch (_) {
      // ignore
    }
  }
}

module.exports = {
  debug: (msg) => writeLine('debug', String(msg)),
  info: (msg) => writeLine('info', String(msg)),
  warn: (msg) => writeLine('warn', String(msg)),
  error: (msg) => writeLine('error', String(msg)),
};
