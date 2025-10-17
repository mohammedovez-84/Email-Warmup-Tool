const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const MicrosoftUser = require('../models/MicrosoftUser');
const { getAuthUrl, getTokenFromCode } = require('../controllers/microsoftOAuth');

const REDIRECT_URI = process.env.MS_REDIRECT_URL;

// 1️⃣ Redirect user to Microsoft login
router.get('/login', (req, res) => {
  const authUrl = getAuthUrl(REDIRECT_URI);
  console.log('Redirecting to Microsoft login:', authUrl);
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  console.log('Callback received. Query params:', req.query);
  console.log('Full URL:', req.originalUrl);

  const code = req.query.code;
  const error = req.query.error;
  const errorDescription = req.query.error_description;

  // Handle OAuth errors from Microsoft
  if (error) {
    console.error('Microsoft OAuth error:', error, errorDescription);
    return res.status(400).send(`OAuth Error: ${error} - ${errorDescription}`);
  }

  if (!code) {
    console.error('No authorization code received');
    console.log('Available query parameters:', Object.keys(req.query));
    console.log('Full URL:', req.protocol + '://' + req.get('host') + req.originalUrl);
    return res.status(400).send('Authorization code missing. Please try again.');
  }

  try {
    // Exchange code for tokens
    const token = await getTokenFromCode(REDIRECT_URI, code);
    console.log('Token received successfully');

    // Get user profile from Microsoft Graph
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      throw new Error(`Graph API error: ${profileResponse.status} - ${errorText}`);
    }

    const profile = await profileResponse.json();
    console.log('User profile:', profile);

    if (!profile || !profile.id) {
      return res.status(500).send('Failed to get Microsoft user profile');
    }

    // Save or update Microsoft user
    await MicrosoftUser.upsert({
      name: profile.displayName || null,
      email: profile.userPrincipalName || null,
      microsoft_id: profile.id,
      refresh_token: token.refresh_token,
      access_token: token.access_token,
      expires_at: Date.now() + token.expires_in * 1000,
      user_id: req.user?.id || 1, // You'll want to fix this - see note below
      warmupStatus: 'paused',
      startEmailsPerDay: 3,
      increaseEmailsPerDay: 3,
      maxEmailsPerDay: 25,
      replyRate: 1.0,
      warmupDayCount: 0,
      roundRobinIndexMicrosoft: 0
    });

    res.send(`
      <html>
        <body>
          <h2>Microsoft account connected successfully!</h2>
          <p>Email: ${profile.userPrincipalName}</p>
          <p>Name: ${profile.displayName}</p>
          <p>You can close this window and return to the app.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send(`Authentication failed: ${err.message}`);
  }
});

module.exports = router;