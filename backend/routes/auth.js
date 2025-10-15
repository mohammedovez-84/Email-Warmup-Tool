


const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const { authenticate, authRateLimiter } = require('../middleware/authMiddleware');
// 🔐 Registration and Email Verification
router.post('/signup', auth.signup);                  // ➤ User signs up (OTP sent to email)
router.post('/verify-email', auth.verifyEmail);       // ➤ User submits OTP to verify email
router.post('/resend-otp', auth.resendOTP);

// 🔐 Login and Two-Factor Auth (2FA)
router.post('/login', auth.login);                    // ➤ User login (may trigger 2FA)

// 2FA Setup with Authenticator App
router.post('/2fa/setup', authenticate, auth.setup2FA);     // Step 1 → Generate QR
router.post('/2fa/enable', authenticate, auth.enable2FA);   // Step 2 → Confirm token & enable
router.post('/2fa/disable', authenticate, auth.disable2FA); // Disable 2FA
router.post('/2fa/verify', authenticate, auth.verify2FA);


// (Optional: Email OTP fallback)
router.post('/2fa/send-otp', auth.sendLoginOTP);      // ➤ Email OTP for login (instead of app)

// 🔑 Password Reset Flow
router.post('/forgot-password', auth.forgotPassword); // ➤ Sends OTP to email for password reset
router.post('/verify-reset-otp', auth.verifyResetOtp);// ➤ Verifies OTP before resetting password
router.post('/reset-password', auth.resetPassword);   // ➤ Sets a new password

module.exports = router;
