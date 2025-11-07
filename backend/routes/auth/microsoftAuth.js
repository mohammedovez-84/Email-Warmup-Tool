const express = require('express');
const router = express.Router();
const axios = require('axios');
const EmailPool = require('../../models/EmailPool');
const { getTokenFromCode } = require('../../controllers/auth/microsoftOAuth');

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

    // Calculate proper expiry (convert to BIGINT timestamp)
    const tokenExpiry = Date.now() + (token.expires_in * 1000);

    console.log('🔐 Token details:', {
      access_token: token.access_token ? `PRESENT (${token.access_token.length} chars)` : 'MISSING',
      refresh_token: token.refresh_token ? `PRESENT (${token.refresh_token.length} chars)` : 'MISSING',
      expires_in: token.expires_in,
      token_expiry: new Date(tokenExpiry).toISOString()
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

    // Determine account type and map to EmailPool providerType
    let providerType = 'OUTLOOK_PERSONAL';
    let isOrganizational = false;

    // Check if it's an organizational account
    if (email.endsWith('.onmicrosoft.com') ||
      (email.includes('@') && !email.endsWith('@outlook.com') &&
        !email.endsWith('@hotmail.com') && !email.endsWith('@live.com'))) {
      isOrganizational = true;
      providerType = 'MICROSOFT_ORGANIZATIONAL';
    }

    console.log(`Detected account type: ${providerType} for email: ${email}`);

    // 🚨 CRITICAL: Save to EmailPool table with correct field names
    const [emailPoolAccount, created] = await EmailPool.upsert({
      email: email,
      providerType: providerType,
      // OAuth tokens - using correct field names from EmailPool model
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: tokenExpiry, // Using BIGINT timestamp
      // Account status - using EmailPool fields
      isActive: true,
      // User info from profile
      display_name: profile.displayName || email.split('@')[0],
      // Note: user_id field doesn't exist in EmailPool model, so we'll store it in a compatible way
      // If you need to store user_id, you might need to add it to the EmailPool model
    }, {
      returning: true
    });

    console.log(`✅ EmailPool account ${created ? 'created' : 'updated'}: ${email}`);
    console.log(`📁 Saved to: EmailPool table`);
    console.log(`🔐 Token saved with expiry: ${new Date(tokenExpiry).toISOString()}`);

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