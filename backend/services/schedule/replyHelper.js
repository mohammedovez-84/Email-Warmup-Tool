const { sendEmail } = require('./emailSender');
const { buildSenderConfig } = require('../../utils/senderConfig');

async function maybeReply(replier, emailData, replyRate = 0.25) {
    try {
        // **VALIDATE REPLIER OBJECT**
        if (!replier || !replier.email) {
            console.error('❌ Invalid replier object:', replier);
            return { success: false, error: 'Invalid replier configuration' };
        }

        console.log(`🔄 Attempting reply from ${replier.email}`);

        // **ENHANCED OAUTH2 VALIDATION**
        console.log(`🔍 Replier debug:`, {
            email: replier.email,
            providerType: replier.providerType,
            hasSmtpConfig: !!(replier.smtpHost || replier.smtpPassword || replier.access_token),
            hasOAuth: !!(replier.access_token || replier.accessToken),
            hasRefreshToken: !!(replier.refresh_token || replier.refreshToken),
            tokenExpiry: replier.token_expiry || replier.tokenExpiry,
            hasAppPassword: !!replier.appPassword
        });

        // **CHECK OAUTH2 VALIDITY BEFORE BUILDING CONFIG**
        if (replier.providerType === 'google' && !replier.appPassword) {
            const hasValidOAuth = (replier.access_token || replier.accessToken) &&
                (replier.refresh_token || replier.refreshToken);

            if (!hasValidOAuth) {
                console.error(`❌ Google OAuth2 incomplete for ${replier.email}:`, {
                    accessToken: !!(replier.access_token || replier.accessToken),
                    refreshToken: !!(replier.refresh_token || replier.refreshToken),
                    tokenExpiry: replier.token_expiry || replier.tokenExpiry
                });
                return {
                    success: false,
                    error: `Google account ${replier.email} is missing OAuth2 tokens and app_password`
                };
            }
        }

        // Build proper sender config for replier
        const replierConfig = buildSenderConfig(replier);

        // **ENHANCED CONFIG DEBUG**
        console.log(`🔧 Built replier config:`, {
            email: replierConfig.email,
            smtpHost: replierConfig.smtpHost,
            smtpPort: replierConfig.smtpPort,
            hasSmtpPass: !!replierConfig.smtpPass,
            hasAccessToken: !!replierConfig.accessToken,
            hasRefreshToken: !!replierConfig.refreshToken,
            useOAuth2: replierConfig.useOAuth2,
            useAppPassword: replierConfig.useAppPassword,
            type: replierConfig.type
        });

        // **IMPROVED CONFIG VALIDATION**
        const hasValidCredentials =
            (replierConfig.smtpPass && replierConfig.smtpHost) || // App password
            (replierConfig.accessToken && replierConfig.refreshToken) || // OAuth2
            (replierConfig.useGraphApi); // Microsoft Graph

        if (!hasValidCredentials) {
            console.error('❌ Invalid replier configuration after build:', {
                smtpHost: replierConfig.smtpHost,
                hasPassword: !!replierConfig.smtpPass,
                hasAccessToken: !!replierConfig.accessToken,
                hasRefreshToken: !!replierConfig.refreshToken,
                useOAuth2: replierConfig.useOAuth2,
                useAppPassword: replierConfig.useAppPassword,
                email: replierConfig.email
            });

            let errorMessage = `SMTP account ${replierConfig.email} is missing credentials - `;
            if (replierConfig.useOAuth2) {
                errorMessage += 'OAuth2 tokens missing or invalid';
            } else {
                errorMessage += 'SMTP password/app password required';
            }

            return { success: false, error: errorMessage };
        }

        // Check reply rate
        if (Math.random() > replyRate) {
            console.log(`⏩ Skipping reply based on rate ${replyRate}`);
            return { success: false, error: 'Skipped by reply rate' };
        }

        // Log the method being used
        if (replierConfig.useGraphApi) {
            console.log(`📝 Sending reply via Microsoft Graph API`);
        } else if (replierConfig.useOAuth2) {
            console.log(`📝 Sending reply via OAuth2: ${replierConfig.smtpHost}:${replierConfig.smtpPort}`);
        } else {
            console.log(`📝 Sending reply via SMTP: ${replierConfig.smtpHost}:${replierConfig.smtpPort}`);
        }

        const replyResult = await sendEmail(replierConfig, emailData);

        if (replyResult.success) {
            console.log(`✅ Reply sent: ${replier.email} -> ${emailData.to}`);
            return { success: true, messageId: replyResult.messageId };
        } else {
            console.error(`❌ Reply failed: ${replier.email} -> ${emailData.to}: ${replyResult.error}`);
            return { success: false, error: replyResult.error };
        }

    } catch (error) {
        console.error(`❌ Error in maybeReply for ${replier?.email}:`, error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { maybeReply };