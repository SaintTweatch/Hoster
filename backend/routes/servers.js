'use strict';

const express = require('express');
const ctrl = require('../controllers/serversController');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(ctrl.list));
router.post('/', wrap(ctrl.create));
router.get('/:id', wrap(ctrl.get));
router.patch('/:id', wrap(ctrl.update));
router.delete('/:id', wrap(ctrl.remove));

router.post('/:id/start', wrap(ctrl.start));
router.post('/:id/stop', wrap(ctrl.stop));
router.post('/:id/restart', wrap(ctrl.restart));
router.post('/:id/install', wrap(ctrl.install));

router.get('/:id/config', wrap(ctrl.getConfig));
router.put('/:id/config', wrap(ctrl.saveConfig));

router.get('/:id/logs', wrap(ctrl.getLogs));
router.get('/:id/installed-mods', wrap(ctrl.listInstalledMods));
router.get('/:id/file', wrap(ctrl.readFile));

module.exports = router;
