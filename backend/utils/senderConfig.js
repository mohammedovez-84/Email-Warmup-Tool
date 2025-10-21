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

    // Check for explicit provider first
    if (sender.provider === 'google' || sender.roundRobinIndexGoogle !== undefined) {
        console.log(`✅ Detected as Google account (explicit): ${sender.email}`);
        return 'google';
    }
    if (sender.provider === 'microsoft' || sender.roundRobinIndexMicrosoft !== undefined) {
        console.log(`✅ Detected as Microsoft account (explicit): ${sender.email}`);
        return 'microsoft';
    }
    if (sender.provider === 'smtp' || sender.roundRobinIndexCustom !== undefined) {
        console.log(`✅ Detected as SMTP account (explicit): ${sender.email}`);
        return 'smtp';
    }

    // Check for credentials
    if (sender.app_password) {
        console.log(`✅ Detected as Google account (app_password): ${sender.email}`);
        return 'google';
    }
    if (sender.access_token) {
        console.log(`✅ Detected as Microsoft account (access_token): ${sender.email}`);
        return 'microsoft';
    }
    if (sender.smtp_host || sender.smtp_pass) {
        console.log(`✅ Detected as SMTP account (smtp_host): ${sender.email}`);
        return 'smtp';
    }

    // Fallback to email domain detection
    if (sender.email) {
        const domain = sender.email.toLowerCase();
        if (domain.endsWith('@gmail.com') || domain.endsWith('@googlemail.com')) {
            console.log(`✅ Detected as Google account by domain: ${sender.email}`);
            return 'google';
        }
        if (domain.endsWith('@outlook.com') || domain.endsWith('@hotmail.com') || domain.endsWith('@live.com')) {
            console.log(`✅ Detected as Microsoft account by domain: ${sender.email}`);
            return 'microsoft';
        }
        // For custom domains, default to SMTP
        console.log(`✅ Detected as SMTP account (custom domain): ${sender.email}`);
        return 'smtp';
    }

    console.log(`❓ Unknown account type for: ${sender.email}, defaulting to SMTP`);
    return 'smtp';
}

function buildSenderConfig(sender, senderType = null) {
    if (!sender) {
        throw new Error('❌ Sender object is required');
    }

    if (!senderType) {
        senderType = getSenderType(sender);
    }

    console.log(`🔧 Building sender config for: ${sender.email} (type: ${senderType})`);
    console.log(`📦 Sender data:`, {
        email: sender.email,
        hasAppPassword: !!sender.app_password,
        hasAccessToken: !!sender.access_token,
        hasSmtpPass: !!sender.smtp_pass,
        hasSmtpHost: !!sender.smtp_host,
        provider: sender.provider
    });

    const baseConfig = {
        userId: sender.userId || sender.user_id,
        name: sender.name || sender.sender_name || extractNameFromEmail(sender.email),
        email: sender.email,
        type: senderType,
        startEmailsPerDay: sender.startEmailsPerDay || 3,
        increaseEmailsPerDay: sender.increaseEmailsPerDay || 3,
        maxEmailsPerDay: sender.maxEmailsPerDay || 25,
        replyRate: sender.replyRate || 0.25,
        warmupDayCount: sender.warmupDayCount || 0,
        industry: sender.industry || 'general',
        provider: sender.provider || senderType
    };

    switch (senderType) {
        case 'google':
            // ✅ FIX: Check for app_password in the actual sender object
            if (!sender.app_password) {
                console.error(`❌ Google account ${sender.email} is missing app_password. Available fields:`, Object.keys(sender));
                throw new Error(`Google account ${sender.email} is missing app password. Please check your database.`);
            }

            return {
                ...baseConfig,
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
                app_password: sender.app_password // Include for reference
            };

        case 'microsoft':
            // ✅ FIX: Check for both access_token and app_password
            const microsoftAuth = sender.access_token || sender.app_password;
            if (!microsoftAuth) {
                console.error(`❌ Microsoft account ${sender.email} is missing both access_token and app_password. Available fields:`, Object.keys(sender));
                throw new Error(`Microsoft account ${sender.email} is missing credentials. Please check your database.`);
            }

            return {
                ...baseConfig,
                smtpHost: 'smtp.office365.com',
                smtpPort: 587,
                smtpUser: sender.email,
                smtpPass: microsoftAuth,
                smtpEncryption: 'STARTTLS',
                imapHost: 'outlook.office365.com',
                imapPort: 993,
                imapUser: sender.email,
                imapPass: microsoftAuth,
                imapEncryption: 'SSL',
                access_token: sender.access_token, // Include for reference
                app_password: sender.app_password // Include for reference
            };

        case 'smtp':
            // ✅ FIX: Use correct field names from your database model
            console.log(`🔧 SMTP account details for ${sender.email}:`, {
                smtp_host: sender.smtp_host,
                smtp_port: sender.smtp_port,
                smtp_user: sender.smtp_user,
                smtp_pass: sender.smtp_pass ? 'SET' : 'MISSING',
                imap_host: sender.imap_host,
                imap_port: sender.imap_port,
                imap_user: sender.imap_user,
                imap_pass: sender.imap_pass
            });

            // Use the exact field names from your database model
            const smtpHost = sender.smtp_host;
            const smtpUser = sender.smtp_user || sender.email;
            const smtpPass = sender.smtp_pass;
            const smtpPort = sender.smtp_port || 587;

            const imapHost = sender.imap_host || smtpHost?.replace('smtp', 'imap');
            const imapUser = sender.imap_user || smtpUser;
            const imapPass = sender.imap_pass || smtpPass;
            const imapPort = sender.imap_port || 993;

            // Validate required fields
            if (!smtpPass) {
                console.error(`❌ SMTP account ${sender.email} is missing smtp_pass`);
                throw new Error(`SMTP account ${sender.email} is missing SMTP password`);
            }

            if (!smtpHost) {
                console.error(`❌ SMTP account ${sender.email} is missing smtp_host`);
                throw new Error(`SMTP account ${sender.email} is missing SMTP host`);
            }

            console.log(`✅ SMTP config built: ${smtpHost}:${smtpPort}`);

            return {
                ...baseConfig,
                smtpHost: smtpHost,
                smtpPort: smtpPort,
                smtpUser: smtpUser,
                smtpPass: smtpPass,
                smtpEncryption: sender.smtp_encryption || 'TLS',
                imapHost: imapHost,
                imapPort: imapPort,
                imapUser: imapUser,
                imapPass: imapPass,
                imapEncryption: sender.imap_encryption || 'SSL'
            };

        default:
            throw new Error(`❌ Unsupported sender type: ${senderType}`);
    }
}

// ✅ ADD: Helper function to extract name from email
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
    extractNameFromEmail
};