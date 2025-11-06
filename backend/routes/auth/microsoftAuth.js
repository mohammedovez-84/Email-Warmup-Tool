const express = require('express');
const router = express.Router();
const axios = require('axios');
const MicrosoftUser = require('../../models/MicrosoftUser'); // 🚨 CHANGE THIS
const { getAuthUrl, getTokenFromCode } = require('../../controllers/auth/microsoftOAuth');

const REDIRECT_URI = process.env.MS_REDIRECT_URL2;

router.get('/login', (req, res) => {
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${process.env.MS_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(process.env.MS_REDIRECT_URL2)}` +
    `&scope=${encodeURIComponent('openid profile offline_access User.Read Mail.Read Mail.Send Mail.ReadWrite')}` +
    `&prompt=select_account`;

  console.log('Redirecting to Microsoft login:', authUrl);
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  console.log('Callback received. Query params:', req.query);
  console.log('Full URL:', req.originalUrl);

  const code = req.query.code;
  const error = req.query.error;
  const errorDescription = req.query.error_description;

  if (error) {
    console.error('Microsoft OAuth error:', error, errorDescription);
    return res.status(400).send(`OAuth Error: ${error} - ${errorDescription}`);
  }

  if (!code) {
    console.error('No authorization code received');
    return res.status(400).send('Authorization code missing. Please try again.');
  }

  try {
    // Exchange code for tokens
    const token = await getTokenFromCode(REDIRECT_URI, code);
    console.log('Token received successfully');

    // Calculate proper expiry
    const tokenExpiry = new Date(Date.now() + (token.expires_in * 1000)).toISOString();

    console.log('🔐 Token details:', {
      access_token: token.access_token ? `PRESENT (${token.access_token.length} chars)` : 'MISSING',
      refresh_token: token.refresh_token ? `PRESENT (${token.refresh_token.length} chars)` : 'MISSING',
      expires_in: token.expires_in,
      token_expiry: tokenExpiry
    });

    // Get user profile from Microsoft Graph
    const profileResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });

    const profile = profileResponse.data;
    console.log('User profile:', profile);

    if (!profile || (!profile.mail && !profile.userPrincipalName)) {
      return res.status(500).send('Failed to get Microsoft user profile with email');
    }

    const email = profile.mail || profile.userPrincipalName;

    // 🚨 CRITICAL: Determine account type correctly
    let provider = 'microsoft';
    let isOrganizational = false;

    // Check if it's an organizational account
    if (email.endsWith('.onmicrosoft.com') ||
      (email.includes('@') && !email.endsWith('@outlook.com') &&
        !email.endsWith('@hotmail.com') && !email.endsWith('@live.com'))) {
      isOrganizational = true;
      provider = 'microsoft_organizational';
    } else {
      provider = 'outlook_personal';
    }

    console.log(`Detected account type: ${provider} for email: ${email}`);

    // 🚨 CRITICAL: Save to MicrosoftUser table (NOT EmailPool)
    const [microsoftUser, created] = await MicrosoftUser.upsert({
      email: email,
      provider: provider,
      is_organizational: isOrganizational,
      // OAuth tokens
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expiry: tokenExpiry, // Use the correct field name for MicrosoftUser model
      // Account status
      is_connected: true,
      warmupStatus: 'inactive', // Default to inactive until user enables warmup
      // User info from profile
      display_name: profile.displayName || email.split('@')[0],
      user_id: profile.id
    }, {
      returning: true
    });

    console.log(`✅ Microsoft account ${created ? 'created' : 'updated'}: ${email}`);
    console.log(`📁 Saved to: MicrosoftUser table`);
    console.log(`🔐 Token saved with expiry: ${tokenExpiry}`);

    res.redirect('http://localhost:5173/superadmin/dashboard');

  } catch (err) {
    console.error('OAuth callback error:', err);

    const errorHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h2 style="color: #dc3545;">❌ Authentication Failed</h2>
          <p><strong>Error:</strong> ${err.message}</p>
          <p>Please try again or contact support.</p>
        </body>
      </html>
    `;

    res.status(500).send(errorHtml);
  }
});

module.exports = router;