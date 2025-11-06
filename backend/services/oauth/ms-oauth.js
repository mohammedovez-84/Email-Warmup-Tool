// config/microsoftOAuth.js
require('dotenv').config();
const { AuthorizationCode } = require('simple-oauth2');

const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Missing required Microsoft OAuth environment variables');
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

// 🚨 CRITICAL FIX: Updated scopes with proper permissions
const scopes = [
    'openid',
    'profile',
    'offline_access', // 🚨 MUST HAVE for refresh tokens
    'User.Read',
    'Mail.Read',
    'Mail.Send',
    'Mail.ReadWrite',
    'Mail.ReadWrite.Shared' // Additional permission for better access
];

function getAuthUrl(redirectUri, email = null) {
    try {
        const authParams = {
            redirect_uri: redirectUri,
            scope: scopes.join(' '),
            prompt: 'consent' // 🚨 CRITICAL: Force consent to get refresh token
        };

        // Add login hint if email provided for reauthentication
        if (email) {
            authParams.login_hint = email;
        }

        const url = client.authorizeURL(authParams);
        console.log('🔐 Generated Microsoft auth URL with offline_access scope');
        return url;
    } catch (error) {
        console.error('❌ Error generating auth URL:', error);
        throw error;
    }
}

async function getTokenFromCode(redirectUri, code) {
    try {
        console.log('🔄 Exchanging code for token...');
        const tokenParams = {
            code,
            redirect_uri: redirectUri,
            scope: scopes.join(' '),
        };

        const accessToken = await client.getToken(tokenParams);

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
        console.error('❌ Error exchanging code for token:', error.message);
        console.error('Error details:', error.response?.data || error);
        throw error;
    }
}

async function refreshOutlookToken(account) {
    try {
        console.log(`🔄 Refreshing token for: ${account.email}`);

        if (!account.refresh_token) {
            throw new Error('❌ No refresh token available - reauthentication required');
        }

        const tokenParams = {
            refresh_token: account.refresh_token,
            scope: scopes.join(' '),
            redirect_uri: process.env.MS_REDIRECT_URL2 || process.env.MS_REDIRECT_URL
        };

        const newToken = await client.getToken(tokenParams);

        // 🚨 VALIDATE NEW TOKEN FORMAT
        if (!newToken.token.access_token.includes('.')) {
            throw new Error('❌ Invalid token format received after refresh');
        }

        console.log('✅ Token refresh successful with valid JWT format');

        return {
            access_token: newToken.token.access_token,
            refresh_token: newToken.token.refresh_token || account.refresh_token,
            expires_in: newToken.token.expires_in,
            token_expiry: new Date(Date.now() + (newToken.token.expires_in * 1000)).toISOString()
        };
    } catch (error) {
        console.error('❌ Token refresh failed:', error.message);

        // Mark account for reauthentication
        await markAccountForReauth(account.email);

        throw new Error(`Token refresh failed: ${error.message}`);
    }
}

async function markAccountForReauth(email) {
    try {
        const MicrosoftUser = require('../models/MicrosoftUser');
        await MicrosoftUser.update(
            {
                requires_reauth: true,
                access_token: null,
                refresh_token: null
            },
            { where: { email } }
        );
        console.log(`✅ Marked ${email} for reauthentication`);
    } catch (error) {
        console.error('❌ Error marking account for reauth:', error);
    }
}

module.exports = {
    getAuthUrl,
    getTokenFromCode,
    refreshOutlookToken,
    markAccountForReauth
};