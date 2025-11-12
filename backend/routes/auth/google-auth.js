const express = require('express');
const passport = require('passport');
require('../../config/google-strategy');
const router = express.Router();

// Step 1: Redirect to Google for consent
router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account', })
);

router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        const { user, token } = req.user;

        const isNewUser = user.isNewUser || false;

        const redirectUrl = `http://localhost:5173/login?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(user))}&isNewUser=${isNewUser}`;
        res.redirect(redirectUrl);
    }
);



router.get('/logout', async (req, res) => {
    try {
        const { isGoogle } = req.user || {};

        // Destroy session for Passport
        req.logout(() => {
            req.session?.destroy?.();
        });

        // If user logged in with Google, revoke access token
        if (isGoogle) {
            try {
                await axios.get(
                    `https://accounts.google.com/o/oauth2/revoke?token=${googleAccessToken}`
                );
                console.log('🔒 Google session revoked successfully');
            } catch (err) {
                console.warn('⚠️ Google revoke failed:', err.message);
            }
        }

        res.redirect('http://localhost:5173/login');
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ success: false, message: 'Logout failed' });
    }
});

module.exports = router;
