const express = require('express');
const passport = require('passport');
require('../../config/google-strategy');
const router = express.Router();

// Step 1: Redirect to Google for consent
router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Step 2: Callback after Google authenticates user
router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful login — redirect to dashboard or token generation
        res.redirect('http://localhost:5173/superadmin/dashboard');
    }
);

// Optional: logout
router.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

module.exports = router;
