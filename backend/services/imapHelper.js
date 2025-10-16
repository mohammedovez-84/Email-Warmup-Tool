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

/**
 * 🔹 Check email status in multiple folders
 */
async function checkEmailStatus(account, messageId) {
    try {
        if (!messageId) throw new Error('Missing Message-ID');

        const config = getImapConfig(account);
        const connection = await imaps.connect(config);

        const folders = ['INBOX', '[Gmail]/Spam', 'Spam', '[Gmail]/All Mail'];
        const cleanMessageId = messageId.replace(/[<>]/g, '');

        for (const folder of folders) {
            try {
                await connection.openBox(folder, true);
                const searchCriteria = [['HEADER', 'Message-ID', cleanMessageId]];
                const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT MESSAGE-ID)'], struct: true };

                let results = await connection.search(searchCriteria, fetchOptions);

                // Fallback search by lastSubject
                if (results.length === 0 && account.lastSubject) {
                    results = await connection.search([['HEADER', 'Subject', account.lastSubject]], fetchOptions);
                }

                if (results.length > 0) {
                    await connection.end();
                    return { success: true, folder };
                }
            } catch (err) {
                console.warn(`[IMAP] Failed folder check: ${folder} => ${err.message}`);
            }
        }

        await connection.end();
        return { success: false, error: 'Message not found in any folder' };
    } catch (err) {
        console.error('IMAP check failed:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * 🔹 Move email from Spam to Inbox
 */
async function moveEmailToInbox(account, messageId) {
    const config = getImapConfig(account);
    const connection = await imaps.connect(config);

    try {
        await connection.openBox('Spam').catch(() => connection.openBox('[Gmail]/Spam'));

        const searchCriteria = [['HEADER', 'Message-ID', messageId]];
        const results = await connection.search(searchCriteria, { bodies: [''], struct: true });

        if (results.length > 0) {
            const uid = results[0].attributes.uid;
            await connection.moveMessage(uid, 'INBOX');

            await connection.openBox('INBOX');
            await new Promise((resolve, reject) => {
                connection.imap.addFlags(uid, ['\\Seen', '\\Flagged'], (err) => (err ? reject(err) : resolve()));
            });

            console.log(`Moved and flagged message ${messageId} in INBOX`);
        } else {
            console.warn(`Message not found in Spam folders to move`);
        }
    } catch (err) {
        console.error(`Error moving email: ${err.message}`);
    }

    await connection.end();
}
/**
 * Move message from Spam to INBOX
 */
async function moveEmailToInbox(account, messageId) {
    const config = getImapConfig(account);
    const connection = await imaps.connect(config);

    try {
        await connection.openBox('Spam').catch(() => connection.openBox('[Gmail]/Spam'));

        const searchCriteria = [['HEADER', 'Message-ID', messageId]];
        const results = await connection.search(searchCriteria, { bodies: [''], struct: true });

        if (results.length > 0) {
            const uid = results[0].attributes.uid;
            await connection.moveMessage(uid, 'INBOX');
            console.log(`Moved message ${messageId} to INBOX`);

            await connection.openBox('INBOX');
            await new Promise((resolve, reject) => {
                connection.imap.addFlags(uid, ['\\Seen', '\\Flagged'], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            console.log(`Marked as Seen + Flagged in INBOX after moving`);
        } else {
            console.warn(`Message not found in Spam folders to move`);
        }
    } catch (err) {
        console.error(`Error during moving email: ${err.message}`);
    }

    await connection.end();
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
