const analyticsController = require('../../controllers/analytics/analytics-controller');
const mailExchangeController = require("../../controllers/mailexchange/index")
const express = require('express');
const router = express.Router();

// Dashboard overview
router.get('/dashboard', analyticsController.getAnalytics);
router.get('/overview', analyticsController.getSimpleMetrics);
router.get('/daily-performance', analyticsController.getDailyPerformance);
router.get('/bounce-analysis', analyticsController.getBounceAnalysis);

// Detailed analytics (commented out but ready for implementation)
// router.get('/delivery', analyticsController.getDeliveryAnalytics);
// router.get('/engagement', analyticsController.getEngagementAnalytics);
// router.get('/replies', analyticsController.getReplyAnalytics);
// router.get('/spam-bounce', analyticsController.getSpamBounceAnalytics);
// router.get('/warmup-progress', analyticsController.getWarmupProgress);

router.get('/mail-exchanges', mailExchangeController.getAllMailExchanges);
router.get('/email-threads', mailExchangeController.getEmailThreads);

module.exports = router;