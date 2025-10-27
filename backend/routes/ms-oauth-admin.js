const express = require('express');
const passport = require('passport');
const EmailPool = require('../models/EmailPool'); // Import EmailPool model

const router = express.Router();

router.get('/microsoft', (req, res, next) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).send('Missing userId');

    passport.authenticate('microsoft', {
        prompt: 'select_account',
        scope: ['openid', 'profile', 'offline_access', 'user.read', 'Mail.Read', 'Mail.Send'], // Added email scopes
        state: userId,
        tenant: 'common'
    })(req, res, next);
});

router.get('/microsoft/callback',
    passport.authenticate('microsoft', {
        failureRedirect: 'http://localhost:5173/superadmin/dashboard',
        session: false
    }),
    async (req, res) => {
        try {
            console.log("Microsoft user data:", req.user);

            const refreshToken = req.user?._refreshToken;
            const accessToken = req.user?._accessToken;
            const expiresIn = req.user?._expiresIn;
            const userId = req.query.state;

            // Extract user info from Microsoft profile
            const userProfile = req.user;
            const email = userProfile.mail || userProfile.userPrincipalName;
            const displayName = userProfile.displayName;
            const microsoftId = userProfile.id;

            if (!email) {
                throw new Error('No email found in Microsoft profile');
            }

            // Create or update EmailPool entry directly
            const [emailPoolAccount, created] = await EmailPool.upsert({
                email: email,
                displayName: displayName,
                providerType: 'MICROSOFT',
                microsoftId: microsoftId,
                accessToken: accessToken,
                refreshToken: refreshToken,
                tokenExpiresAt: new Date(Date.now() + (expiresIn * 1000)),
                isActive: true
            }, {
                where: { email: email }
            });

            console.log(`${created ? '✅ Created' : '🔄 Updated'} EmailPool account: ${email}`);

            // Optional: Also save to MicrosoftUser table if you still need it
            // await saveMicrosoftUser(req.user, refreshToken, accessToken, expiresIn, userId);

            res.redirect('http://localhost:5173/superadmin/dashboard?success=true&email=' + encodeURIComponent(email));
        } catch (err) {
            console.error('[ERROR] Saving to EmailPool:', err.message);
            res.redirect('http://localhost:5173/superadmin/dashboard?error=auth_failed');
        }
    }
);

module.exports = router;