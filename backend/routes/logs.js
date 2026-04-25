'use strict';

const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const paths = require('../utils/paths');
const logService = require('../services/logService');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Tail in-memory ring buffer for a server
router.get('/:serverId/tail', wrap((req, res) => {
  const lines = logService.tail(req.params.serverId, Number(req.query.limit) || 500);
  res.json({ lines });
}));

// Download the persisted console log file
router.get('/:serverId/file', wrap(async (req, res) => {
  const file = path.join(paths.LOGS_DIR, req.params.serverId, 'console.log');
  if (!await fs.pathExists(file)) return res.status(404).json({ error: 'No log file yet' });
  res.download(file);
}));

module.exports = router;
