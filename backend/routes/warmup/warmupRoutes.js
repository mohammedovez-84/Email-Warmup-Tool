const express = require('express');
const router = express.Router();
const warmupController = require('../../controllers/warmup/warmupController');
const { authenticate } = require('../../middleware/authMiddleware');
// router.post('/start/:senderEmail', warmupController.startWarmup);

// router.post('/start', warmupController.startWarmupAll);



router.get("/:email", authenticate, warmupController.fetchSingleMailData)

router.get('/report/:email', warmupController.fetchSingleMailReport);

router.put('/emails/:emailAddress/status', warmupController.toggleWarmupStatus);

router.patch("/disconnect_or_reconnect/:email", authenticate, warmupController.disconnectReconnectMail)

router.patch("/update/settings/:email", authenticate, warmupController.updateMailSettings)

router.delete("/delete/:email", authenticate, warmupController.deleteMail)


module.exports = router;