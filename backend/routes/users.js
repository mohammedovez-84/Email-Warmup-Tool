// routes/users.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authRateLimiter } = require('../middleware/authMiddleware');
const { updatePassword } = require("../controllers/authController");

// =======================
// 🔐 Authenticated Routes
// =======================

// 👤 Get the logged-in user's profile
router.get('/me', authenticate, userController.getProfile);

// ✏️ Update the logged-in user's profile
router.put('/me', authenticate, userController.updateProfile);

// 🗑️ Delete the logged-in user's account
router.delete('/me', authenticate, userController.deleteAccount);

// 👥 Admin: Get all users (can add role-check middleware here)
router.get('/me', authenticate, authRateLimiter, userController.getProfile);


// reset password
router.put("/password", authenticate, updatePassword);

module.exports = router;
