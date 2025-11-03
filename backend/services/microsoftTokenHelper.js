const axios = require('axios');

/**
 * Refresh Microsoft OAuth2 token with enhanced error handling
 * @param {string} clientId - your Azure app client ID  
 * @param {string} clientSecret - your Azure app client secret
 * @param {string} refreshToken - refresh token from DB
 * @param {string} tenantId - Azure tenant ID or 'common'
 * @returns {Promise<{access_token: string, expires_in: number, refresh_token?: string}>}
 */
async function refreshMicrosoftToken(clientId, clientSecret, refreshToken, tenantId = 'common') {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('scope', 'https://outlook.office365.com/IMAP.AccessAsUser.All https://outlook.office365.com/SMTP.Send offline_access');
  params.append('refresh_token', refreshToken);
  params.append('grant_type', 'refresh_token');
  params.append('client_secret', clientSecret);

  try {
    console.log('🔄 Refreshing Microsoft token...');

    const response = await axios.post(url, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    console.log('✅ Microsoft token refreshed successfully');

    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
      refresh_token: response.data.refresh_token, // Important: get new refresh token
      token_type: response.data.token_type
    };

  } catch (error) {
    console.error('❌ Microsoft token refresh failed:');

    // 🚨 ENHANCED ERROR HANDLING
    const errorData = error.response?.data;

    if (errorData) {
      console.error('   Error:', errorData.error);
      console.error('   Description:', errorData.error_description);
      console.error('   Error Codes:', errorData.error_codes);

      // 🚨 SPECIFIC ERROR HANDLING
      switch (errorData.error) {
        case 'invalid_grant':
          if (errorData.error_codes?.includes(65001)) {
            throw new Error('CONSENT_REQUIRED: User or admin consent needed for application');
          } else if (errorData.suberror === 'consent_required') {
            throw new Error('CONSENT_REQUIRED: Application permissions need consent');
          } else {
            throw new Error('INVALID_GRANT: Refresh token is invalid or expired');
          }

        case 'invalid_client':
          throw new Error('INVALID_CLIENT: Client ID or secret is incorrect');

        case 'invalid_request':
          throw new Error('INVALID_REQUEST: Missing required parameters');

        case 'unauthorized_client':
          throw new Error('UNAUTHORIZED_CLIENT: Client not authorized for this flow');

        case 'unsupported_grant_type':
          throw new Error('UNSUPPORTED_GRANT_TYPE: Grant type not supported');

        default:
          throw new Error(`MICROSOFT_AUTH_ERROR: ${errorData.error} - ${errorData.error_description}`);
      }
    }

    // Network or timeout errors
    if (error.code === 'ECONNABORTED') {
      throw new Error('REQUEST_TIMEOUT: Token refresh request timed out');
    }

    if (error.code === 'ENOTFOUND') {
      throw new Error('NETWORK_ERROR: Cannot reach Microsoft servers');
    }

    throw new Error(`UNKNOWN_ERROR: ${error.message}`);
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