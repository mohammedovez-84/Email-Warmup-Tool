function normalizeFieldNames(sender) {
    // Create a DEEP copy of the sender object
    const normalized = JSON.parse(JSON.stringify(sender));

    console.log(`🔄 Normalizing fields for ${sender.email}`);

    // Field mappings - CORRECTED: source → target
    const fieldMappings = {
        'appPassword': 'app_password',  // appPassword → app_password
        'smtpPassword': 'smtp_pass',    // smtpPassword → smtp_pass  
        'accessToken': 'access_token',   // accessToken → access_token
        'smtpHost': 'smtp_host',        // smtpHost → smtp_host
        'smtpPort': 'smtp_port',        // smtpPort → smtp_port
        'imapHost': 'imap_host',        // imapHost → imap_host
        'imapPort': 'imap_port',        // imapPort → imap_port
        'imapPassword': 'imap_pass',    // imapPassword → imap_pass
        'smtpUser': 'smtp_user',        // smtpUser → smtp_user
        'imapUser': 'imap_user',        // imapUser → imap_user
        'sender_name': 'name',          // sender_name → name
        'user_id': 'userId'             // user_id → userId
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
    // Check for pool accounts first
    if (sender.providerType) {
        const poolType = sender.providerType.toLowerCase();
        return poolType; // Return 'gmail', 'microsoft', or 'custom'
    }

    // Check for explicit provider
    if (sender.provider === 'google' || sender.roundRobinIndexGoogle !== undefined) {
        return 'google';
    }
    if (sender.provider === 'microsoft' || sender.roundRobinIndexMicrosoft !== undefined) {
        return 'microsoft';
    }
    if (sender.provider === 'smtp' || sender.roundRobinIndexCustom !== undefined) {
        return 'smtp';
    }

    // Check for credentials (using NORMALIZED field names)
    if (sender.app_password) {
        return 'google';
    }
    if (sender.access_token) {
        return 'microsoft';
    }
    if (sender.smtp_pass) {
        return 'smtp';
    }

    // Fallback to email domain detection
    if (sender.email) {
        const domain = sender.email.toLowerCase();
        if (domain.endsWith('@gmail.com') || domain.endsWith('@googlemail.com')) {
            return 'google';
        }
        if (domain.endsWith('@outlook.com') || domain.endsWith('@hotmail.com') || domain.endsWith('@live.com')) {
            return 'microsoft';
        }
    }

    return 'smtp';
}

function buildSenderConfig(sender, senderType = null) {
    if (!sender) {
        throw new Error('❌ Sender object is required');
    }

    // Normalize sender once
    const normalizedSender = normalizeFieldNames(sender);

    if (!senderType) {
        senderType = getSenderType(normalizedSender);
    }

    console.log(`🔧 Building config for: ${normalizedSender.email} (type: ${senderType})`);

    const baseConfig = {
        userId: normalizedSender.userId || normalizedSender.user_id,
        name: normalizedSender.name || normalizedSender.sender_name || extractNameFromEmail(normalizedSender.email),
        email: normalizedSender.email,
        type: senderType,
        startEmailsPerDay: normalizedSender.startEmailsPerDay || 3,
        increaseEmailsPerDay: normalizedSender.increaseEmailsPerDay || 3,
        maxEmailsPerDay: normalizedSender.maxEmailsPerDay || 25,
        replyRate: normalizedSender.replyRate || 0.25,
        warmupDayCount: normalizedSender.warmupDayCount || 0,
        industry: normalizedSender.industry || 'general',
        provider: normalizedSender.provider || senderType
    };

    switch (senderType) {
        case 'google':
            if (!normalizedSender.app_password) {
                throw new Error(`Google account ${normalizedSender.email} is missing app_password`);
            }

            return {
                ...baseConfig,
                smtpHost: 'smtp.gmail.com',
                smtpPort: 587,
                smtpUser: normalizedSender.email,
                smtpPass: normalizedSender.app_password,
                smtpEncryption: 'TLS',
                imapHost: 'imap.gmail.com',
                imapPort: 993,
                imapUser: normalizedSender.email,
                imapPass: normalizedSender.app_password,
                imapEncryption: 'SSL'
            };

        case 'microsoft':
            const microsoftAuth = normalizedSender.access_token || normalizedSender.app_password;
            if (!microsoftAuth) {
                throw new Error(`Microsoft account ${normalizedSender.email} is missing credentials`);
            }

            return {
                ...baseConfig,
                smtpHost: 'smtp.office365.com',
                smtpPort: 587,
                smtpUser: normalizedSender.email,
                smtpPass: microsoftAuth,
                smtpEncryption: 'STARTTLS',
                imapHost: 'outlook.office365.com',
                imapPort: 993,
                imapUser: normalizedSender.email,
                imapPass: microsoftAuth,
                imapEncryption: 'SSL'
            };

        case 'smtp':
        case 'custom':
            const smtpHost = normalizedSender.smtp_host;
            const smtpUser = normalizedSender.smtp_user || normalizedSender.email;
            const smtpPass = normalizedSender.smtp_pass || normalizedSender.smtpPassword;
            const smtpPort = normalizedSender.smtp_port || 587;

            const imapHost = normalizedSender.imap_host;
            const imapUser = normalizedSender.imap_user || normalizedSender.email;
            const imapPass = normalizedSender.imap_pass || normalizedSender.imapPassword || smtpPass;
            const imapPort = normalizedSender.imap_port || 993;

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
                smtpEncryption: normalizedSender.smtp_encryption || 'TLS',
                imapHost: imapHost,
                imapPort: imapPort,
                imapUser: imapUser,
                imapPass: imapPass,
                imapEncryption: normalizedSender.imap_encryption || 'SSL'
            };

        case 'gmail':
            // Pool Gmail accounts
            const gmailPassword = normalizedSender.app_password || normalizedSender.smtp_pass || normalizedSender.appPassword || normalizedSender.smtpPassword;
            if (!gmailPassword) {
                throw new Error(`Gmail pool account ${normalizedSender.email} is missing password`);
            }

            return {
                ...baseConfig,
                smtpHost: 'smtp.gmail.com',
                smtpPort: 587,
                smtpUser: normalizedSender.email,
                smtpPass: gmailPassword,
                smtpEncryption: 'TLS',
                imapHost: 'imap.gmail.com',
                imapPort: 993,
                imapUser: normalizedSender.email,
                imapPass: gmailPassword,
                imapEncryption: 'SSL'
            };

        case 'pool':
            // Handle pool accounts based on their actual provider type
            const actualProviderType = normalizedSender.providerType ? normalizedSender.providerType.toLowerCase() : 'gmail';

            switch (actualProviderType) {
                case 'gmail':
                    const poolGmailPassword = normalizedSender.app_password || normalizedSender.smtp_pass || normalizedSender.appPassword || normalizedSender.smtpPassword;
                    if (!poolGmailPassword) {
                        throw new Error(`Gmail pool account ${normalizedSender.email} is missing password`);
                    }

                    return {
                        ...baseConfig,
                        smtpHost: 'smtp.gmail.com',
                        smtpPort: 587,
                        smtpUser: normalizedSender.email,
                        smtpPass: poolGmailPassword,
                        smtpEncryption: 'TLS',
                        imapHost: 'imap.gmail.com',
                        imapPort: 993,
                        imapUser: normalizedSender.email,
                        imapPass: poolGmailPassword,
                        imapEncryption: 'SSL'
                    };

                case 'microsoft':
                    const poolMicrosoftAuth = normalizedSender.access_token || normalizedSender.app_password;
                    if (!poolMicrosoftAuth) {
                        throw new Error(`Microsoft pool account ${normalizedSender.email} is missing credentials`);
                    }

                    return {
                        ...baseConfig,
                        smtpHost: 'smtp.office365.com',
                        smtpPort: 587,
                        smtpUser: normalizedSender.email,
                        smtpPass: poolMicrosoftAuth,
                        smtpEncryption: 'STARTTLS',
                        imapHost: 'outlook.office365.com',
                        imapPort: 993,
                        imapUser: normalizedSender.email,
                        imapPass: poolMicrosoftAuth,
                        imapEncryption: 'SSL'
                    };

                case 'custom':
                    const poolSmtpHost = normalizedSender.smtp_host;
                    const poolSmtpUser = normalizedSender.smtp_user || normalizedSender.email;
                    const poolSmtpPass = normalizedSender.smtp_pass || normalizedSender.smtpPassword;
                    const poolSmtpPort = normalizedSender.smtp_port || 587;

                    const poolImapHost = normalizedSender.imap_host;
                    const poolImapUser = normalizedSender.imap_user || normalizedSender.email;
                    const poolImapPass = normalizedSender.imap_pass || normalizedSender.imapPassword || poolSmtpPass;
                    const poolImapPort = normalizedSender.imap_port || 993;

                    if (!poolSmtpPass) {
                        throw new Error(`Custom pool account ${normalizedSender.email} is missing SMTP password`);
                    }

                    if (!poolSmtpHost) {
                        throw new Error(`Custom pool account ${normalizedSender.email} is missing SMTP host`);
                    }

                    return {
                        ...baseConfig,
                        smtpHost: poolSmtpHost,
                        smtpPort: poolSmtpPort,
                        smtpUser: poolSmtpUser,
                        smtpPass: poolSmtpPass,
                        smtpEncryption: normalizedSender.smtp_encryption || 'TLS',
                        imapHost: poolImapHost,
                        imapPort: poolImapPort,
                        imapUser: poolImapUser,
                        imapPass: poolImapPass,
                        imapEncryption: normalizedSender.imap_encryption || 'SSL'
                    };

                default:
                    throw new Error(`Unsupported pool provider type: ${actualProviderType}`);
            }

        default:
            throw new Error(`Unsupported sender type: ${senderType}`);
    }
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
    normalizeFieldNames
};