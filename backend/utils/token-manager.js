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
            console.log(`🔍 Searching for account in all tables: ${email}`);

            const EmailPool = require('../models/EmailPool');
            const MicrosoftUser = require('../models/MicrosoftUser');
            const GoogleUser = require('../models/GoogleUser');
            const SmtpAccount = require('../models/smtpAccounts');

            // 1. Check MicrosoftUser table first (for warmup accounts)
            let account = await MicrosoftUser.findOne({
                where: { email },
                attributes: ['email', 'access_token', 'refresh_token', 'expires_at', 'is_connected', 'user_id']
            });

            if (account) {
                console.log(`✅ Found Microsoft warmup account: ${email}`);
                const accountData = account.get({ plain: true });

                // Map MicrosoftUser fields to standard format
                return {
                    email: accountData.email,
                    access_token: accountData.access_token,
                    refresh_token: accountData.refresh_token,
                    token_expires_at: accountData.expires_at, // Map expires_at → token_expires_at
                    isActive: accountData.is_connected !== false,
                    providerType: 'MICROSOFT_ORGANIZATIONAL',
                    source: 'MicrosoftUser'
                };
            }

            // 2. Check EmailPool table (for pool accounts)
            account = await EmailPool.findOne({
                where: { email },
                attributes: ['email', 'access_token', 'refresh_token', 'token_expires_at', 'isActive', 'providerType']
            });

            if (account) {
                console.log(`✅ Found pool account: ${email}`);
                const accountData = account.get({ plain: true });
                return {
                    ...accountData,
                    source: 'EmailPool'
                };
            }

            // 3. Check GoogleUser table
            account = await GoogleUser.findOne({
                where: { email },
                attributes: ['email', 'app_password', 'is_connected', 'user_id']
            });

            if (account) {
                console.log(`✅ Found Google account: ${email}`);
                const accountData = account.get({ plain: true });
                return {
                    email: accountData.email,
                    app_password: accountData.app_password,
                    isActive: accountData.is_connected !== false,
                    providerType: 'GMAIL',
                    source: 'GoogleUser'
                };
            }

            // 4. Check SmtpAccount table
            account = await SmtpAccount.findOne({
                where: { email },
                attributes: ['email', 'smtp_pass', 'is_active', 'user_id']
            });

            if (account) {
                console.log(`✅ Found SMTP account: ${email}`);
                const accountData = account.get({ plain: true });
                return {
                    email: accountData.email,
                    smtp_pass: accountData.smtp_pass,
                    isActive: accountData.is_active !== false,
                    providerType: 'CUSTOM',
                    source: 'SmtpAccount'
                };
            }

            console.log(`❌ Account not found in any table: ${email}`);
            throw new Error('Account not found in database');

        } catch (error) {
            console.error('❌ Error fetching fresh account data:', error.message);
            throw error;
        }
    }

    /**
     * Update tokens in database - handle all table types
     */
    async updateTokensInDatabase(email, newTokens) {
        try {
            const EmailPool = require('../models/EmailPool');
            const MicrosoftUser = require('../models/MicrosoftUser');

            // Try MicrosoftUser table first (for warmup accounts)
            let updated = await MicrosoftUser.update({
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token,
                expires_at: newTokens.token_expires_at // Map token_expires_at → expires_at
            }, { where: { email } });

            if (updated[0] > 0) {
                console.log(`✅ Updated tokens in MicrosoftUser for: ${email}`);
                return;
            }

            // Try EmailPool table (for pool accounts)
            updated = await EmailPool.update({
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token,
                token_expires_at: newTokens.token_expires_at
            }, { where: { email } });

            if (updated[0] > 0) {
                console.log(`✅ Updated tokens in EmailPool for: ${email}`);
                return;
            }

            console.log(`❌ Could not update tokens - account not found: ${email}`);
            throw new Error('Account not found for token update');

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