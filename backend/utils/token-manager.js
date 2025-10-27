const axios = require('axios');

class OutlookTokenManager {
    /**
     * Refresh expired Outlook OAuth2 token
     */
    async refreshOutlookToken(senderConfig) {
        try {
            console.log('🔄 Refreshing expired Outlook token...');

            if (!senderConfig.refresh_token) {
                throw new Error('No refresh token available');
            }

            console.log('🔍 Refresh token details:', {
                hasRefreshToken: !!senderConfig.refresh_token,
                refreshTokenLength: senderConfig.refresh_token ? senderConfig.refresh_token.length : 0,
                clientId: process.env.MS_CLIENT_ID ? 'PRESENT' : 'MISSING',
                clientSecret: process.env.MS_CLIENT_SECRET ? 'PRESENT' : 'MISSING'
            });

            // Use the SAME credentials and scopes as your OAuth flow
            const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token',
                new URLSearchParams({
                    client_id: process.env.MS_CLIENT_ID, // ← Use MS_CLIENT_ID not OUTLOOK_CLIENT_ID
                    client_secret: process.env.MS_CLIENT_SECRET, // ← Use MS_CLIENT_SECRET not OUTLOOK_CLIENT_SECRET
                    refresh_token: senderConfig.refresh_token,
                    grant_type: 'refresh_token',
                    scope: 'openid profile offline_access User.Read Mail.Read Mail.Send Mail.ReadWrite' // ← Use SAME scopes
                }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 30000
            }
            );

            const newTokens = response.data;
            const newExpiry = Date.now() + (newTokens.expires_in * 1000);

            console.log('✅ Token refreshed successfully');
            console.log(`   New expiry: ${new Date(newExpiry).toISOString()}`);
            console.log(`   New access token: ${newTokens.access_token ? 'PRESENT' : 'MISSING'}`);
            console.log(`   New refresh token: ${newTokens.refresh_token ? 'PRESENT' : 'MISSING'}`);

            return {
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token || senderConfig.refresh_token, // Keep old if not provided
                token_expiry: new Date(newExpiry).toISOString(), // ← Use token_expiry for consistency
                token_expires_at: newExpiry
            };

        } catch (error) {
            console.error('❌ Token refresh failed:', error.response?.data || error.message);

            // More detailed error logging
            if (error.response) {
                console.error('   HTTP Status:', error.response.status);
                console.error('   Error Response:', error.response.data);
            }

            throw error;
        }
    }

    /**
  * Get fresh account data with latest tokens from database
  */
    async getFreshAccountData(email) {
        try {
            const EmailPool = require('../models/EmailPool');
            const account = await EmailPool.findOne({
                where: { email },
                // Only query columns that actually exist in your database
                attributes: ['email', 'access_token', 'refresh_token', 'token_expires_at', 'isActive', 'providerType']
            });

            if (!account) {
                throw new Error('Account not found in database');
            }

            const accountData = account.get({ plain: true });

            console.log('🔍 Fresh account data from DB:', {
                email: accountData.email,
                hasAccessToken: !!accountData.access_token,
                hasRefreshToken: !!accountData.refresh_token,
                token_expires_at: accountData.token_expires_at,
                isActive: accountData.isActive
            });

            return accountData;
        } catch (error) {
            console.error('❌ Error fetching fresh account data:', error.message);
            throw error;
        }
    }

    /**
     * Update tokens in database
     */
    async updateTokensInDatabase(email, newTokens) {
        try {
            const EmailPool = require('../models/EmailPool');
            await EmailPool.update({
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token,
                token_expires_at: newTokens.token_expires_at // Only update existing field
            }, { where: { email } });

            console.log(`✅ Updated tokens in database for: ${email}`);
        } catch (error) {
            console.error('❌ Error updating tokens in database:', error.message);
            throw error;
        }
    }

    /**
     * Check if token is expired or about to expire
     */
    isTokenExpired(senderConfig) {
        if (!senderConfig.token_expires_at) {
            console.log('   ⚠️  No token expiry info found, assuming expired');
            return true;
        }

        const expiryTime = Number(senderConfig.token_expires_at);
        const now = Date.now();
        const buffer = 5 * 60 * 1000; // 5 minute buffer

        const isExpired = (expiryTime - buffer) <= now;

        if (isExpired) {
            console.log(`   ⚠️  Token expired:`);
            console.log(`      Now: ${new Date(now).toISOString()}`);
            console.log(`      Expiry: ${new Date(expiryTime).toISOString()}`);
        } else {
            console.log(`   ✅ Token valid until: ${new Date(expiryTime).toISOString()}`);
        }

        return isExpired;
    }
}

module.exports = new OutlookTokenManager();