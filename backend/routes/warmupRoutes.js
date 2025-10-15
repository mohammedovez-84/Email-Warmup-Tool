const express = require('express');
const router = express.Router();
const warmupController = require('../controllers/warmupController');

// router.post('/start/:senderEmail', warmupController.startWarmup);

// router.post('/start', warmupController.startWarmupAll);

router.put('/emails/:emailAddress/status', warmupController.toggleWarmupStatus);

module.exports = router;