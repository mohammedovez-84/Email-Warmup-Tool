// const express = require('express');
// const router = express.Router();
// const dashboardController = require('../controllers/dashboardController');

// // Fetch dashboard data
// router.get('/data', dashboardController.getDashboardData);


// // Delete a specific record by email
// router.delete('/data/:email', dashboardController.deleteByEmail);


// module.exports = router;




const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/authMiddleware');

// GET dashboard data
router.get('/data', authenticate, dashboardController.getDashboardData);

// DELETE account by email
router.delete('/data/:email', authenticate, dashboardController.deleteByEmail);

// // Delete all dashboard data
// router.delete('/data', dashboardController.deleteDashboardData);

module.exports = router;

