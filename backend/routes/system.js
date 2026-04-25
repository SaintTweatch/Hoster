'use strict';

const express = require('express');
const ctrl = require('../controllers/systemController');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/info', wrap(ctrl.info));
router.post('/install-steamcmd', wrap(ctrl.installSteamCmd));

module.exports = router;
