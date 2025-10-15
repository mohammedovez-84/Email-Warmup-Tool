const express = require('express');
const passport = require('passport');
const { saveMicrosoftUser } = require('../controllers/microsoftController');

const router = express.Router();

router.get('/microsoft', passport.authenticate('microsoft', {
    prompt: 'select_account',
    scope: ['openid', 'profile', 'offline_access', 'user.read']
}));


router.get('/microsoft/callback',
    passport.authenticate('microsoft', {
        failureRedirect: '/login-failed',
        session: false
    }),
    async (req, res) => {
        try {
            const refreshToken = req.user?._refreshToken;
            const accessToken = req.user?._accessToken;
            const expiresIn = req.user?._expiresIn;
            await saveMicrosoftUser(req.user, refreshToken, accessToken, expiresIn);


            res.redirect('http://localhost:5173/dashboard');
        } catch (err) {
            console.error('[ERROR] Saving Microsoft user:', err.message);
            res.redirect('/login-failed');
        }
    }
);

module.exports = router;