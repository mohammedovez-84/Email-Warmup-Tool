function getSenderType(sender) {
    console.log(`🔍 Determining sender type for ${sender.email}:`, {
        roundRobinIndexGoogle: sender.roundRobinIndexGoogle,
        roundRobinIndexMicrosoft: sender.roundRobinIndexMicrosoft,
        roundRobinIndexCustom: sender.roundRobinIndexCustom,
        provider: sender.provider,
        smtp_host: sender.smtp_host,
        app_password: !!sender.app_password,
        access_token: !!sender.access_token
    });

    // Check for Google user - prioritize explicit indicators
    if (sender.roundRobinIndexGoogle !== undefined || sender.provider === 'google') {
        console.log(`✅ Detected as Google account (explicit): ${sender.email}`);
        return 'google';
    }

    // Check for Microsoft user - prioritize explicit indicators
    if (sender.roundRobinIndexMicrosoft !== undefined || sender.provider === 'microsoft') {
        console.log(`✅ Detected as Microsoft account (explicit): ${sender.email}`);
        return 'microsoft';
    }

    // Check for SMTP account - prioritize explicit indicators
    if (sender.roundRobinIndexCustom !== undefined) {
        console.log(`✅ Detected as SMTP account (explicit): ${sender.email}`);
        return 'smtp';
    }

    // Secondary checks for credentials
    if (sender.app_password) {
        console.log(`✅ Detected as Google account (app_password): ${sender.email}`);
        return 'google';
    }

    if (sender.access_token) {
        console.log(`✅ Detected as Microsoft account (access_token): ${sender.email}`);
        return 'microsoft';
    }

    if (sender.smtp_host) {
        console.log(`✅ Detected as SMTP account (smtp_host): ${sender.email}`);
        return 'smtp';
    }

    // Fallback: Check email domain (only if no other indicators)
    if (sender.email) {
        if (sender.email.endsWith('@gmail.com')) {
            console.log(`✅ Detected as Google account by domain: ${sender.email}`);
            return 'google';
        }

        if (sender.email.endsWith('@outlook.com') || sender.email.endsWith('@hotmail.com') || sender.email.endsWith('@live.com')) {
            console.log(`✅ Detected as Microsoft account by domain: ${sender.email}`);
            return 'microsoft';
        }

        // For custom domains, check if we have any SMTP-like configuration
        if (sender.smtp_user || sender.smtp_pass) {
            console.log(`✅ Detected as SMTP account (credentials): ${sender.email}`);
            return 'smtp';
        }
    }

    console.log(`❓ Unknown account type for: ${sender.email}, defaulting to SMTP`);
    return 'smtp';
}
function buildSenderConfig(sender, senderType) {
    console.log(`🔧 DEBUG Building sender config for:`, {
        email: sender.email,
        senderType: senderType,
        hasAppPassword: !!sender.app_password,
        hasAccessToken: !!sender.access_token,
        hasSmtpHost: !!sender.smtp_host,
        hasSmtpPass: !!sender.smtp_pass,
        hasSmtpUser: !!sender.smtp_user
    });

    // If senderType is not provided, detect it
    if (!senderType) {
        senderType = getSenderType(sender);
    }

    console.log(`🔧 Final sender type: ${senderType}`);

    const base = {
        userId: sender.userId || sender.user_id,
        name: sender.name || sender.sender_name || sender.email,
        email: sender.email,
        type: senderType,
        startEmailsPerDay: sender.startEmailsPerDay,
        increaseEmailsPerDay: sender.increaseEmailsPerDay,
        maxEmailsPerDay: sender.maxEmailsPerDay,
        replyRate: sender.replyRate,
        warmupDayCount: sender.warmupDayCount,
        industry: sender.industry
    };

    if (senderType === 'google') {
        if (!sender.app_password) {
            throw new Error(`❌ App password required for Gmail account: ${sender.email}`);
        }

        const config = {
            ...base,
            smtpHost: 'smtp.gmail.com',
            smtpPort: 587,
            smtpUser: sender.email,
            smtpPass: sender.app_password,
            smtpEncryption: 'TLS',
            imapHost: 'imap.gmail.com',
            imapPort: 993,
            imapUser: sender.email,
            imapPass: sender.app_password,
            imapEncryption: 'SSL',
        };

        console.log(`✅ Google config built: ${config.smtpHost}:${config.smtpPort}`);
        return config;
    }

    if (senderType === 'microsoft') {
        // Check for either access token or app password
        const hasValidAuth = sender.access_token || sender.app_password;
        if (!hasValidAuth) {
            throw new Error(`❌ Access token or app password required for Microsoft account: ${sender.email}`);
        }

        const config = {
            ...base,
            smtpHost: 'smtp.office365.com',
            smtpPort: 587,
            smtpUser: sender.email,
            smtpPass: sender.access_token || sender.app_password,
            smtpEncryption: 'STARTTLS',
            imapHost: 'outlook.office365.com',
            imapPort: 993,
            imapUser: sender.email,
            imapPass: sender.access_token || sender.app_password,
            imapEncryption: 'SSL',
            refreshToken: sender.refresh_token,
            accessToken: sender.access_token,
            expiresAt: sender.expires_at,
        };

        console.log(`✅ Microsoft config built: ${config.smtpHost}:${config.smtpPort}`);
        return config;
    }

    // SMTP account - with better validation
    if (senderType === 'smtp') {
        // Check for minimum required SMTP configuration
        const hasSmtpConfig = sender.smtp_host && sender.smtp_pass;
        const hasFallbackSmtpConfig = sender.smtp_user && sender.smtp_pass; // Some might only have user/pass

        if (!hasSmtpConfig && !hasFallbackSmtpConfig) {
            throw new Error(`❌ SMTP configuration required for account: ${sender.email}. Need at least smtp_host + smtp_pass OR smtp_user + smtp_pass`);
        }

        const config = {
            ...base,
            smtpHost: sender.smtp_host || 'smtp.' + sender.email.split('@')[1], // Try to guess host from domain
            smtpPort: sender.smtp_port || 587,
            smtpUser: sender.smtp_user || sender.email,
            smtpPass: sender.smtp_pass,
            smtpEncryption: sender.smtp_encryption || 'TLS',
            imapHost: sender.imap_host || sender.smtp_host, // Fallback to SMTP host
            imapPort: sender.imap_port || 993,
            imapUser: sender.imap_user || sender.smtp_user || sender.email,
            imapPass: sender.imap_pass || sender.smtp_pass,
            imapEncryption: sender.imap_encryption || 'SSL',
        };

        console.log(`✅ SMTP config built: ${config.smtpHost}:${config.smtpPort}`);
        return config;
    }

    throw new Error(`❌ Unsupported sender type: ${senderType} for account: ${sender.email}`);
}
module.exports = { buildSenderConfig, getSenderType };