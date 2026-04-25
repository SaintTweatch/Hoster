'use strict';

const express = require('express');
const configService = require('../services/configService');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/defaults', wrap((_req, res) => res.json(configService.DEFAULT_CONFIG)));
router.post('/render', wrap((req, res) => {
  configService.validateConfig(req.body || {});
  res.type('text/plain').send(configService.renderServerDZ(req.body || {}));
}));

module.exports = router;
