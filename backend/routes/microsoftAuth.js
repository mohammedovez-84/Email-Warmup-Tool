const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const Account = require('../models/Account');
const { getAuthUrl, getTokenFromCode } = require('../controllers/microsoftOAuth');

const REDIRECT_URI = process.env.MS_REDIRECT_URL;

router.get('/login', (req, res) => {
  const authUrl = getAuthUrl(REDIRECT_URI);
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Authorization code missing');

  try {
    // Get tokens from Microsoft
    const token = await getTokenFromCode(REDIRECT_URI, code);

    // Fetch Microsoft user profile
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    const profile = await profileResponse.json();

    if (!profile || !profile.userPrincipalName) {
      return res.status(500).send('Failed to get Microsoft user profile');
    }

    // Upsert into accounts table
    await Account.upsert({
      email: profile.userPrincipalName,
      type: 'microsoft',
      smtpHost: 'smtp.office365.com',
      smtpPort: 587,
      smtpUser: profile.userPrincipalName,
      smtpPass: null,
      imapHost: 'outlook.office365.com',
      imapPort: 993,
      imapUser: profile.userPrincipalName,
      imapPass: null,
      refreshToken: token.refresh_token,
      accessToken: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000
    });

    res.send(`Microsoft account (${profile.userPrincipalName}) connected successfully.`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send('Authentication failed');
  }
});

module.exports = router;
