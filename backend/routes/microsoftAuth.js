const express = require('express');
const router = express.Router();
const axios = require('axios');
const EmailPool = require('../models/EmailPool');
const { getAuthUrl, getTokenFromCode } = require('../controllers/microsoftOAuth');

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

    // Calculate proper expiry with CORRECT field name
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

    // Determine provider type based on email domain
    const email = profile.mail || profile.userPrincipalName;
    let providerType = 'OUTLOOK_PERSONAL';
    let emailConfig = {};

    // Check if it's an organizational account
    if (email.endsWith('.onmicrosoft.com') ||
      (email.includes('@') && !email.endsWith('@outlook.com') &&
        !email.endsWith('@hotmail.com') && !email.endsWith('@live.com'))) {
      providerType = 'MICROSOFT_ORGANIZATIONAL';

      emailConfig = {
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpUser: email,
        smtpSecure: false,
        imapHost: 'outlook.office365.com',
        imapPort: 993,
        imapUser: email,
        imapSecure: true,
        use_graph_api: false
      };
    } else {
      // Personal Outlook account settings
      providerType = 'OUTLOOK_PERSONAL';
      emailConfig = {
        smtpHost: 'smtp-mail.outlook.com',
        smtpPort: 587,
        smtpUser: email,
        smtpSecure: false,
        imapHost: 'outlook.office365.com',
        imapPort: 993,
        imapUser: email,
        imapSecure: true,
        use_graph_api: true
      };
    }

    console.log(`Detected provider type: ${providerType} for email: ${email}`);

    // Save or update in EmailPool - ONLY use existing database columns
    await EmailPool.upsert({
      email: email,
      providerType: providerType,
      // OAuth tokens - ONLY use columns that exist in your database
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: Date.now() + (token.expires_in * 1000), // ← Only this expiry field exists
      // Remove token_expiry since it doesn't exist in your database
      // Use the appropriate configuration
      ...emailConfig,
      isActive: true,
      roundRobinIndex: 0
    });

    console.log(`✅ Account saved with tokens - using token_expires_at only`);

    console.log(`✅ Account saved successfully: ${email}`);

    res.redirect('http://localhost:5173/superadmin/dashboard');
  } catch (err) {
    console.error('OAuth callback error:', err);

    const errorHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h2 style="color: #dc3545;">❌ Authentication Failed</h2>
          <p><strong>Error:</strong> ${err.message}</p>
          ${err.message.includes('IMAP') || err.message.includes('SMTP') ? `
          <div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; margin-top: 15px;">
            <h3>💡 Solution for Personal Outlook Accounts:</h3>
            <p>Personal Outlook accounts may have limited IMAP/SMTP access. Try these steps:</p>
            <ol>
              <li>Login to Outlook.com and go to Settings → Mail → Sync email</li>
              <li>Enable "Let devices and apps use POP" and "Let devices and apps use IMAP"</li>
              <li>Ensure your account has 2FA disabled or use app-specific settings</li>
            </ol>
          </div>
          ` : ''}
          <p>Please try again or contact support.</p>
        </body>
      </html>
    `;

    res.status(500).send(errorHtml);
  }
});



module.exports = router;