const express = require('express');
const router = express.Router();
const accountController = require('../../controllers/auth/SmtpImapController');
const { authenticate } = require('../../middleware/authMiddleware');
// Add account
router.post('/account', authenticate, accountController.addAccount);

// Get accounts
router.get('/account', accountController.getAccount);

// Test SMTP
router.post('/account/test-smtp', accountController.testSmtp);

// Test IMAP
router.post('/account/test-imap', accountController.testImap);

router.put('/account/status', accountController.updateStatus);

module.exports = router;