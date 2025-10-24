const imaps = require('imap-simple');
const { sendEmail } = require('./emailSender');

function detectAccountType(account) {
    // Handle pool accounts properly
    if (account.providerType) {
        return account.providerType.toLowerCase();
    }

    // Handle regular accounts
    if (account.provider === 'google' || account.roundRobinIndexGoogle !== undefined || account.app_password) {
        return 'google';
    }
    if (account.provider === 'microsoft' || account.roundRobinIndexMicrosoft !== undefined || account.access_token) {
        return 'microsoft';
    }
    if (account.provider === 'smtp' || account.roundRobinIndexCustom !== undefined || account.smtp_host) {
        return 'smtp';
    }

    // Email domain fallback
    if (account.email) {
        const email = account.email.toLowerCase();
        if (email.endsWith('@gmail.com') || email.endsWith('@googlemail.com')) {
            return 'google';
        }
        if (email.endsWith('@outlook.com') || email.endsWith('@hotmail.com') || email.endsWith('@live.com') || email.endsWith('@microsoft.com')) {
            return 'microsoft';
        }
    }

    return 'smtp';
}

function getImapConfig(account) {
    const { email } = account;

    if (!email) {
        throw new Error('Email address is required for IMAP configuration');
    }

    // Determine account type
    const accountType = detectAccountType(account);

    const baseConfig = {
        imap: {
            user: email,
            host: '',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 30000,
            connTimeout: 45000,
            debug: process.env.NODE_ENV === 'development' ? console.log : undefined
        }
    };

    try {
        switch (accountType) {
            case 'google':
            case 'gmail':
                const gmailPassword = account.app_password || account.smtp_pass || account.smtpPassword;
                if (!gmailPassword) {
                    throw new Error(`Gmail account ${email} requires app_password`);
                }
                return {
                    imap: {
                        ...baseConfig.imap,
                        user: email,
                        password: gmailPassword,
                        host: 'imap.gmail.com',
                        port: 993
                    }
                };

            case 'microsoft':
                const microsoftAuth = account.access_token || account.app_password || account.smtp_pass || account.smtpPassword;
                if (!microsoftAuth) {
                    throw new Error(`Microsoft account ${email} requires access_token or app_password`);
                }
                return {
                    imap: {
                        ...baseConfig.imap,
                        user: email,
                        password: microsoftAuth,
                        host: 'outlook.office365.com',
                        port: 993
                    }
                };

            case 'smtp':
            case 'custom':
                const finalImapHost = account.imap_host || account.smtp_host;
                const finalImapUser = account.imap_user || account.smtp_user || email;
                const finalImapPass = account.imap_pass || account.smtp_pass || account.imapPassword || account.smtpPassword;

                if (!finalImapHost) {
                    throw new Error(`IMAP host required for SMTP account: ${email}`);
                }
                if (!finalImapPass) {
                    throw new Error(`IMAP password required for SMTP account: ${email}`);
                }

                return {
                    imap: {
                        ...baseConfig.imap,
                        user: finalImapUser,
                        password: finalImapPass,
                        host: finalImapHost,
                        port: account.imap_port || 993,
                        tls: account.imap_encryption !== 'None', // Disable TLS if encryption is None
                        tlsOptions: account.imap_encryption !== 'None' ? { rejectUnauthorized: false } : undefined
                    }
                };

            default:
                throw new Error(`Unsupported account type: ${accountType}`);
        }
    } catch (error) {
        console.error(`❌ IMAP config error for ${email}:`, error.message);
        throw error;
    }
}

async function checkEmailStatus(receiver, messageId) {
    let connection;

    try {
        console.log(`🔍 Checking email status for: ${messageId}`);
        const config = getImapConfig(receiver);
        connection = await imaps.connect(config);

        // Common folders to check with priority order
        const commonFolders = {
            google: ['INBOX', '[Gmail]/Important', '[Gmail]/All Mail', '[Gmail]/Spam'],
            microsoft: ['INBOX', 'Important', 'Junk', 'Spam'],
            smtp: ['INBOX', 'Spam', 'Junk', 'Bulk']
        };

        const provider = detectAccountType(receiver);
        const foldersToCheck = commonFolders[provider] || ['INBOX', 'Spam', 'Junk'];

        console.log(`   📁 Checking folders: ${foldersToCheck.join(', ')}`);

        for (const folder of foldersToCheck) {
            try {
                await connection.openBox(folder, false);
                const searchCriteria = [['HEADER', 'Message-ID', messageId]];
                const results = await connection.search(searchCriteria, { bodies: [''], struct: true });

                if (results.length > 0) {
                    console.log(`✅ Email found in: ${folder}`);
                    await connection.end();
                    return {
                        success: true,
                        folder: folder,
                        found: true,
                        deliveredInbox: folder === 'INBOX' || folder === 'Important' || folder === '[Gmail]/Important'
                    };
                }
            } catch (folderError) {
                console.log(`   ⚠️  Cannot access folder ${folder}: ${folderError.message}`);
                continue;
            }
        }

        console.log(`❌ Email not found in any folder: ${messageId}`);
        await connection.end();
        return {
            success: true,
            folder: 'NOT_FOUND',
            found: false,
            deliveredInbox: false
        };

    } catch (err) {
        console.error('❌ Error checking email status:', err.message);
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                console.error('   ⚠️  Error closing connection:', e.message);
            }
        }
        return {
            success: false,
            error: err.message,
            found: false,
            deliveredInbox: false
        };
    }
}

async function moveEmailToInbox(receiver, messageId, currentFolder) {
    let connection;

    try {
        console.log(`📦 Moving email from ${currentFolder} to INBOX: ${messageId}`);
        const config = getImapConfig(receiver);
        connection = await imaps.connect(config);

        // Open the current folder
        await connection.openBox(currentFolder, false);

        const searchCriteria = [['HEADER', 'Message-ID', messageId]];
        const results = await connection.search(searchCriteria, { bodies: [''], struct: true });

        if (results.length === 0) {
            await connection.end();
            return { success: false, error: 'Email not found in current folder' };
        }

        const uid = results[0].attributes.uid;

        // Move email to INBOX
        await connection.moveMessage(uid, 'INBOX');
        console.log(`✅ Email moved from ${currentFolder} to INBOX`);

        await connection.end();
        return {
            success: true,
            message: 'Email moved to INBOX'
        };

    } catch (err) {
        console.error('❌ Error moving email to inbox:', err.message);
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                console.error('   ⚠️  Error closing connection:', e.message);
            }
        }
        return {
            success: false,
            error: err.message
        };
    }
}

async function replyToEmail(account, options) {
    const { to, subject, html, inReplyTo, references } = options;

    try {
        console.log(`📨 Sending reply from ${account.email} to ${to}`);

        const replyResult = await sendEmail(account, {
            to,
            subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
            html,
            inReplyTo: inReplyTo,
            references: references || [inReplyTo]
        });

        if (replyResult.success) {
            console.log(`✅ Reply sent successfully to: ${to}`);
        } else {
            console.error(`❌ Reply failed: ${replyResult.error}`);
        }

        return replyResult;

    } catch (error) {
        console.error('❌ Error sending reply:', error.message);
        throw error;
    }
}

async function markEmailAsSeenAndFlagged(account, messageId) {
    let connection;

    try {
        console.log(`🏷️  Marking email as seen and flagged: ${messageId}`);
        const config = getImapConfig(account);
        connection = await imaps.connect(config);
        await connection.openBox('INBOX', false);

        const searchCriteria = [['HEADER', 'Message-ID', messageId]];
        const results = await connection.search(searchCriteria, { bodies: [''], struct: true });

        if (results.length > 0) {
            const uid = results[0].attributes.uid;
            await connection.imap.addFlags(uid, ['\\Seen', '\\Flagged']);
            console.log(`✅ Email marked as Seen + Flagged`);
        } else {
            console.log(`⚠️  Email not found to mark as seen: ${messageId}`);
        }

        await connection.end();
        return { success: true };

    } catch (err) {
        console.error(`❌ Error marking email: ${err.message}`);
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                console.error('   ⚠️  Error closing connection:', e.message);
            }
        }
        return { success: false, error: err.message };
    }
}

async function testImapConnection(account) {
    let connection;

    try {
        console.log(`🔌 Testing IMAP connection for: ${account.email}`);
        const config = getImapConfig(account);
        connection = await imaps.connect(config);

        await connection.openBox('INBOX', false);

        // Test folder listing to verify full access
        const boxes = await connection.getBoxes();
        console.log(`   📂 Available folders: ${Object.keys(boxes).join(', ')}`);

        await connection.end();

        console.log(`✅ IMAP connection successful for: ${account.email}`);
        return {
            success: true,
            message: 'IMAP connection successful',
            folders: Object.keys(boxes).length
        };

    } catch (error) {
        console.error(`❌ IMAP connection failed for ${account.email}:`, error.message);
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                console.error('   ⚠️  Error closing connection:', e.message);
            }
        }
        return {
            success: false,
            error: error.message,
            details: 'Check credentials and IMAP settings'
        };
    }
}

// Helper function to get mailbox statistics
async function getMailboxStats(account) {
    let connection;

    try {
        const config = getImapConfig(account);
        connection = await imaps.connect(config);
        await connection.openBox('INBOX', false);

        const status = await connection.status('INBOX', { messages: true, recent: true, unseen: true });

        await connection.end();

        return {
            success: true,
            totalMessages: status.messages,
            recentMessages: status.recent,
            unseenMessages: status.unseen
        };

    } catch (error) {
        console.error(`❌ Error getting mailbox stats: ${error.message}`);
        if (connection) {
            try {
                await connection.end();
            } catch (e) { }
        }
        return { success: false, error: error.message };
    }
}

module.exports = {
    getImapConfig,
    checkEmailStatus,
    moveEmailToInbox,
    replyToEmail,
    markEmailAsSeenAndFlagged,
    testImapConnection,
    detectAccountType,
    getMailboxStats
};  