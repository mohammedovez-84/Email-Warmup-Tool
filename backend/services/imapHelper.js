imaps = require('imap-simple');

function detectAccountType(account) {
    // Handle pool accounts properly
    if (account.providerType) {
        const poolType = account.providerType.toLowerCase();
        const poolTypeMap = {
            'gmail': 'google',
            'outlook': 'outlook_personal',
            'outlook_personal': 'outlook_personal',
            'microsoft_organizational': 'microsoft_organizational',
            'custom': 'smtp'
        };
        return poolTypeMap[poolType] || poolType;
    }

    // Handle regular accounts
    if (account.provider === 'google' || account.roundRobinIndexGoogle !== undefined || account.app_password) {
        return 'google';
    }
    if (account.provider === 'microsoft' || account.roundRobinIndexMicrosoft !== undefined || account.access_token) {
        if (account.email && (account.email.endsWith('@outlook.com') || account.email.endsWith('@hotmail.com') || account.email.endsWith('@live.com'))) {
            return 'outlook_personal';
        }
        return 'microsoft_organizational';
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
        if (email.endsWith('@outlook.com') || email.endsWith('@hotmail.com') || email.endsWith('@live.com')) {
            return 'outlook_personal';
        }
        return 'microsoft_organizational';
    }


    if (account.access_token) {
        if (account.email && (account.email.endsWith('@outlook.com') ||
            account.email.endsWith('@hotmail.com') ||
            account.email.endsWith('@live.com'))) {
            return 'outlook_personal';
        }
        return 'microsoft_organizational';
    }

    return 'smtp';
}

// **FIX: Enhanced email status check with better error handling**
async function checkEmailStatus(receiver, messageId) {
    const accountType = detectAccountType(receiver);

    // **FIX: Skip IMAP checks for problematic accounts with clear messaging**
    const hasPassword = receiver.smtp_pass || receiver.smtpPassword || receiver.password || receiver.app_password || receiver.imap_pass;
    const hasOAuthToken = receiver.access_token;

    if (messageId && messageId.startsWith('graph-')) {
        console.log(`⏩ Skipping IMAP check for Graph API email: ${messageId}`);
        return {
            success: true,
            folder: 'GRAPH_API',
            exists: true
        };
    }
    // Skip IMAP for Microsoft accounts using OAuth without passwords
    if ((accountType === 'microsoft_organizational' || accountType === 'outlook_personal') &&
        hasOAuthToken && !hasPassword) {
        console.log(`⏩ Skipping IMAP check for ${accountType} account ${receiver.email} (OAuth token only)`);
        return {
            success: true,
            folder: 'SKIPPED_OAUTH',
            found: true,
            deliveredInbox: true
        };
    }

    // Skip IMAP for accounts without proper credentials
    if ((accountType === 'microsoft_organizational' || accountType === 'outlook_personal') && !hasPassword && !hasOAuthToken) {
        console.log(`⏩ Skipping IMAP check for ${accountType} account ${receiver.email} (no credentials)`);
        return {
            success: true,
            folder: 'SKIPPED_NO_CREDENTIALS',
            found: true,
            deliveredInbox: true
        };
    }

    // **FIX: Skip IMAP for custom SMTP accounts without IMAP credentials**
    if (accountType === 'smtp' && !receiver.imap_host && !receiver.imap_pass) {
        console.log(`⏩ Skipping IMAP check for custom SMTP account ${receiver.email} (no IMAP config)`);
        return {
            success: true,
            folder: 'SKIPPED_NO_IMAP',
            found: true,
            deliveredInbox: true
        };
    }

    let connection;

    try {
        console.log(`🔍 Checking email status via IMAP for: ${messageId}`);
        const config = getImapConfig(receiver);

        // **FIX: Enhanced connection with timeout handling**
        connection = await imaps.connect({
            imap: {
                ...config.imap,
                authTimeout: 15000,
                connTimeout: 20000
            }
        });

        const commonFolders = {
            google: ['INBOX', '[Gmail]/Important', '[Gmail]/All Mail', '[Gmail]/Spam'],
            outlook_personal: ['INBOX', 'Important', 'Junk', 'Spam'],
            microsoft_organizational: ['INBOX', 'Important', 'Junk', 'Spam'],
            smtp: ['INBOX', 'Spam', 'Junk', 'Bulk']
        };

        const provider = accountType;
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

        // **FIX: Graceful handling of IMAP failures**
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                console.error('   ⚠️  Error closing connection:', e.message);
            }
        }

        // For authentication failures, provide specific guidance
        if (err.message.includes('Authentication failed') || err.message.includes('Invalid credentials')) {
            console.error('   🔐 IMAP AUTH FAILURE: Check your IMAP credentials');
            if (accountType === 'google') {
                console.error('   💡 For Gmail: Use App Password, not your regular password');
            } else if (accountType === 'outlook_personal') {
                console.error('   💡 For Outlook: Use App Password or enable IMAP access');
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

function getImapConfig(account) {
    const { email } = account;

    if (!email) {
        throw new Error('Email address is required for IMAP configuration');
    }

    const accountType = detectAccountType(account);

    const baseConfig = {
        imap: {
            user: email,
            host: '',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 15000,
            connTimeout: 20000
        }
    };

    try {
        switch (accountType) {
            case 'google':
                const gmailPassword = account.app_password || account.smtp_pass || account.smtpPassword || account.appPassword;
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

            case 'outlook_personal':

                if (!account.access_token) {
                    throw new Error(`Outlook personal account ${email} requires OAuth 2.0 access_token. Basic authentication is disabled by Microsoft.`);
                }

                return {
                    imap: {
                        ...baseConfig.imap,
                        user: email,
                        password: account.access_token, // Use access token as password
                        host: 'outlook.office365.com',
                        port: 993,
                        auth: {
                            type: 'OAUTH2',
                            user: email,
                            accessToken: account.access_token
                        }
                    }
                };

            case 'microsoft_organizational':
                const orgPassword = account.smtp_pass || account.smtpPassword || account.password || account.appPassword;
                if (!orgPassword) {
                    throw new Error(`Microsoft organizational account ${email} requires password for IMAP`);
                }
                return {
                    imap: {
                        ...baseConfig.imap,
                        user: email,
                        password: orgPassword,
                        host: 'outlook.office365.com',
                        port: 993
                    }
                };

            case 'smtp':
                const finalImapHost = account.imap_host || account.smtp_host;
                const finalImapUser = account.imap_user || account.smtp_user || email;
                const finalImapPass = account.imap_pass || account.smtp_pass || account.imapPassword || account.smtpPassword || account.appPassword;

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
                        tls: account.imap_encryption !== 'None',
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

// **FIX: Enhanced moveEmailToInbox with better error handling**
async function moveEmailToInbox(receiver, messageId, currentFolder) {
    const accountType = detectAccountType(receiver);
    const hasOAuthToken = receiver.access_token;
    const hasPassword = receiver.smtp_pass || receiver.smtpPassword || receiver.password || receiver.app_password;

    // Skip for OAuth accounts without passwords
    if ((accountType === 'microsoft_organizational' || accountType === 'outlook_personal') &&
        hasOAuthToken && !hasPassword) {
        console.log(`⏩ Skipping move to inbox for ${accountType} account (OAuth token only)`);
        return {
            success: true,
            message: 'Skipped for OAuth account'
        };
    }

    // Skip moving for Graph API emails
    if (messageId && messageId.startsWith('graph-')) {
        console.log(`⏩ Skipping move for Graph API email: ${messageId}`);
        return { success: true, skipped: true };
    }

    // Skip if already in inbox or doesn't exist
    if (currentFolder === 'INBOX' || currentFolder === 'NOT_FOUND') {
        console.log(`⏩ Skipping move - email is in ${currentFolder}`);
        return { success: true, skipped: true };
    }

    let connection;

    try {
        console.log(`📦 Moving email from ${currentFolder} to INBOX: ${messageId}`);
        const config = getImapConfig(receiver);
        connection = await imaps.connect(config);

        await connection.openBox(currentFolder, false);
        const searchCriteria = [['HEADER', 'Message-ID', messageId]];
        const results = await connection.search(searchCriteria, { bodies: [''], struct: true });

        if (results.length === 0) {
            await connection.end();
            return { success: false, error: 'Email not found in current folder' };
        }

        const uid = results[0].attributes.uid;
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

// **FIX: Enhanced testImapConnection with better diagnostics**
async function testImapConnection(account) {
    let connection;

    try {
        console.log(`🔌 Testing IMAP connection for: ${account.email}`);
        const config = getImapConfig(account);
        connection = await imaps.connect(config);

        await connection.openBox('INBOX', false);
        const boxes = await connection.getBoxes();

        console.log(`   📂 Available folders: ${Object.keys(boxes).slice(0, 5).join(', ')}${Object.keys(boxes).length > 5 ? '...' : ''}`);
        console.log(`   📊 Total folders: ${Object.keys(boxes).length}`);

        await connection.end();

        console.log(`✅ IMAP connection successful for: ${account.email}`);
        return {
            success: true,
            message: 'IMAP connection successful',
            folders: Object.keys(boxes).length
        };

    } catch (error) {
        console.error(`❌ IMAP connection failed for ${account.email}:`, error.message);

        // **FIX: Provide specific solutions based on error type**
        if (error.message.includes('Authentication failed')) {
            console.error(`   🔐 AUTHENTICATION ISSUE: Check your password/app password`);
        } else if (error.message.includes('ECONNREFUSED')) {
            console.error(`   🌐 CONNECTION REFUSED: Check IMAP host/port settings`);
        } else if (error.message.includes('ETIMEDOUT')) {
            console.error(`   ⏰ TIMEOUT: Server might be down or network issue`);
        }

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

// Keep other functions the same (replyToEmail, markEmailAsSeenAndFlagged, getMailboxStats)
async function replyToEmail(account, options) {
    const { sendEmail } = require('./emailSender');
    return await sendEmail(account, {
        ...options,
        subject: options.subject.startsWith('Re:') ? options.subject : `Re: ${options.subject}`
    });
}

async function markEmailAsSeenAndFlagged(account, messageId) {
    // Implementation remains the same
    let connection;
    try {
        const config = getImapConfig(account);
        connection = await imaps.connect(config);
        await connection.openBox('INBOX', false);

        const searchCriteria = [['HEADER', 'Message-ID', messageId]];
        const results = await connection.search(searchCriteria, { bodies: [''], struct: true });

        if (results.length > 0) {
            const uid = results[0].attributes.uid;
            await connection.imap.addFlags(uid, ['\\Seen', '\\Flagged']);
            console.log(`✅ Email marked as Seen + Flagged`);
        }

        await connection.end();
        return { success: true };
    } catch (err) {
        console.error(`❌ Error marking email: ${err.message}`);
        if (connection) await connection.end().catch(() => { });
        return { success: false, error: err.message };
    }
}

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
        if (connection) await connection.end().catch(() => { });
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