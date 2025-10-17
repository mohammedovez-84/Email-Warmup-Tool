const express = require('express');
const passport = require('passport');
const { saveMicrosoftUser } = require('../controllers/microsoftController');

const router = express.Router();

router.get('/microsoft', (req, res, next) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).send('Missing userId');

    passport.authenticate('microsoft', {
        prompt: 'select_account',
        scope: ['openid', 'profile', 'offline_access', 'user.read'],
        state: userId, // 👈 goes to callback
    })(req, res, next);
});

router.get('/microsoft/callback',
    passport.authenticate('microsoft', {
        failureRedirect: 'http://localhost:5173/dashboard',
        session: false
    }),
    async (req, res) => {
        try {

            // console.log("user: ", req.user);

            const refreshToken = req.user?._refreshToken;
            const accessToken = req.user?._accessToken;
            const expiresIn = req.user?._expiresIn;
            const userId = req.query.state;
            await saveMicrosoftUser(req.user, refreshToken, accessToken, expiresIn, userId);


            res.redirect('http://localhost:5173/dashboard');
        } catch (err) {
            console.error('[ERROR] Saving Microsoft user:', err.message);
            res.redirect('http://localhost:5173/dashboard');
        }
    }
);

module.exports = router;