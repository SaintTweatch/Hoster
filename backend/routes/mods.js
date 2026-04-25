'use strict';

const express = require('express');
const ctrl = require('../controllers/modsController');

const router = express.Router({ mergeParams: true });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/:serverId', wrap(ctrl.list));
router.post('/:serverId', wrap(ctrl.add));
router.patch('/:serverId/order', wrap(ctrl.reorder));
router.patch('/:serverId/:modId', wrap(ctrl.update));
router.delete('/:serverId/:modId', wrap(ctrl.remove));
router.post('/:serverId/:modId/install', wrap(ctrl.install));

module.exports = router;
