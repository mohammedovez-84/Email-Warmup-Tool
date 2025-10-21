const express = require('express');
const router = express.Router();
const warmupController = require('../controllers/warmupController');

// router.post('/start/:senderEmail', warmupController.startWarmup);

// router.post('/start', warmupController.startWarmupAll);


router.patch("/disconnect/:email", warmupController.disconnectMail)

router.put('/emails/:emailAddress/status', warmupController.toggleWarmupStatus);

module.exports = router;