// routes/users.js
const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user/userController');
const { authenticate, authRateLimiter } = require('../../middleware/authMiddleware');
const { updatePassword } = require("../../controllers/auth/authController");




router.get('/me', authenticate, userController.getProfile);

router.put('/me', authenticate, userController.updateProfile);

router.delete('/me', authenticate, userController.deleteAccount);

router.get('/me', authenticate, authRateLimiter, userController.getProfile);

router.put("/password", authenticate, updatePassword);

module.exports = router;
