'use strict';

const express = require('express');
const steam = require('../services/steamcmdService');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/status', wrap(async (_req, res) => {
  const installed = await steam.isInstalled();
  res.json({ installed, binary: steam.steamcmdBinary() });
}));

router.post('/install', wrap(async (_req, res) => {
  res.status(202).json({ accepted: true });
  steam.ensureSteamcmd().catch(() => {});
}));

module.exports = router;
