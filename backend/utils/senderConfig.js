function getSenderType(sender) {
    console.log(`🔍 Determining sender type for ${sender.email}:`, {
        roundRobinIndexGoogle: sender.roundRobinIndexGoogle,
        roundRobinIndexMicrosoft: sender.roundRobinIndexMicrosoft,
        roundRobinIndexCustom: sender.roundRobinIndexCustom,
        provider: sender.provider,
        smtp_host: sender.smtp_host
    });

    // Check for Google user
    if (sender.roundRobinIndexGoogle !== undefined || sender.provider === 'google' || sender.app_password) {
        console.log(`✅ Detected as Google account: ${sender.email}`);
        return 'google';
    }

    // Check for Microsoft user
    if (sender.roundRobinIndexMicrosoft !== undefined || sender.provider === 'microsoft' || sender.access_token) {
        console.log(`✅ Detected as Microsoft account: ${sender.email}`);
        return 'microsoft';
    }

    // Check for SMTP account
    if (sender.roundRobinIndexCustom !== undefined || sender.smtp_host) {
        console.log(`✅ Detected as SMTP account: ${sender.email}`);
        return 'smtp';
    }

    // Fallback: Check email domain
    if (sender.email && sender.email.endsWith('@gmail.com')) {
        console.log(`✅ Detected as Google account by domain: ${sender.email}`);
        return 'google';
    }

    if (sender.email && (sender.email.endsWith('@outlook.com') || sender.email.endsWith('@hotmail.com') || sender.email.endsWith('@live.com'))) {
        console.log(`✅ Detected as Microsoft account by domain: ${sender.email}`);
        return 'microsoft';
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
        hasSmtpPass: !!sender.smtp_pass
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
        if (!sender.access_token && !sender.app_password) {
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

    // custom SMTP/IMAP
    if (!sender.smtp_host || !sender.smtp_pass) {
        throw new Error(`❌ SMTP configuration required for custom account: ${sender.email}. Host: ${sender.smtp_host}, Pass: ${!!sender.smtp_pass}`);
    }

    const config = {
        ...base,
        smtpHost: sender.smtp_host,
        smtpPort: sender.smtp_port || 587,
        smtpUser: sender.smtp_user || sender.email,
        smtpPass: sender.smtp_pass,
        smtpEncryption: sender.smtp_encryption || 'TLS',
        imapHost: sender.imap_host,
        imapPort: sender.imap_port || 993,
        imapUser: sender.imap_user || sender.email,
        imapPass: sender.imap_pass || sender.smtp_pass,
        imapEncryption: sender.imap_encryption || 'SSL',
    };

    console.log(`✅ SMTP config built: ${config.smtpHost}:${config.smtpPort}`);
    return config;
}

module.exports = { buildSenderConfig, getSenderType };