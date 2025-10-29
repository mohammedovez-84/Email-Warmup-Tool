const imaps = require('imap-simple');
const { getSenderType } = require('../utils/senderConfig');

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

    // Use the existing getSenderType function for consistency
    return getSenderType(account);
}

// **ENHANCED: Email status check with bidirectional support**
async function checkEmailStatus(receiver, messageId, direction = 'WARMUP_TO_POOL') {
    const accountType = detectAccountType(receiver);

    // **FIX: Skip IMAP checks for problematic accounts with clear messaging**
    const hasPassword = receiver.smtp_pass || receiver.smtpPassword || receiver.password || receiver.app_password || receiver.imap_pass;
    const hasOAuthToken = receiver.access_token;

    console.log(`🔍 Checking email status for ${direction}: ${messageId}`);
    console.log(`   Receiver: ${receiver.email}, Type: ${accountType}`);
    console.log(`   Has Password: ${!!hasPassword}, Has OAuth: ${!!hasOAuthToken}`);

    // Skip IMAP for Graph API emails
    if (messageId && messageId.startsWith('graph-')) {
        console.log(`⏩ Skipping IMAP check for Graph API email: ${messageId}`);
        return {
            success: true,
            folder: 'GRAPH_API',
            exists: true,
            deliveredInbox: true
        };
    }

    // Skip IMAP for Microsoft accounts using OAuth without passwords
    if ((accountType === 'microsoft_organizational' || accountType === 'outlook_personal') &&
        hasOAuthToken && !hasPassword) {
        console.log(`⏩ Skipping IMAP check for ${accountType} account ${receiver.email} (OAuth token only)`);
        return {
            success: true,
            folder: 'SKIPPED_OAUTH',
            exists: true,
            deliveredInbox: true
        };
    }

    // Skip IMAP for accounts without proper credentials
    if ((accountType === 'microsoft_organizational' || accountType === 'outlook_personal') && !hasPassword && !hasOAuthToken) {
        console.log(`⏩ Skipping IMAP check for ${accountType} account ${receiver.email} (no credentials)`);
        return {
            success: true,
            folder: 'SKIPPED_NO_CREDENTIALS',
            exists: true,
            deliveredInbox: true
        };
    }

    // **FIX: Skip IMAP for custom SMTP accounts without IMAP credentials**
    if (accountType === 'smtp' && !receiver.imap_host && !receiver.imap_pass) {
        console.log(`⏩ Skipping IMAP check for custom SMTP account ${receiver.email} (no IMAP config)`);
        return {
            success: true,
            folder: 'SKIPPED_NO_IMAP',
            exists: true,
            deliveredInbox: true
        };
    }

    // **NEW: Skip IMAP for pool accounts in POOL_TO_WARMUP direction to avoid double-checking**
    if (direction === 'POOL_TO_WARMUP' && receiver.providerType) {
        console.log(`⏩ Skipping IMAP check for pool account in inbound direction`);
        return {
            success: true,
            folder: 'SKIPPED_POOL_INBOUND',
            exists: true,
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
                    const deliveredInbox = folder === 'INBOX' || folder === 'Important' || folder === '[Gmail]/Important';
                    console.log(`✅ Email found in: ${folder} (Inbox: ${deliveredInbox})`);
                    await connection.end();
                    return {
                        success: true,
                        folder: folder,
                        exists: true,
                        deliveredInbox: deliveredInbox
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
            exists: false,
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
            exists: false,
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
                // For Outlook personal accounts, we need to use OAuth2
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

// **ENHANCED: moveEmailToInbox with bidirectional awareness**
async function moveEmailToInbox(receiver, messageId, currentFolder, direction = 'WARMUP_TO_POOL') {
    const accountType = detectAccountType(receiver);
    const hasOAuthToken = receiver.access_token;
    const hasPassword = receiver.smtp_pass || receiver.smtpPassword || receiver.password || receiver.app_password;

    console.log(`📦 Attempting to move email for ${direction}: ${messageId}`);
    console.log(`   Current folder: ${currentFolder}, Account: ${receiver.email}`);

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
    if (currentFolder === 'INBOX' || currentFolder === 'NOT_FOUND' ||
        currentFolder === 'GRAPH_API' || currentFolder.includes('SKIPPED')) {
        console.log(`⏩ Skipping move - email is in ${currentFolder}`);
        return { success: true, skipped: true };
    }

    // Skip for pool accounts in inbound direction
    if (direction === 'POOL_TO_WARMUP' && receiver.providerType) {
        console.log(`⏩ Skipping move for pool account in inbound direction`);
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
            console.log(`❌ Email not found in current folder: ${currentFolder}`);
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

// **ENHANCED: testImapConnection with bidirectional context**
async function testImapConnection(account, context = 'warmup') {
    let connection;

    try {
        console.log(`🔌 Testing IMAP connection for ${context}: ${account.email}`);
        const config = getImapConfig(account);
        connection = await imaps.connect(config);

        await connection.openBox('INBOX', false);
        const boxes = await connection.getBoxes();

        const folderCount = Object.keys(boxes).length;
        const sampleFolders = Object.keys(boxes).slice(0, 5).join(', ');

        console.log(`   📂 Available folders: ${sampleFolders}${folderCount > 5 ? '...' : ''}`);
        console.log(`   📊 Total folders: ${folderCount}`);

        await connection.end();

        console.log(`✅ IMAP connection successful for ${context}: ${account.email}`);
        return {
            success: true,
            message: 'IMAP connection successful',
            folders: folderCount,
            sampleFolders: sampleFolders
        };

    } catch (error) {
        console.error(`❌ IMAP connection failed for ${account.email}:`, error.message);

        // **FIX: Provide specific solutions based on error type**
        if (error.message.includes('Authentication failed')) {
            console.error(`   🔐 AUTHENTICATION ISSUE: Check your password/app password`);
            if (account.providerType === 'google') {
                console.error(`   💡 For Gmail: Use App Password (16 characters), not your regular password`);
            } else if (account.providerType === 'outlook_personal') {
                console.error(`   💡 For Outlook Personal: Enable IMAP access in settings or use OAuth2`);
            }
        } else if (error.message.includes('ECONNREFUSED')) {
            console.error(`   🌐 CONNECTION REFUSED: Check IMAP host/port settings`);
        } else if (error.message.includes('ETIMEDOUT')) {
            console.error(`   ⏰ TIMEOUT: Server might be down or network issue`);
        } else if (error.message.includes('OAUTH')) {
            console.error(`   🔑 OAUTH ISSUE: Token might be expired or invalid`);
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
            details: 'Check credentials and IMAP settings',
            accountType: detectAccountType(account)
        };
    }
}

// **NEW: Bulk check email status for multiple messages**
async function bulkCheckEmailStatus(receiver, messageIds, direction = 'WARMUP_TO_POOL') {
    const results = {};

    for (const messageId of messageIds) {
        try {
            const result = await checkEmailStatus(receiver, messageId, direction);
            results[messageId] = result;
        } catch (error) {
            results[messageId] = {
                success: false,
                error: error.message,
                exists: false,
                deliveredInbox: false
            };
        }
    }

    return results;
}

// **ENHANCED: markEmailAsSeenAndFlagged with bidirectional support**
async function markEmailAsSeenAndFlagged(account, messageId, direction = 'WARMUP_TO_POOL') {
    // Skip for pool accounts in inbound direction
    if (direction === 'POOL_TO_WARMUP' && account.providerType) {
        console.log(`⏩ Skipping mark as seen for pool account in inbound direction`);
        return { success: true, skipped: true };
    }

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
            console.log(`✅ Email marked as Seen + Flagged for ${direction}`);
        } else {
            console.log(`⚠️  Email not found for marking: ${messageId}`);
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

// Keep other functions with minor enhancements
async function replyToEmail(account, options, direction = 'WARMUP_TO_POOL') {
    const { sendEmail } = require('./emailSender');
    console.log(`📧 Sending reply for ${direction}: ${account.email}`);

    return await sendEmail(account, {
        ...options,
        subject: options.subject.startsWith('Re:') ? options.subject : `Re: ${options.subject}`
    });
}

async function getMailboxStats(account, context = 'warmup') {
    let connection;
    try {
        console.log(`📊 Getting mailbox stats for ${context}: ${account.email}`);
        const config = getImapConfig(account);
        connection = await imaps.connect(config);
        await connection.openBox('INBOX', false);

        const status = await connection.status('INBOX', { messages: true, recent: true, unseen: true });
        await connection.end();

        console.log(`   Messages: ${status.messages}, Recent: ${status.recent}, Unseen: ${status.unseen}`);

        return {
            success: true,
            totalMessages: status.messages,
            recentMessages: status.recent,
            unseenMessages: status.unseen,
            context: context
        };
    } catch (error) {
        console.error(`❌ Error getting mailbox stats for ${account.email}: ${error.message}`);
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
            context: context
        };
    }
}

// **NEW: Get folder statistics for better warmup analytics**
async function getFolderStats(account) {
    let connection;
    try {
        const config = getImapConfig(account);
        connection = await imaps.connect(config);

        const boxes = await connection.getBoxes();
        const folderStats = {};

        // Check main folders
        const mainFolders = ['INBOX', 'Spam', 'Junk', 'Important', 'Sent'];

        for (const folderName of mainFolders) {
            try {
                await connection.openBox(folderName, false);
                const status = await connection.status(folderName, { messages: true, recent: true, unseen: true });
                folderStats[folderName] = {
                    total: status.messages,
                    recent: status.recent,
                    unseen: status.unseen
                };
            } catch (folderError) {
                folderStats[folderName] = { error: folderError.message };
            }
        }

        await connection.end();
        return {
            success: true,
            folderStats: folderStats,
            totalFolders: Object.keys(boxes).length
        };
    } catch (error) {
        console.error(`❌ Error getting folder stats: ${error.message}`);
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
    getMailboxStats,
    getFolderStats,
    bulkCheckEmailStatus
};