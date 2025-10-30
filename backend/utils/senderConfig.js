function normalizeFieldNames(sender) {
    if (!sender || typeof sender !== 'object') {
        console.error('❌ Invalid sender object in normalizeFieldNames:', sender);
        return {};
    }

    // Create a DEEP copy of the sender object
    const normalized = JSON.parse(JSON.stringify(sender));



    // Field mappings based on your actual database field names
    const fieldMappings = {
        // Google User fields
        'app_password': 'app_password',
        'appPassword': 'app_password',

        // Microsoft User fields  
        'access_token': 'access_token',
        'refresh_token': 'refresh_token',
        'token_expires_at': 'token_expiry',
        'expires_at': 'token_expiry',

        // SMTP Account fields
        'smtp_pass': 'smtp_pass',
        'smtpPassword': 'smtp_pass',
        'smtp_host': 'smtp_host',
        'smtpHost': 'smtp_host',
        'smtp_port': 'smtp_port',
        'smtpPort': 'smtp_port',
        'smtp_user': 'smtp_user',
        'smtpUser': 'smtp_user',
        'smtp_encryption': 'smtp_encryption',
        'smtpSecure': 'smtp_secure',

        // IMAP fields
        'imap_pass': 'imap_pass',
        'imapPassword': 'imap_pass',
        'imap_host': 'imap_host',
        'imapHost': 'imap_host',
        'imap_port': 'imap_port',
        'imapPort': 'imap_port',
        'imap_user': 'imap_user',
        'imapUser': 'imap_user',
        'imap_encryption': 'imap_encryption',
        'imapSecure': 'imap_secure',

        // EmailPool specific fields
        'providerType': 'providerType',
        'startEmailsPerDay': 'start_emails_per_day',
        'maxEmailsPerDay': 'max_emails_per_day',
        'currentDaySent': 'current_day_sent',
        'lastResetDate': 'last_reset_date',
        'appPassword': 'app_password', // For pool accounts
        'access_token': 'access_token', // For pool accounts
        'refresh_token': 'refresh_token', // For pool accounts
        'token_expires_at': 'token_expiry', // For pool accounts
        'smtpHost': 'smtp_host', // For pool accounts
        'smtpPort': 'smtp_port', // For pool accounts
        'smtpSecure': 'smtp_secure', // For pool accounts
        'smtpUser': 'smtp_user', // For pool accounts
        'smtpPassword': 'smtp_pass', // For pool accounts
        'imapHost': 'imap_host', // For pool accounts
        'imapPort': 'imap_port', // For pool accounts
        'imapSecure': 'imap_secure', // For pool accounts
        'imapUser': 'imap_user', // For pool accounts
        'imapPassword': 'imap_pass', // For pool accounts
        'isActive': 'is_active',
        'roundRobinIndex': 'round_robin_index',

        // Common fields
        'sender_name': 'name',
        'user_id': 'userId',
        'warmupDayCount': 'warmup_day_count',
        'startEmailsPerDay': 'start_emails_per_day',
        'increaseEmailsPerDay': 'increase_emails_per_day',
        'maxEmailsPerDay': 'max_emails_per_day',
        'replyRate': 'reply_rate',
        'warmupStatus': 'warmup_status',
        'is_active': 'is_active',
        'is_connected': 'is_connected'
    };

    Object.keys(fieldMappings).forEach(sourceField => {
        const targetField = fieldMappings[sourceField];

        // Copy from source to target if source exists
        if (sender[sourceField] !== undefined && sender[sourceField] !== null) {
            normalized[targetField] = sender[sourceField];

        }
    });

    // Ensure email is preserved
    if (sender.email && !normalized.email) {
        normalized.email = sender.email;
    }

    return normalized;
}

function getSenderType(sender) {
    if (!sender) {
        throw new Error('❌ Sender object is required');
    }

    // Check for pool accounts first - using providerType from EmailPool model
    if (sender.providerType) {
        const poolType = sender.providerType.toLowerCase();
        const poolTypeMap = {
            'gmail': 'google',
            'outlook': 'outlook_personal',
            'outlook_personal': 'outlook_personal',
            'microsoft_organizational': 'microsoft_organizational',
            'custom': 'smtp'
        };
        return poolTypeMap[poolType] || poolType;
    }

    // Check for explicit provider from database
    if (sender.provider === 'google' || sender.roundRobinIndexGoogle !== undefined) {
        return 'google';
    }
    if (sender.provider === 'microsoft' || sender.roundRobinIndexMicrosoft !== undefined) {
        return 'microsoft_organizational';
    }
    if (sender.provider === 'smtp' || sender.roundRobinIndexCustom !== undefined) {
        return 'smtp';
    }

    // Check email domain to determine type
    if (sender.email) {
        const email = sender.email.toLowerCase();

        if (email.endsWith('@gmail.com') || email.endsWith('@googlemail.com')) {
            return 'google';
        }
        if (email.endsWith('@outlook.com') || email.endsWith('@hotmail.com') || email.endsWith('@live.com')) {
            return 'outlook_personal';
        }
        // All other Microsoft domains are considered organizational
        if (email.endsWith('.onmicrosoft.com') ||
            (email.includes('@') && !email.endsWith('@gmail.com') &&
                !email.endsWith('@outlook.com') && !email.endsWith('@hotmail.com') &&
                !email.endsWith('@live.com'))) {
            return 'microsoft_organizational';
        }
    }

    return 'smtp'; // Default to custom SMTP
}

function buildSenderConfig(sender, senderType = null) {
    if (!sender) {
        throw new Error('❌ Sender object is required');
    }



    // Handle field name variations before normalization
    const preNormalized = { ...sender };

    // Map token_expires_at to token_expiry if needed (for EmailPool)
    if (preNormalized.token_expires_at && !preNormalized.token_expiry) {
        const expiryDate = new Date(Number(preNormalized.token_expires_at));
        preNormalized.token_expiry = expiryDate.toISOString();
        console.log(`🔄 Mapped token_expires_at → token_expiry: ${preNormalized.token_expiry}`);
    }

    // Map expires_at to token_expiry for Microsoft users
    if (preNormalized.expires_at && !preNormalized.token_expiry) {
        const expiryDate = new Date(Number(preNormalized.expires_at));
        preNormalized.token_expiry = expiryDate.toISOString();
        console.log(`🔄 Mapped expires_at → token_expiry: ${preNormalized.token_expiry}`);
    }

    const normalizedSender = normalizeFieldNames(preNormalized);

    if (!normalizedSender.email) {
        throw new Error('❌ Sender email is required but missing');
    }

    if (!senderType) {
        senderType = getSenderType(normalizedSender);
    }



    const baseConfig = {
        userId: normalizedSender.userId || normalizedSender.user_id,
        name: normalizedSender.name || normalizedSender.sender_name || extractNameFromEmail(normalizedSender.email),
        email: normalizedSender.email,
        type: senderType,
        startEmailsPerDay: normalizedSender.startEmailsPerDay || normalizedSender.start_emails_per_day || 10, // Higher default for pool
        increaseEmailsPerDay: normalizedSender.increaseEmailsPerDay || normalizedSender.increase_emails_per_day || 5,
        maxEmailsPerDay: normalizedSender.maxEmailsPerDay || normalizedSender.max_emails_per_day || 50, // Higher max for pool
        replyRate: normalizedSender.replyRate || normalizedSender.reply_rate || 0.25,
        warmupDayCount: normalizedSender.warmupDayCount || normalizedSender.warmup_day_count || 0,
        industry: normalizedSender.industry || 'general',
        provider: normalizedSender.provider || senderType,
        is_active: normalizedSender.is_active !== undefined ? normalizedSender.is_active : true,
        is_connected: normalizedSender.is_connected !== undefined ? normalizedSender.is_connected : true,
        warmupStatus: normalizedSender.warmupStatus || normalizedSender.warmup_status || 'paused',
        // Pool-specific fields
        currentDaySent: normalizedSender.currentDaySent || normalizedSender.current_day_sent || 0,
        lastResetDate: normalizedSender.lastResetDate || normalizedSender.last_reset_date,
        roundRobinIndex: normalizedSender.roundRobinIndex || normalizedSender.round_robin_index || 0
    };

    // 1. GMAIL - Support both OAuth2 AND App Passwords
    if (senderType === 'google' || senderType === 'gmail') {
        const googlePassword = normalizedSender.app_password;
        const hasOAuth2 = normalizedSender.access_token;
        const hasRefreshToken = normalizedSender.refresh_token;

        // Check if we have EITHER app password OR valid OAuth2 tokens
        if (!googlePassword && !hasOAuth2) {
            throw new Error(`Google account ${normalizedSender.email} is missing app_password or OAuth2 tokens`);
        }

        // If we have OAuth2 tokens but no refresh token, that's invalid
        if (hasOAuth2 && !hasRefreshToken) {
            throw new Error(`Google account ${normalizedSender.email} has OAuth2 access token but missing refresh token`);
        }

        const config = {
            ...baseConfig,
            smtpHost: 'smtp.gmail.com',
            smtpPort: 587,
            smtpUser: normalizedSender.email,
            smtpSecure: false,
            smtpEncryption: 'TLS',
            imapHost: 'imap.gmail.com',
            imapPort: 993,
            imapUser: normalizedSender.email,
            imapSecure: true,
            imapEncryption: 'SSL'
        };

        // Use OAuth2 if available, otherwise fall back to app password
        if (hasOAuth2 && hasRefreshToken) {

            config.useOAuth2 = true;
            config.accessToken = normalizedSender.access_token;
            config.refreshToken = normalizedSender.refresh_token;
            config.tokenExpiry = normalizedSender.token_expiry;
            config.smtpPass = config.accessToken; // Fallback for compatibility
            config.imapPass = config.accessToken;
        } else {

            config.useOAuth2 = false;
            config.smtpPass = googlePassword;
            config.imapPass = googlePassword;
        }

        return config;
    }

    // 2. OUTLOOK PERSONAL - Use Graph API with OAuth2
    if (senderType === 'outlook_personal') {
        const outlookToken = normalizedSender.access_token;

        if (outlookToken) {
            console.log(`🔑 Using Graph API ONLY for Outlook Personal: ${normalizedSender.email}`);
            return {
                ...baseConfig,
                useGraphApi: true, // Force Graph API
                accessToken: outlookToken,
                refreshToken: normalizedSender.refresh_token,
                tokenExpiry: normalizedSender.token_expiry,
                // Remove SMTP credentials to prevent fallback
                smtpHost: null,
                smtpPort: null,
                smtpUser: null,
                providerType: 'OUTLOOK_PERSONAL'
            };
        } else {
            throw new Error(`Outlook personal account ${normalizedSender.email} requires OAuth2 tokens for Graph API`);
        }
    }

    // 3. MICROSOFT ORGANIZATIONAL - Use OAuth (Azure AD)
    if (senderType === 'microsoft_organizational') {
        const microsoftToken = normalizedSender.access_token;
        const microsoftRefreshToken = normalizedSender.refresh_token;

        if (!microsoftToken) {
            throw new Error(`Microsoft organizational account ${normalizedSender.email} is missing access_token. Use Azure AD app registration.`);
        }

        console.log(`🔑 Using OAuth token for Microsoft Organizational: ${normalizedSender.email}`);

        // FORCE Office 365 servers for Microsoft organizational accounts
        const config = {
            ...baseConfig,
            // ALWAYS use Office 365 servers for Microsoft organizational accounts
            smtpHost: 'smtp.office365.com',
            smtpPort: 587,
            smtpUser: normalizedSender.email,
            smtpPass: microsoftToken, // For fallback
            smtpSecure: false,
            accessToken: microsoftToken,
            refreshToken: microsoftRefreshToken,
            tokenExpiry: normalizedSender.token_expiry,
            useOAuth2: true,
            smtpEncryption: 'STARTTLS',
            imapHost: 'outlook.office365.com',
            imapPort: 993,
            imapUser: normalizedSender.email,
            imapPass: microsoftToken, // Use token for IMAP too
            imapSecure: true,
            imapEncryption: 'SSL',
            // Force Microsoft organizational settings
            providerType: 'MICROSOFT_ORGANIZATIONAL'
        };

        // Override any custom SMTP settings that might have been provided
        console.log(`🔧 FORCING Office 365 servers for Microsoft organizational account`);
        console.log(`   SMTP: smtp.office365.com:587`);
        console.log(`   IMAP: outlook.office365.com:993`);

        return config;
    }

    // 4. CUSTOM SMTP/IMAP
    if (senderType === 'smtp' || senderType === 'custom') {
        const smtpHost = normalizedSender.smtp_host;
        const smtpUser = normalizedSender.smtp_user || normalizedSender.email;

        // Check multiple possible password fields from your database
        const smtpPass = normalizedSender.smtp_pass ||
            normalizedSender.app_password; // Fallback to app_password if available

        const smtpPort = normalizedSender.smtp_port || 587;
        const smtpSecure = normalizedSender.smtp_secure !== undefined ? normalizedSender.smtp_secure : false;

        const imapHost = normalizedSender.imap_host;
        const imapUser = normalizedSender.imap_user || normalizedSender.email;
        const imapPass = normalizedSender.imap_pass || smtpPass; // Fall back to SMTP password
        const imapPort = normalizedSender.imap_port || 993;
        const imapSecure = normalizedSender.imap_secure !== undefined ? normalizedSender.imap_secure : true;



        if (!smtpPass) {
            throw new Error(`SMTP account ${normalizedSender.email} is missing SMTP password. Checked fields: smtp_pass, app_password`);
        }
        if (!smtpHost) {
            throw new Error(`SMTP account ${normalizedSender.email} is missing SMTP host`);
        }

        return {
            ...baseConfig,
            smtpHost: smtpHost,
            smtpPort: smtpPort,
            smtpUser: smtpUser,
            smtpPass: smtpPass,
            smtpSecure: smtpSecure,
            smtpEncryption: normalizedSender.smtp_encryption || (smtpSecure ? 'TLS' : 'STARTTLS'),
            imapHost: imapHost,
            imapPort: imapPort,
            imapUser: imapUser,
            imapPass: imapPass,
            imapSecure: imapSecure,
            imapEncryption: normalizedSender.imap_encryption || (imapSecure ? 'SSL' : 'STARTTLS'),
            useOAuth2: false
        };
    }

    throw new Error(`Unsupported sender type: ${senderType}`);
}

function extractNameFromEmail(email) {
    if (!email) return "User";
    const localPart = email.split("@")[0];
    return localPart.split(/[._-]/).map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
}

function buildPoolConfig(poolAccount) {


    // FIX: Extract data from Sequelize instance
    let poolData;
    if (poolAccount && typeof poolAccount === 'object' && poolAccount.dataValues) {
        // It's a Sequelize instance - get the plain data
        poolData = { ...poolAccount.dataValues };

    } else {
        // It's already a plain object
        poolData = { ...poolAccount };
    }

    // For pool accounts, we need to ensure they have the right structure
    const poolWithProvider = {
        ...poolData,
        provider: poolData.providerType ? poolData.providerType.toLowerCase() : 'smtp'
    };

    return buildSenderConfig(poolWithProvider);
}



// Simple validation function
function validateAccountConfig(account, context = 'warmup') {
    const errors = [];

    if (!account.email) {
        errors.push('Email is required');
    }

    return {
        isValid: errors.length === 0,
        errors: errors,
        context: context
    };
}

// Simple capabilities function
function getAccountCapabilities(accountConfig) {
    return {
        canSend: true,
        canReceive: true,
        canUseImap: true,
        supportedDirections: ['WARMUP_TO_POOL', 'POOL_TO_WARMUP']
    };
}

module.exports = {
    buildSenderConfig,
    buildWarmupConfig: buildSenderConfig, // Alias
    buildPoolConfig,
    getSenderType,
    extractNameFromEmail,
    normalizeFieldNames,
    validateAccountConfig,
    getAccountCapabilities
};