'use strict';

const settings = require('../services/settingsService');
const steam = require('../services/steamcmdService');
const logger = require('../utils/logger');

function getSettings(req, res) {
  res.json(settings.getPublicSettings());
}

function updateSteam(req, res) {
  const { username, password, clearPassword } = req.body || {};
  if (username !== undefined) {
    if (typeof username !== 'string' || username.length > 64) {
      return res.status(400).json({ error: 'Invalid username' });
    }
    settings.set('steam.username', username.trim());
  }
  if (clearPassword) {
    settings.clearPassword();
  } else if (password !== undefined && password !== '') {
    if (typeof password !== 'string' || password.length > 256) {
      return res.status(400).json({ error: 'Invalid password' });
    }
    settings.set('steam.password', password);
  }
  res.json(settings.getPublicSettings());
}

async function testLogin(req, res) {
  try {
    const result = await steam.testLogin();
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error('Steam test login failed: ' + err.message);
    res.status(err.status || 500).json({ error: err.message, code: err.code || 'STEAM_LOGIN_FAILED' });
  }
}

function submitGuard(req, res) {
  const { code } = req.body || {};
  if (typeof code !== 'string' || !/^[0-9A-Za-z]{4,8}$/.test(code.trim())) {
    return res.status(400).json({ error: 'Invalid Steam Guard code (expected 4-8 alphanumeric characters).' });
  }
  try {
    steam.sendInput(code.trim());
    res.json({ ok: true });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
}

function cancel(req, res) {
  steam.cancel();
  res.json({ ok: true });
}

module.exports = {
  getSettings,
  updateSteam,
  testLogin,
  submitGuard,
  cancel,
};
