'use strict';

const express = require('express');
const ctrl = require('../controllers/settingsController');

const router = express.Router();

router.get('/', ctrl.getSettings);
router.put('/steam', ctrl.updateSteam);
router.post('/steam/test-login', ctrl.testLogin);
router.post('/steam/guard', ctrl.submitGuard);
router.post('/steam/cancel', ctrl.cancel);

module.exports = router;
