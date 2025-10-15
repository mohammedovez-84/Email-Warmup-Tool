const axios = require('axios');

/**
 * Refresh Microsoft OAuth2 token
 * @param {string} clientId - your Azure app client ID
 * @param {string} clientSecret - your Azure app client secret
 * @param {string} refreshToken - refresh token from DB
 * @param {string} tenantId - Azure tenant ID or 'common'
 * @returns {Promise<{access_token: string, expires_in: number}>}
 */
async function refreshMicrosoftToken(clientId, clientSecret, refreshToken, tenantId = 'common') {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('scope', 'https://outlook.office365.com/.default offline_access');
  params.append('refresh_token', refreshToken);
  params.append('grant_type', 'refresh_token');
  params.append('client_secret', clientSecret);

  try {
    const response = await axios.post(url, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in // seconds
    };
  } catch (error) {
    console.error('Error refreshing Microsoft token:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { refreshMicrosoftToken };





