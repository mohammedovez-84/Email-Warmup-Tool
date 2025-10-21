const imaps = require('imap-simple');
const { sendEmail } = require('./emailSender');

/**
 * Enhanced account type detection
 */
function detectAccountType(account) {
    // Check for explicit provider first
    if (account.provider) {
        return account.provider;
    }

    // Check for platform-specific indicators
    if (account.roundRobinIndexGoogle !== undefined || account.app_password) {
        return 'google';
    }
    if (account.roundRobinIndexMicrosoft !== undefined || account.access_token) {
        return 'microsoft';
    }
    if (account.roundRobinIndexCustom !== undefined || account.smtp_host) {
        return 'smtp';
    }

    // Fallback to email domain detection
    if (account.email) {
        const email = account.email.toLowerCase();
        if (email.endsWith('@gmail.com') || email.endsWith('@googlemail.com')) {
            return 'google';
        }
        if (email.endsWith('@outlook.com') || email.endsWith('@hotmail.com') || email.endsWith('@live.com')) {
            return 'microsoft';
        }
    }

    // Default to SMTP for custom domains
    return 'smtp';
}

/**
 * Create IMAP config based on account type with enhanced error handling
 */
function getImapConfig(account) {
    const {
        email,
        imapHost,
        imapPort,
        imapUser,
        imapPass,
        smtp_host,
        smtp_pass,
        provider
    } = account;

    if (!email) {
        throw new Error('Email address is required for IMAP configuration');
    }

    // Determine account type
    const accountType = detectAccountType(account);
    console.log(`🔧 IMAP Config for ${email}: detected as ${accountType}`);

    const baseConfig = {
        imap: {
            user: imapUser || email,
            host: '',
            port: imapPort || 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 15000,
            connTimeout: 30000
        }
    };

    try {
        switch (accountType) {
            case 'google':
                if (!account.app_password) {
                    throw new Error(`Google account ${email} requires app_password`);
                }
                return {
                    imap: {
                        ...baseConfig.imap,
                        user: email,
                        password: account.app_password,
                        host: 'imap.gmail.com',
                        port: 993
                    }
                };

            case 'microsoft':
                const microsoftAuth = account.access_token || account.app_password;
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
                // ✅ FIX: Better SMTP IMAP configuration
                const finalImapHost = imapHost || smtp_host; // Use SMTP host if IMAP host not set
                const finalImapUser = imapUser || email;
                const finalImapPass = imapPass || smtp_pass;

                if (!finalImapHost) {
                    throw new Error(`IMAP host required for SMTP account: ${email}`);
                }
                if (!finalImapPass) {
                    throw new Error(`IMAP password required for SMTP account: ${email}`);
                }

                console.log(`✅ SMTP IMAP config: ${finalImapHost}:${imapPort || 993}`);

                return {
                    imap: {
                        ...baseConfig.imap,
                        user: finalImapUser,
                        password: finalImapPass,
                        host: finalImapHost,
                        port: imapPort || 993
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

/**
 * Enhanced email status checking with better folder detection
 */
async function checkEmailStatus(receiver, messageId) {
    let connection;

    try {
        console.log(`🔍 Checking email status for: ${messageId}`);
        const config = getImapConfig(receiver);
        connection = await imaps.connect(config);

        // Common folders to check (platform-specific)
        const commonFolders = {
            google: ['INBOX', '[Gmail]/Spam', '[Gmail]/Important', '[Gmail]/All Mail'],
            microsoft: ['INBOX', 'Junk', 'Spam', 'Important'],
            smtp: ['INBOX', 'Spam', 'Junk', 'Bulk']
        };

        const provider = detectAccountType(receiver);
        const foldersToCheck = commonFolders[provider] || ['INBOX', 'Spam', 'Junk'];

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
                        deliveredInbox: folder === 'INBOX'
                    };
                }
            } catch (folderError) {
                // Folder doesn't exist or can't be accessed, continue to next
                console.log(`⚠️ Cannot access folder ${folder}: ${folderError.message}`);
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
                console.error('Error closing connection:', e.message);
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

/**
 * Enhanced email moving with retry logic
 */
async function moveEmailToInbox(receiver, messageId, currentFolder) {
    let connection;
    let inboxConnection;

    try {
        console.log(`📦 Attempting to move email from ${currentFolder} to INBOX for: ${messageId}`);
        const config = getImapConfig(receiver);
        connection = await imaps.connect(config);

        // Open the current folder
        await connection.openBox(currentFolder, false);

        const searchCriteria = [['HEADER', 'Message-ID', messageId]];
        const results = await connection.search(searchCriteria, { bodies: [''], struct: true });

        if (results.length === 0) {
            console.log(`❌ Email not found in ${currentFolder}`);
            await connection.end();
            return { success: false, error: 'Email not found in current folder' };
        }

        const uid = results[0].attributes.uid;

        // Move email to INBOX
        await connection.moveMessage(uid, 'INBOX');
        console.log(`✅ Successfully moved message to INBOX`);

        // Close the first connection
        await connection.end();
        connection = null;

        // Wait a moment for the move to propagate
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Reconnect to mark as seen and flagged in INBOX
        inboxConnection = await imaps.connect(config);
        await inboxConnection.openBox('INBOX', false);

        const inboxSearch = [['HEADER', 'Message-ID', messageId]];
        const inboxResults = await inboxConnection.search(inboxSearch, { bodies: [''], struct: true });

        if (inboxResults.length > 0) {
            const inboxUid = inboxResults[0].attributes.uid;
            await inboxConnection.imap.addFlags(inboxUid, ['\\Seen', '\\Flagged']);
            console.log('✅ Marked as Seen + Flagged in INBOX after moving');
        } else {
            console.log('⚠️ Email not found in INBOX after move (might need more time to propagate)');
        }

        await inboxConnection.end();

        return {
            success: true,
            message: 'Email moved to INBOX and marked as seen/flagged'
        };

    } catch (err) {
        console.error('❌ Error moving email to inbox:', err.message);

        // Clean up connections
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                console.error('Error closing connection:', e.message);
            }
        }
        if (inboxConnection) {
            try {
                await inboxConnection.end();
            } catch (e) {
                console.error('Error closing inbox connection:', e.message);
            }
        }

        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Enhanced reply function with better header handling
 */
async function replyToEmail(account, options) {
    const { to, subject, html, inReplyTo, references } = options;

    try {
        const replyResult = await sendEmail(account, {
            to,
            subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
            html,
            headers: {
                'In-Reply-To': inReplyTo,
                'References': references ? references.join(' ') : inReplyTo
            }
        });

        console.log(`✅ Reply sent successfully to: ${to}`);
        return replyResult;

    } catch (error) {
        console.error('❌ Error sending reply:', error.message);
        throw error;
    }
}

/**
 * Mark email as seen and flagged (used for sender-side tracking)
 */
async function markEmailAsSeenAndFlagged(account, messageId) {
    let connection;

    try {
        console.log(`🏷️ Marking email as seen/flagged: ${messageId}`);
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
            console.log(`⚠️ Email not found in INBOX for marking: ${messageId}`);
        }

        await connection.end();
        return { success: true };

    } catch (err) {
        console.error(`❌ Error marking email as seen/flagged: ${err.message}`);
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                console.error('Error closing connection:', e.message);
            }
        }
        return { success: false, error: err.message };
    }
}

/**
 * Test IMAP connection for an account
 */
async function testImapConnection(account) {
    let connection;

    try {
        console.log(`🧪 Testing IMAP connection for: ${account.email}`);
        const config = getImapConfig(account);
        connection = await imaps.connect(config);

        // Try to open INBOX to verify access
        await connection.openBox('INBOX', false);
        await connection.end();

        console.log(`✅ IMAP connection successful for: ${account.email}`);
        return { success: true, message: 'IMAP connection successful' };

    } catch (error) {
        console.error(`❌ IMAP connection failed for ${account.email}:`, error.message);
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                // Ignore cleanup errors
            }
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
    detectAccountType
};