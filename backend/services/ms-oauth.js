// services/microsoftOAuthService.js
const axios = require('axios');

class MicrosoftOAuthService {
    // Get tokens using authorization code
    async getTokensFromCode(code, redirectUri) {
        try {
            const response = await axios.post(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
                new URLSearchParams({
                    client_id: process.env.MS_CLIENT_ID,
                    client_secret: process.env.MS_CLIENT_SECRET,
                    code: code,
                    redirect_uri: redirectUri,
                    grant_type: 'authorization_code',
                    scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send offline_access'
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            return {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                expires_in: response.data.expires_in,
                scope: response.data.scope
            };
        } catch (error) {
            console.error('Error getting tokens from code:', error.response?.data || error.message);
            throw error;
        }
    }

    // Refresh access token
    async refreshTokens(refreshToken) {
        try {
            const response = await axios.post(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
                new URLSearchParams({
                    client_id: process.env.MS_CLIENT_ID,
                    client_secret: process.env.MS_CLIENT_SECRET,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                    scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send offline_access'
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            return {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token || refreshToken, // Use new if provided, else keep old
                expires_in: response.data.expires_in
            };
        } catch (error) {
            console.error('Error refreshing tokens:', error.response?.data || error.message);
            throw error;
        }
    }

    // Get user profile using access token
    async getUserProfile(accessToken) {
        try {
            const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return {
                id: response.data.id,
                email: response.data.mail || response.data.userPrincipalName,
                displayName: response.data.displayName
            };
        } catch (error) {
            console.error('Error getting user profile:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new MicrosoftOAuthService();