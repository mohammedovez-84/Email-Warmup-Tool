const express = require('express');
const router = express.Router();

const {
    testSMTP,
    testIMAP,
    addGoogleUser,
} = require('../controllers/googlecontroller');
const { authenticate } = require('../middleware/authMiddleware');
// Match frontend route expectations
router.post('/accounts/test-smtp', testSMTP);
router.post('/accounts/test-imap', testIMAP);
router.post('/accounts/connect-google', authenticate, addGoogleUser);



module.exports = router;