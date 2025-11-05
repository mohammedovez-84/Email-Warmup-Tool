const analyticsController = require('../../controllers/analytics/analytics-controller');
const express = require('express');
const router = express.Router();


// Dashboard overview
router.get('/dashboard', analyticsController.getSimpleMetrics);
router.get('/overview', analyticsController.getAnalytics)

// // Detailed analytics
// router.get('/delivery', analyticsController.getDeliveryAnalytics);
// router.get('/engagement', analyticsController.getEngagementAnalytics);
// router.get('/replies', analyticsController.getReplyAnalytics);
// router.get('/spam-bounce', analyticsController.getSpamBounceAnalytics);
// router.get('/warmup-progress', analyticsController.getWarmupProgress);

module.exports = router;