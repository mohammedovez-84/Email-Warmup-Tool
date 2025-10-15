// utils/senderConfig.js

function buildSenderConfig(sender, senderType) {
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
    };

    if (senderType === 'google') {
        return {
            ...base,
            smtpHost: 'smtp.gmail.com',
            smtpPort: 465,
            smtpUser: sender.email,
            smtpPass: sender.app_password,
            smtpEncryption: 'SSL',
            imapHost: 'imap.gmail.com',
            imapPort: 993,
            imapUser: sender.email,
            imapPass: sender.app_password,
            imapEncryption: 'SSL',
        };
    }

    if (senderType === 'microsoft') {
        return {
            ...base,
            smtpHost: 'smtp.office365.com',
            smtpPort: 587,
            smtpUser: sender.email,
            smtpPass: null,
            smtpEncryption: 'STARTTLS',
            imapHost: 'outlook.office365.com',
            imapPort: 993,
            imapUser: sender.email,
            imapPass: null,
            imapEncryption: 'SSL',
            refreshToken: sender.refresh_token,
            accessToken: sender.access_token,
            expiresAt: sender.expires_at,
        };
    }

    // custom SMTP/IMAP
    return {
        ...base,
        smtpHost: sender.smtp_host,
        smtpPort: sender.smtp_port,
        smtpUser: sender.email,
        smtpPass: sender.smtp_pass,
        smtpEncryption: sender.smtp_encryption,
        imapHost: sender.imap_host,
        imapPort: sender.imap_port,
        imapUser: sender.imap_user,
        imapPass: sender.imap_pass,
        imapEncryption: sender.imap_encryption,
    };
}

module.exports = { buildSenderConfig };