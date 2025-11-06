const express = require("express");
const router = express.Router();
const {
    checkEmailAuthRecords
} = require("../../controllers/dns/auth-checker");
const { authenticate } = require('../../middleware/authMiddleware');
router.post("/check-auth", authenticate, checkEmailAuthRecords);

module.exports = router;
