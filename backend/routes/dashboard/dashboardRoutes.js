




const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/dashboard/dashboardController');
const { authenticate } = require('../../middleware/authMiddleware');

// GET dashboard data
router.get('/data', authenticate, dashboardController.getDashboardData);


router.patch('/update/user/:email', authenticate, dashboardController.updateGoogleUserOnboard)



module.exports = router;

