require('dotenv').config();
const { AuthorizationCode } = require('simple-oauth2');
const https = require('https'); // Add for custom agent

const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing required Microsoft OAuth environment variables');
  throw new Error('Microsoft OAuth configuration is incomplete');
}

// Create custom HTTPS agent to handle timeouts and force IPv4
const customAgent = new https.Agent({
  keepAlive: true,
  timeout: 30000,
  rejectUnauthorized: true,
  // Force IPv4 to avoid IPv6 issues
  family: 4
});

const config = {
  client: {
    id: CLIENT_ID,
    secret: CLIENT_SECRET,
  },
  auth: {
    tokenHost: 'https://login.microsoftonline.com',
    authorizePath: '/common/oauth2/v2.0/authorize',
    tokenPath: '/common/oauth2/v2.0/token',
  },
  http: {
    // 🚨 CRITICAL: Add custom agent and timeout configuration
    agent: customAgent,
    timeout: 30000
  },
  options: {
    authorizationMethod: 'body',
    bodyFormat: 'form'
  }
};

const client = new AuthorizationCode(config);

const scopes = [
  'openid',
  'profile',
  'offline_access',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/User.Read'
];

function getAuthUrl(redirectUri, email = null) {
  try {
    let url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${process.env.MS_CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes.join(' '))}` +
      `&prompt=consent`; // 🚨 CRITICAL

    if (email) {
      url += `&login_hint=${encodeURIComponent(email)}`;
    }

    console.log('🔐 Generated Microsoft auth URL with full Graph API scopes');
    return url;

  } catch (error) {
    console.error('❌ Error generating auth URL:', error);
    throw error;
  }
}

async function getTokenFromCode(redirectUri, code, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Exchanging code for token (attempt ${attempt}/${maxRetries})...`);

      const tokenParams = {
        code,
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
      };

      // Add timeout and retry logic
      const accessToken = await Promise.race([
        client.getToken(tokenParams),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        )
      ]);

      // 🚨 VALIDATE REFRESH TOKEN EXISTS
      if (!accessToken.token.refresh_token) {
        throw new Error('❌ No refresh token received - check offline_access scope');
      }

      console.log('✅ Token exchange successful with refresh token');

      // Log token details for debugging
      console.log('🔐 Token details:', {
        has_access_token: !!accessToken.token.access_token,
        has_refresh_token: !!accessToken.token.refresh_token,
        expires_in: accessToken.token.expires_in,
        token_type: accessToken.token.token_type,
        token_format: accessToken.token.access_token.includes('.') ? 'Valid JWT' : 'INVALID'
      });

      return accessToken.token;

    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);

      // Log detailed error information
      if (error.name === 'RequestError') {
        console.error('🔧 Network request error - possible DNS/firewall issue');
      } else if (error.name === 'StatusCodeError') {
        console.error('🔧 HTTP Status error:', error.statusCode);
      }

      if (attempt === maxRetries) {
        console.error('🔧 Final attempt failed. Error details:', {
          name: error.name,
          code: error.code,
          message: error.message
        });
        throw error;
      }

      // Wait before retry (exponential backoff)
      const delay = 1000 * attempt;
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Enhanced token refresh function with retry logic
async function refreshOutlookToken(account, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Refreshing token for: ${account.email} (attempt ${attempt}/${maxRetries})`);

      if (!account.refresh_token) {
        throw new Error('No refresh token available');
      }

      const tokenParams = {
        refresh_token: account.refresh_token,
        scope: scopes.join(' '),
        redirect_uri: process.env.MS_REDIRECT_URL2
      };

      const newToken = await Promise.race([
        client.getToken(tokenParams),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Refresh request timeout')), 30000)
        )
      ]);

      console.log('✅ Token refresh successful');

      return {
        access_token: newToken.token.access_token,
        refresh_token: newToken.token.refresh_token || account.refresh_token,
        expires_in: newToken.token.expires_in,
        token_expiry: new Date(Date.now() + (newToken.token.expires_in * 1000)).toISOString()
      };

    } catch (error) {
      console.error(`❌ Refresh attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        console.error('🔧 Final refresh attempt failed');
        throw error;
      }

      const delay = 1000 * attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Add a test function to verify connectivity
async function testMicrosoftConnection() {
  try {
    console.log('🔧 Testing connection to Microsoft login endpoint...');

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'login.microsoftonline.com',
        port: 443,
        path: '/common/oauth2/v2.0/token',
        method: 'HEAD',
        family: 4, // Force IPv4
        timeout: 10000
      }, (res) => {
        console.log(`🔧 Connection test: HTTP ${res.statusCode}`);
        resolve(res.statusCode === 405); // 405 Method Not Allowed is expected for HEAD to token endpoint
      });

      req.on('error', (err) => {
        console.error('🔧 Connection test failed:', err.message);
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Connection test timeout'));
      });

      req.end();
    });
  } catch (error) {
    console.error('🔧 Connection test error:', error.message);
    throw error;
  }
}

module.exports = {
  getAuthUrl,
  getTokenFromCode,
  refreshOutlookToken,
  testMicrosoftConnection
};