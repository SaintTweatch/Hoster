'use strict';

const express = require('express');
const ctrl = require('../controllers/presetsController');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(ctrl.list));
router.post('/', wrap(ctrl.create));
router.delete('/:id', wrap(ctrl.remove));

module.exports = router;
