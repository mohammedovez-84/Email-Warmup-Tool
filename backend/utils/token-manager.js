// utils/token-manager.js - UPDATED VERSION

const axios = require('axios');
const MicrosoftUser = require('../models/MicrosoftUser');

class TokenManager {
    constructor() {
        this.tokenCache = new Map();
    }

    async validateAndRefreshOutlookToken(account) {
        console.log("🔐 VALIDATING OUTLOOK TOKEN:", account.email);

        try {
            // 🚨 CRITICAL: Normalize field names FIRST
            const normalizedAccount = this.normalizeAccountFields(account);
            const { access_token, refresh_token, email } = normalizedAccount;

            console.log(`   Field mapping:`);
            console.log(`   access_token: ${!!access_token}`);
            console.log(`   refresh_token: ${!!refresh_token}`);
            console.log(`   Final accessToken: ${access_token ? 'PRESENT' : 'MISSING'}`);
            console.log(`   Final refreshToken: ${refresh_token ? 'PRESENT' : 'MISSING'}`);

            // 🚨 CRITICAL: Check if we have tokens
            if (!access_token) {
                console.log('❌ CRITICAL: No access token found');
                await this.markAccountForReauth(email);
                return null;
            }

            if (!refresh_token) {
                console.log('❌ CRITICAL: No refresh token available');
                await this.markAccountForReauth(email);
                return null;
            }

            // 🚨 IMPROVED: Better JWT validation
            const jwtValidation = this.validateJWT(access_token);
            if (!jwtValidation.isValid) {
                console.log(`❌ JWT VALIDATION FAILED: ${jwtValidation.reason}`);
                console.log(`   Token length: ${access_token.length}`);
                console.log(`   Token preview: ${access_token.substring(0, 100)}...`);

                // Try to refresh the token
                console.log('🔄 Attempting token refresh due to JWT validation failure...');
                const refreshedTokens = await this.refreshOutlookToken(normalizedAccount);

                if (refreshedTokens && refreshedTokens.access_token) {
                    console.log('✅ Token refreshed successfully after JWT validation failure');
                    return refreshedTokens;
                } else {
                    console.log('❌ Token refresh failed after JWT validation failure');
                    await this.markAccountForReauth(email);
                    return null;
                }
            }

            console.log('✅ JWT token structure is valid');

            // 🚨 Check token expiry
            if (this.isTokenExpired(normalizedAccount)) {
                console.log('🔄 Token expired, attempting refresh...');
                const refreshedTokens = await this.refreshOutlookToken(normalizedAccount);

                if (refreshedTokens && refreshedTokens.access_token) {
                    console.log('✅ Token refreshed successfully');
                    return refreshedTokens;
                } else {
                    console.log('❌ Token refresh failed');
                    await this.markAccountForReauth(email);
                    return null;
                }
            }

            // 🚨 Test token with Graph API
            console.log('🧪 Testing token with Graph API...');
            const isValid = await this.testTokenWithGraphAPI(access_token);

            if (!isValid) {
                console.log('❌ Token failed Graph API test');

                // Try to refresh once
                const refreshedTokens = await this.refreshOutlookToken(normalizedAccount);
                if (refreshedTokens && refreshedTokens.access_token) {
                    return refreshedTokens;
                }

                await this.markAccountForReauth(email);
                return null;
            }

            console.log('✅ Outlook token validation successful');
            return normalizedAccount;

        } catch (error) {
            console.error(`❌ Token validation error: ${error.message}`);
            await this.markAccountForReauth(account.email);
            return null;
        }
    }

    /**
     * 🚨 NEW: Normalize account fields to handle both naming conventions
     */
    // In utils/token-manager.js - UPDATE THE normalizeAccountFields function

    normalizeAccountFields(account) {
        const normalized = { ...account };

        // 🚨 Handle both field naming conventions
        normalized.access_token = account.access_token || account.accessToken;
        normalized.refresh_token = account.refresh_token || account.refreshToken;

        // 🚨 CRITICAL FIX: Read from expires_at field since that's what you're using
        if (account.expires_at) {
            // Convert timestamp to ISO string for token_expiry
            const expiryDate = new Date(Number(account.expires_at));
            normalized.token_expiry = expiryDate.toISOString();
            normalized.token_expires_at = account.expires_at;
        } else if (account.token_expiry) {
            // Fallback to token_expiry if available
            normalized.token_expiry = account.token_expiry;
            normalized.token_expires_at = new Date(account.token_expiry).getTime();
        }

        // 🚨 ENSURE EMAIL IS PRESENT
        normalized.email = account.email;

        console.log(`   🔄 Normalized fields for ${normalized.email}:`);
        console.log(`      access_token: ${!!normalized.access_token}`);
        console.log(`      refresh_token: ${!!normalized.refresh_token}`);
        console.log(`      expires_at: ${account.expires_at}`);
        console.log(`      token_expiry: ${normalized.token_expiry}`);
        console.log(`      token_expires_at: ${normalized.token_expires_at}`);

        return normalized;
    }

    /**
     * 🚨 IMPROVED JWT validation that handles Microsoft's token formats
     */
    validateJWT(token) {
        try {
            if (!token || typeof token !== 'string') {
                return { isValid: false, reason: 'Token is not a string' };
            }

            // Check if it's a standard JWT (should have 2 or 3 dots)
            const parts = token.split('.');

            if (parts.length === 3) {
                // Standard JWT format - validate structure
                try {
                    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

                    if (header.typ === 'JWT' && payload.aud) {
                        return { isValid: true, reason: 'Valid standard JWT' };
                    }
                } catch (parseError) {
                    return { isValid: false, reason: 'Invalid JWT structure - cannot parse' };
                }
            } else if (parts.length === 1) {
                // 🚨 MICROSOFT ENCRYPTED TOKEN FORMAT
                if (token.length > 1000) {
                    return {
                        isValid: true,
                        reason: 'Microsoft encrypted token (non-JWT format)'
                    };
                } else {
                    return {
                        isValid: false,
                        reason: 'Single part token too short for Microsoft format'
                    };
                }
            } else {
                return {
                    isValid: false,
                    reason: `Unexpected token format: ${parts.length} parts`
                };
            }

            return { isValid: true, reason: 'Passed validation checks' };

        } catch (error) {
            return { isValid: false, reason: `JWT validation error: ${error.message}` };
        }
    }

    async refreshOutlookToken(account) {
        try {
            console.log('🔄 Refreshing Outlook token...');

            const { refresh_token, email } = account;

            if (!refresh_token) {
                throw new Error('No refresh token available');
            }

            console.log('🔧 Refresh details:', {
                refreshTokenLength: refresh_token.length,
                accessTokenLength: account.access_token?.length,
                clientId: process.env.MS_CLIENT_ID ? 'PRESENT' : 'MISSING'
            });

            const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: process.env.MS_CLIENT_ID,
                    client_secret: process.env.MS_CLIENT_SECRET,
                    refresh_token: refresh_token,
                    grant_type: 'refresh_token',
                    scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send offline_access'
                }),
                timeout: 30000
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.log(`❌ Token refresh failed: ${response.status} - ${errorText}`);

                if (response.status === 400) {
                    try {
                        const errorData = JSON.parse(errorText);
                        if (errorData.error === 'invalid_grant') {
                            console.log('🔐 Refresh token is invalid or expired - requiring reauthentication');
                        }
                    } catch (e) {
                        console.log('   ⚠️  Could not parse error response');
                    }
                }
                return null;
            }

            const tokenData = await response.json();

            // 🚨 VALIDATE THE NEW TOKEN
            const newTokenValidation = this.validateJWT(tokenData.access_token);
            if (!newTokenValidation.isValid) {
                console.log('❌ Refreshed token is also invalid:', newTokenValidation.reason);
                return null;
            }

            const expiresIn = tokenData.expires_in || 3600;
            const tokenExpiresAt = Date.now() + (expiresIn * 1000);

            console.log('✅ Token refresh successful');
            console.log(`   New token length: ${tokenData.access_token.length}`);
            console.log(`   New expiry: ${new Date(tokenExpiresAt).toISOString()}`);

            const refreshedTokens = {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || refresh_token,
                token_expires_at: tokenExpiresAt,
                token_expiry: new Date(tokenExpiresAt).toISOString()
            };

            // Update database
            await this.updateTokensInDatabase(email, refreshedTokens);

            return refreshedTokens;

        } catch (error) {
            console.error('❌ Token refresh error:', error.message);
            return null;
        }
    }

    /**
     * 🚨 IMPROVED: Token expiry check
     */
    // In utils/token-manager.js - MINIMAL FIX
    isTokenExpired(account) {
        // 🚨 USE expires_at FIELD DIRECTLY (what you're storing)
        const expiryTime = account.expires_at;

        if (!expiryTime) {
            console.log('   ⚠️  No expiry time found in expires_at field - assuming expired');
            return true;
        }

        const expiry = Number(expiryTime);
        const now = Date.now();
        const buffer = 10 * 60 * 1000; // 10 minute buffer

        const isExpired = (expiry - buffer) <= now;

        if (isExpired) {
            console.log(`   ⏰ Token expired:`);
            console.log(`      Now: ${new Date(now).toISOString()}`);
            console.log(`      Expiry: ${new Date(expiry).toISOString()}`);
        } else {
            const timeLeft = Math.round((expiry - now) / 60000);
            console.log(`   ✅ Token valid for ${timeLeft} minutes`);
        }

        return isExpired;
    }

    /**
     * 🚨 NEW: Test token with actual Graph API call
     */
    async testTokenWithGraphAPI(accessToken) {
        try {
            const response = await axios.get(
                'https://graph.microsoft.com/v1.0/me',
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            return response.status === 200;
        } catch (error) {
            console.log(`   ⚠️ Graph API test failed: ${error.response?.status || error.message}`);
            return false;
        }
    }

    /**
     * 🚨 UPDATED: Mark account for reauthentication
     */
    async markAccountForReauth(email) {
        try {
            console.log(`🔐 Marking account for reauthentication: ${email}`);

            const updated = await MicrosoftUser.update(
                {
                    warmupStatus: 'needs_reauth',
                    is_connected: false,
                    last_error: 'Graph API authentication failed - please reauthenticate',
                    reauth_requested_at: new Date()
                },
                { where: { email } }
            );

            if (updated[0] > 0) {
                console.log(`✅ Account marked for reauthentication: ${email}`);
                return true;
            } else {
                console.log(`⚠️ Account not found in MicrosoftUser: ${email}`);
                return false;
            }
        } catch (error) {
            console.error(`❌ Error marking account for reauth:`, error);
            return false;
        }
    }

    /**
     * 🚨 UPDATED: Database token update with proper field mapping
     */
    async updateTokensInDatabase(email, tokens) {
        try {
            const updateData = {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                token_expires_at: tokens.token_expires_at,
                expires_at: tokens.token_expires_at, // Update both fields
                last_token_refresh: new Date(),
                warmupStatus: 'active',
                is_connected: true
            };

            const updated = await MicrosoftUser.update(
                updateData,
                { where: { email } }
            );

            if (updated[0] > 0) {
                console.log(`✅ Updated tokens in database for: ${email}`);
                return true;
            } else {
                console.log(`❌ Account not found for token update: ${email}`);
                return false;
            }
        } catch (error) {
            console.error('❌ Error updating tokens in database:', error.message);
            return false;
        }
    }

    /**
     * 🚨 NEW: Get fresh account data with proper field mapping
     */
    async getFreshAccountData(email) {
        try {
            console.log(`🔍 Fetching fresh account data for: ${email}`);

            const account = await MicrosoftUser.findOne({
                where: { email },
                raw: true
            });

            if (!account) {
                console.log(`❌ Account not found: ${email}`);
                return null;
            }

            // 🚨 Normalize field names for consistency
            return this.normalizeAccountFields(account);

        } catch (error) {
            console.error(`❌ Error fetching account data: ${error.message}`);
            return null;
        }
    }

    isMicrosoftOrganizational(email, accountData = null) {
        // Check if it's definitely NOT a personal account
        const isPersonal = email.endsWith('@outlook.com') ||
            email.endsWith('@hotmail.com') ||
            email.endsWith('@live.com');

        if (isPersonal) return false;

        // Check account data for organizational flags
        if (accountData) {
            if (accountData.providerType === 'microsoft_organizational') return true;
            if (accountData.is_organizational === true) return true;
            if (accountData.tenant_id) return true;
        }

        // Default: assume organizational for non-personal domains
        return true;
    }
}

module.exports = new TokenManager();