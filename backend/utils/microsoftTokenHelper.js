const axios = require('axios');

// 🚨 UPDATED: Microsoft Token Refresh with Personal Account Support
async function refreshMicrosoftToken(account) {
  try {
    console.log(`   🔄 Attempting to refresh Microsoft token for: ${account.email}`);

    if (!account.refresh_token) {
      console.log(`   ❌ No refresh token available for ${account.email}`);

      // 🚨 CHECK IF THIS IS A PERSONAL ACCOUNT THAT NEEDS DIFFERENT AUTH
      const isPersonal = account.email.includes('@outlook.com') || account.email.includes('@hotmail.com');
      if (isPersonal) {
        console.log(`   🔐 Personal Outlook account detected - may need different authentication flow`);
        console.log(`   💡 Personal accounts may require re-authentication with proper scopes`);
      }

      return null;
    }

    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const params = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      client_secret: process.env.MS_CLIENT_SECRET,
      refresh_token: account.refresh_token,
      grant_type: 'refresh_token',
      // 🚨 USE CORRECT SCOPES FOR PERSONAL ACCOUNTS
      scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read offline_access'
    });

    console.log(`   🔄 Refreshing token with scopes: Mail.Send, Mail.Read`);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
      timeout: 10000
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ❌ Token refresh failed: ${response.status} - ${errorText}`);

      // 🚨 SPECIFIC ERROR HANDLING
      if (response.status === 400) {
        console.log(`   🔐 Authentication issue: May need re-authentication`);
      } else if (response.status === 401) {
        console.log(`   🔐 Unauthorized: Client credentials may be invalid`);
      }
      return null;
    }

    const tokenData = await response.json();
    console.log(`   ✅ Microsoft token refreshed successfully`);
    console.log(`   📊 Token expires in: ${tokenData.expires_in} seconds`);

    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || account.refresh_token,
      token_expires_at: Date.now() + (tokenData.expires_in * 1000)
    };

  } catch (error) {
    console.log(`   ❌ Token refresh error: ${error.message}`);
    return null;
  }
}
/**
 * 🚨 NEW: Check if token needs refresh before attempting
 */
async function shouldRefreshToken(expiresAt) {
  if (!expiresAt) return true;

  const expiresTime = new Date(expiresAt).getTime();
  const now = new Date().getTime();
  const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

  return (expiresTime - now) < bufferTime;
}

/**
 * 🚨 NEW: Validate token structure and permissions
 */
function validateTokenResponse(tokenData) {
  if (!tokenData.access_token) {
    throw new Error('INVALID_TOKEN_RESPONSE: No access token received');
  }

  if (!tokenData.expires_in) {
    throw new Error('INVALID_TOKEN_RESPONSE: No expiration time received');
  }

  // Token should be a reasonable length
  if (tokenData.access_token.length < 100) {
    throw new Error('INVALID_TOKEN_RESPONSE: Access token seems too short');
  }

  return true;
}

/**
 * 🚨 NEW: Get detailed token information
 */
async function getTokenInfo(accessToken) {
  try {
    const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return {
      valid: true,
      user: response.data,
      scopes: response.headers['x-ms-scopes']
    };
  } catch (error) {
    return {
      valid: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * 🚨 NEW: Emergency fallback - try different scopes
 */
async function refreshMicrosoftTokenWithFallback(clientId, clientSecret, refreshToken, tenantId = 'common') {
  const scopesToTry = [
    'https://outlook.office365.com/IMAP.AccessAsUser.All https://outlook.office365.com/SMTP.Send offline_access',
    'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access',
    'https://outlook.office365.com/.default offline_access'
  ];

  for (const scope of scopesToTry) {
    try {
      console.log(`🔄 Trying scope: ${scope.split(' ')[0]}...`);

      const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('scope', scope);
      params.append('refresh_token', refreshToken);
      params.append('grant_type', 'refresh_token');
      params.append('client_secret', clientSecret);

      const response = await axios.post(url, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log(`✅ Success with scope: ${scope.split(' ')[0]}`);
      return response.data;

    } catch (error) {
      console.log(`❌ Failed with scope: ${scope.split(' ')[0]} - ${error.response?.data?.error}`);
      // Continue to next scope
    }
  }

  throw new Error('ALL_SCOPES_FAILED: No scope combination worked');
}

/**
 * 🚨 NEW: Handle consent required error with specific actions
 */
async function handleConsentRequiredError(email, clientId, tenantId) {
  console.log(`🚨 CONSENT REQUIRED for: ${email}`);

  // Generate admin consent URL
  const adminConsentUrl = `https://login.microsoftonline.com/${tenantId}/adminconsent?client_id=${clientId}&redirect_uri=${encodeURIComponent('http://localhost:3000/auth/callback')}`;

  // Generate user consent URL  
  const userConsentUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent('http://localhost:3000/auth/callback')}&scope=https://outlook.office365.com/IMAP.AccessAsUser.All https://outlook.office365.com/SMTP.Send offline_access&prompt=consent`;

  return {
    requires_reauth: true,
    admin_consent_url: adminConsentUrl,
    user_consent_url: userConsentUrl,
    message: 'Application requires admin or user consent. Please re-authenticate.'
  };
}

module.exports = {
  refreshMicrosoftToken,
  shouldRefreshToken,
  validateTokenResponse,
  getTokenInfo,
  refreshMicrosoftTokenWithFallback,
  handleConsentRequiredError
};