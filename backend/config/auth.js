const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');

// 🔐 Registration and Email Verification
router.post('/signup', auth.signup);                // ➤ User signs up (OTP sent to email)
router.post('/verify-email', auth.verifyEmail);         // ➤ User submits OTP to verify email
router.post('/resend-otp', auth.resendOTP);


// 🔐 Login and Two-Factor Auth (2FA)
router.post('/login', auth.login);                      // ➤ User login (may trigger 2FA)
router.post('/2fa/verify', auth.verify2FA);             // ➤ Verifies 2FA TOTP code
router.patch('/2fa/setup', auth.setup2FA);              // ➤ Setup 2FA (generates QR / secret)
router.patch('/2fa/disable', auth.disable2FA);          // ➤ Disable 2FA

// 🔑 Password Reset Flow
router.post('/forgot-password', auth.forgotPassword);   // ➤ Sends OTP to email for password reset
router.post('/verify-reset-otp', auth.verifyResetOtp);  // ➤ Verifies OTP before resetting password
router.post('/reset-password', auth.resetPassword);     // ➤ Sets a new password

module.exports = router;
