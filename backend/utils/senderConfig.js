function normalizeFieldNames(sender) {
    // Create a DEEP copy of the sender object
    const normalized = JSON.parse(JSON.stringify(sender));

    console.log(`🔄 Normalizing fields for ${sender.email}`);

    // Field mappings - CORRECTED: source → target
    const fieldMappings = {
        'appPassword': 'app_password',
        'smtpPassword': 'smtp_pass',
        'accessToken': 'access_token',
        'refreshToken': 'refresh_token',
        'smtpHost': 'smtp_host',
        'smtpPort': 'smtp_port',
        'imapHost': 'imap_host',
        'imapPort': 'imap_port',
        'imapPassword': 'imap_pass',
        'smtpUser': 'smtp_user',
        'imapUser': 'imap_user',
        'sender_name': 'name',
        'user_id': 'userId',
        'warmupDayCount': 'warmup_day_count',
        'startEmailsPerDay': 'start_emails_per_day',
        'increaseEmailsPerDay': 'increase_emails_per_day',
        'maxEmailsPerDay': 'max_emails_per_day',
        'replyRate': 'reply_rate'
    };

    Object.keys(fieldMappings).forEach(sourceField => {
        const targetField = fieldMappings[sourceField];
        // Copy from source to target if source exists and target doesn't
        if (sender[sourceField] !== undefined && normalized[targetField] === undefined) {
            normalized[targetField] = sender[sourceField];
            console.log(`   🔄 Normalized: ${sourceField} → ${targetField}`);
        }
    });

    return normalized;
}

function getSenderType(sender) {
    if (!sender) {
        throw new Error('❌ Sender object is required');
    }

    // Check for pool accounts first
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

    // Check for explicit provider
    if (sender.provider === 'google' || sender.roundRobinIndexGoogle !== undefined) {
        return 'google';
    }
    if (sender.provider === 'microsoft' || sender.roundRobinIndexMicrosoft !== undefined) {
        return 'microsoft_organizational';
    }
    if (sender.provider === 'smtp' || sender.roundRobinIndexCustom !== undefined) {
        return 'smtp';
    }

    // **FIXED: Check email domain to determine type**
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

    // Map token_expires_at to token_expiry if needed (for backward compatibility)
    if (preNormalized.token_expires_at && !preNormalized.token_expiry) {
        const expiryDate = new Date(Number(preNormalized.token_expires_at));
        preNormalized.token_expiry = expiryDate.toISOString();
        console.log(`🔄 Mapped token_expires_at → token_expiry: ${preNormalized.token_expiry}`);
    }

    const normalizedSender = normalizeFieldNames(preNormalized);

    if (!senderType) {
        senderType = getSenderType(normalizedSender);
    }

    console.log(`🔧 Building config for: ${normalizedSender.email} (type: ${senderType})`);
    console.log(`   🔐 Final OAuth2 fields:`);
    console.log(`      - access_token: ${normalizedSender.access_token ? 'PRESENT' : 'MISSING'}`);
    console.log(`      - refresh_token: ${normalizedSender.refresh_token ? 'PRESENT' : 'MISSING'}`);
    console.log(`      - token_expiry: ${normalizedSender.token_expiry || 'NOT SET'}`);
    console.log(`   🔑 App Password: ${normalizedSender.app_password ? 'PRESENT' : 'MISSING'}`);

    const baseConfig = {
        userId: normalizedSender.userId || normalizedSender.user_id,
        name: normalizedSender.name || normalizedSender.sender_name || extractNameFromEmail(normalizedSender.email),
        email: normalizedSender.email,
        type: senderType,
        startEmailsPerDay: normalizedSender.startEmailsPerDay || normalizedSender.start_emails_per_day || 3,
        increaseEmailsPerDay: normalizedSender.increaseEmailsPerDay || normalizedSender.increase_emails_per_day || 3,
        maxEmailsPerDay: normalizedSender.maxEmailsPerDay || normalizedSender.max_emails_per_day || 25,
        replyRate: normalizedSender.replyRate || normalizedSender.reply_rate || 0.25,
        warmupDayCount: normalizedSender.warmupDayCount || normalizedSender.warmup_day_count || 0,
        industry: normalizedSender.industry || 'general',
        provider: normalizedSender.provider || senderType
    };

    // 1. GMAIL - Support both OAuth2 AND App Passwords
    if (senderType === 'google' || senderType === 'gmail') {
        const googlePassword = normalizedSender.app_password || normalizedSender.appPassword;
        const hasOAuth2 = normalizedSender.access_token || normalizedSender.accessToken;
        const hasRefreshToken = normalizedSender.refresh_token || normalizedSender.refreshToken;

        // **FIXED: Check if we have EITHER app password OR valid OAuth2 tokens**
        if (!googlePassword && !hasOAuth2) {
            throw new Error(`Google account ${normalizedSender.email} is missing app_password or OAuth2 tokens`);
        }

        // **FIXED: If we have OAuth2 tokens but no refresh token, that's invalid**
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

        // **FIXED: Use OAuth2 if available, otherwise fall back to app password**
        if (hasOAuth2 && hasRefreshToken) {
            console.log(`🔑 Using OAuth2 for Google: ${normalizedSender.email}`);
            config.useOAuth2 = true;
            config.accessToken = normalizedSender.access_token || normalizedSender.accessToken;
            config.refreshToken = normalizedSender.refresh_token || normalizedSender.refreshToken;
            config.tokenExpiry = normalizedSender.token_expiry;
            config.smtpPass = config.accessToken; // Fallback for compatibility
            config.imapPass = config.accessToken;
        } else {
            console.log(`🔑 Using App Password for Google: ${normalizedSender.email}`);
            config.useOAuth2 = false;
            config.smtpPass = googlePassword;
            config.imapPass = googlePassword;
        }

        return config;
    }

    if (senderType === 'outlook_personal') {
        const outlookToken = normalizedSender.access_token || normalizedSender.accessToken;

        if (outlookToken) {
            console.log(`🔑 Using Graph API ONLY for Outlook Personal: ${normalizedSender.email}`);
            return {
                ...baseConfig,
                useGraphApi: true, // Force Graph API
                accessToken: outlookToken,
                refreshToken: normalizedSender.refresh_token || normalizedSender.refreshToken,
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
        const microsoftToken = normalizedSender.access_token || normalizedSender.accessToken;
        const microsoftRefreshToken = normalizedSender.refresh_token || normalizedSender.refreshToken;

        if (!microsoftToken) {
            throw new Error(`Microsoft organizational account ${normalizedSender.email} is missing access_token. Use Azure AD app registration.`);
        }

        console.log(`🔑 Using OAuth token for Microsoft Organizational: ${normalizedSender.email}`);
        return {
            ...baseConfig,
            smtpHost: normalizedSender.smtp_host || 'smtp.office365.com',
            smtpPort: normalizedSender.smtp_port || 587,
            smtpUser: normalizedSender.smtp_user || normalizedSender.email,
            smtpPass: microsoftToken, // For fallback
            smtpSecure: false,
            accessToken: microsoftToken,
            refreshToken: microsoftRefreshToken,
            useOAuth2: true,
            smtpEncryption: 'STARTTLS',
            imapHost: normalizedSender.imap_host || 'outlook.office365.com',
            imapPort: normalizedSender.imap_port || 993,
            imapUser: normalizedSender.imap_user || normalizedSender.email,
            imapPass: microsoftToken, // Use token for IMAP too
            imapSecure: true,
            imapEncryption: 'SSL'
        };
    }

    // 4. CUSTOM SMTP/IMAP
    if (senderType === 'smtp' || senderType === 'custom') {
        const smtpHost = normalizedSender.smtp_host;
        const smtpUser = normalizedSender.smtp_user || normalizedSender.email;
        const smtpPass = normalizedSender.smtp_pass || normalizedSender.smtpPassword;
        const smtpPort = normalizedSender.smtp_port || 587;
        const smtpSecure = normalizedSender.smtp_secure !== undefined ? normalizedSender.smtp_secure : false;

        const imapHost = normalizedSender.imap_host;
        const imapUser = normalizedSender.imap_user || normalizedSender.email;
        const imapPass = normalizedSender.imap_pass || normalizedSender.imapPassword || smtpPass;
        const imapPort = normalizedSender.imap_port || 993;
        const imapSecure = normalizedSender.imap_secure !== undefined ? normalizedSender.imap_secure : true;

        if (!smtpPass) {
            throw new Error(`SMTP account ${normalizedSender.email} is missing SMTP password`);
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



module.exports = {
    buildSenderConfig,
    getSenderType,
    extractNameFromEmail,
    normalizeFieldNames,

};