require('dotenv').config();
const { AuthorizationCode } = require('simple-oauth2');

const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing required Microsoft OAuth environment variables');
  throw new Error('Microsoft OAuth configuration is incomplete');
}

const config = {
  client: {
    id: CLIENT_ID,
    secret: CLIENT_SECRET,
  },
  auth: {
    tokenHost: `https://login.microsoftonline.com`,
    authorizePath: `/common/oauth2/v2.0/authorize`,
    tokenPath: `/common/oauth2/v2.0/token`,
  }
};

const client = new AuthorizationCode(config);

// Delegated permissions scopes
const scopes = [
  'openid',
  'profile',
  'offline_access',
  'User.Read',
  'Mail.Read',
  'Mail.Send',
  'Mail.ReadWrite'
];

function getAuthUrl(redirectUri) {
  try {
    const url = client.authorizeURL({
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      prompt: 'select_account'
    });
    console.log('Generated auth URL:', url);
    return url;
  } catch (error) {
    console.error('Error generating auth URL:', error);
    throw error;
  }
}

async function getTokenFromCode(redirectUri, code) {
  try {
    console.log('Exchanging code for token, redirectUri:', redirectUri);
    const tokenParams = {
      code,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
    };

    const accessToken = await client.getToken(tokenParams);
    console.log('✅ Token exchange successful');

    // Log token details for debugging
    console.log('🔐 Token details:', {
      has_access_token: !!accessToken.token.access_token,
      has_refresh_token: !!accessToken.token.refresh_token,
      expires_in: accessToken.token.expires_in,
      token_type: accessToken.token.token_type
    });

    return accessToken.token;
  } catch (error) {
    console.error('❌ Error exchanging code for token:', error);
    console.error('Error details:', error.message);
    throw error;
  }
}

// Add token refresh function
async function refreshOutlookToken(account) {
  try {
    console.log(`🔄 Refreshing token for: ${account.email}`);

    if (!account.refresh_token) {
      throw new Error('No refresh token available');
    }

    const tokenParams = {
      refresh_token: account.refresh_token,
      scope: scopes.join(' '),
      redirect_uri: process.env.MS_REDIRECT_URL2
    };

    const newToken = await client.getToken(tokenParams);

    console.log('✅ Token refresh successful');

    return {
      access_token: newToken.token.access_token,
      refresh_token: newToken.token.refresh_token || account.refresh_token, // Keep old if not provided
      expires_in: newToken.token.expires_in,
      token_expiry: new Date(Date.now() + (newToken.token.expires_in * 1000)).toISOString()
    };
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    throw error;
  }
}

module.exports = {
  getAuthUrl,
  getTokenFromCode,
  refreshOutlookToken
};