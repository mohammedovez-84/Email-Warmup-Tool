const imaps = require('imap-simple');
const { sendEmail } = require('./emailSender');

/**
 * Create IMAP config based on account type
 */
function getImapConfig(account) {
    const { email, password, app_password, provider, accessToken, imapHost, imapPort } = account;

    if (!provider) throw new Error(`Provider not defined for account: ${email}`);

    // ✅ Gmail
    if (provider === 'google') {
        if (!app_password && !accessToken) {
            throw new Error('Gmail account requires either accessToken or App Password.');
        }

        return {
            imap: {
                user: email,
                password: app_password || undefined,
                xoauth2: accessToken || undefined,
                host: 'imap.gmail.com',
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false },
                authTimeout: 10000
            }
        };
    }

    // ✅ Microsoft
    if (provider === 'microsoft') {
        if (!accessToken) throw new Error('Microsoft account requires accessToken.');
        return {
            imap: {
                user: email,
                xoauth2: accessToken,
                host: 'outlook.office365.com',
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false },
                authTimeout: 10000
            }
        };
    }

    // ✅ Custom domain
    if (!imapHost) {
        throw new Error(`IMAP host must be provided for custom domain: ${email}`);
    }

    return {
        imap: {
            user: email,
            password,
            host: imapHost,
            port: imapPort || 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 10000
        }
    };
}

async function moveEmailToInbox(receiver, messageId, currentFolder) {
    let connection;
    let inboxConnection;

    try {
        const imaps = require('imap-simple');
        const config = getImapConfig(receiver);
        connection = await imaps.connect(config);

        console.log(`📦 Attempting to move email from ${currentFolder} to INBOX`);

        // Open the current folder
        await connection.openBox(currentFolder, false);

        const searchCriteria = [['HEADER', 'Message-ID', messageId]];
        const results = await connection.search(searchCriteria, { bodies: [''], struct: true });

        if (results.length === 0) {
            console.log(`❌ Email not found in ${currentFolder}`);
            return { success: false, error: 'Email not found in current folder' };
        }

        const uid = results[0].attributes.uid;

        // Move email to INBOX
        await connection.moveMessage(uid, 'INBOX');
        console.log(`✅ Successfully moved message ${messageId} to INBOX`);

        // Close the first connection
        await connection.end();
        connection = null;

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
            console.log('⚠️ Email not found in INBOX after move (might need time to propagate)');
        }

        await inboxConnection.end();

        return { success: true, message: 'Email moved to INBOX and marked as seen/flagged' };

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

        return { success: false, error: err.message };
    }
}

// Also update the checkEmailStatus function to be more robust
async function checkEmailStatus(receiver, messageId) {
    let connection;

    try {
        const imaps = require('imap-simple');
        const config = getImapConfig(receiver);
        connection = await imaps.connect(config);

        // Check common folders
        const foldersToCheck = ['INBOX', '[Gmail]/Spam', 'Spam', 'Junk', 'Bulk'];

        for (const folder of foldersToCheck) {
            try {
                await connection.openBox(folder, false);
                const searchCriteria = [['HEADER', 'Message-ID', messageId]];
                const results = await connection.search(searchCriteria, { bodies: [''], struct: true });

                if (results.length > 0) {
                    await connection.end();
                    return {
                        success: true,
                        folder: folder,
                        found: true
                    };
                }
            } catch (folderError) {
                // Folder doesn't exist or can't be accessed, continue to next
                continue;
            }
        }

        await connection.end();
        return {
            success: true,
            folder: 'NOT_FOUND',
            found: false
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
        return { success: false, error: err.message };
    }
}


/**
 * Reply to message via SMTP
 */
async function replyToEmail(account, options) {
    const { to, subject, html, inReplyTo, references } = options;

    const replyResult = await sendEmail(account, {
        to,
        subject,
        html,
        headers: {
            'In-Reply-To': inReplyTo,
            'References': references.join(' ')
        }
    });

    return replyResult;
}

module.exports = {
    getImapConfig,
    checkEmailStatus,
    moveEmailToInbox,
    replyToEmail
};
