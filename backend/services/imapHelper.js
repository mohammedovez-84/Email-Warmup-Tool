// const imaps = require('imap-simple');
// const { simpleParser } = require('mailparser');
// const { sendEmail } = require('./emailSender');

// /**
//  * Create IMAP config
//  */
// function getImapConfig(account) {
//     return {
//         imap: {
//             user: account.imapUser,
//             password: account.imapPass,
//             host: account.imapHost,
//             port: account.imapPort,
//             tls: true,
//             tlsOptions: {
//                 rejectUnauthorized: false
//             },
//             connTimeout: 10000, // ⏰ 10 seconds for TCP connection
//             authTimeout: 10000, // ⏰ 10 seconds for login/auth
//             keepalive: true     // Optional: keeps connection alive longer
//         },
//         onmail: () => { } // noopss
//     };
// }

// const { refreshMicrosoftToken } = require('./microsoftTokenHelper'); // the file from above
// const MS_CLIENT_ID = 'your-client-id';
// const MS_CLIENT_SECRET = 'your-client-secret';
// const MS_TENANT_ID = 'common';


// Mark getImapConfig as async
// async function getImapConfig(account) {
//   if (account.type === 'microsoft') {
//     const now = Date.now();
//     if (!account.expiresAt || (account.expiresAt - now) < 300000) { // 5 min buffer
//       const tokenData = await refreshMicrosoftToken(
//         MS_CLIENT_ID,
//         MS_CLIENT_SECRET,
//         account.refreshToken,
//         MS_TENANT_ID
//       );
//       account.accessToken = tokenData.access_token;
//       account.expiresAt = now + tokenData.expires_in * 1000;

//       await account.save(); // save tokens to DB
//     }

//     return {
//       imap: {
//         user: account.imapUser,
//         xoauth2: account.accessToken,  // Use OAuth2 token, not password
//         host: account.imapHost || 'outlook.office365.com',
//         port: account.imapPort || 993,
//         tls: true,
//         tlsOptions: { rejectUnauthorized: false },
//         authTimeout: 10000,
//         connTimeout: 10000,
//         keepalive: true
//       },
//       onmail: () => {}
//     };
//   } else {
//     return {
//       imap: {
//         user: account.imapUser,
//         password: account.imapPass,
//         host: account.imapHost,
//         port: account.imapPort,
//         tls: true,
//         tlsOptions: { rejectUnauthorized: false },
//         authTimeout: 10000,
//         connTimeout: 10000,
//         keepalive: true
//       },
//       onmail: () => {}
//     };
//   }
// }


/**
 * Sleep helper
 */
// async function delay(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// /**
//  * Search all folders for the message and mark it seen + flagged
//  */
// async function checkEmailStatus(account, messageId) {
//     try {
//         const config = getImapConfig(account);
//         const connection = await imaps.connect(config);
//         const folders = ['INBOX', '[Gmail]/Spam', 'Spam', '[Gmail]/All Mail'];

//         await delay(15000); // wait for sync

//         for (const folder of folders) {
//             try {
//                 console.log(`Checking folder: ${folder}`);
//                 await connection.openBox(folder, false);

//                 const searchCriteria = [['HEADER', 'Message-ID', messageId]];
//                 const fetchOptions = { bodies: ['HEADER.FIELDS (MESSAGE-ID)'], markSeen: false };

//                 const results = await connection.search(searchCriteria, fetchOptions);

//                 if (results.length > 0) {
//                     const uid = results[0].attributes.uid;

//                     //Mark as Seen and Flagged (Starred) in any folder
//                     await new Promise((resolve, reject) => {
//                         connection.imap.addFlags(uid, ['\\Seen', '\\Flagged'], (err) => {
//                             if (err) reject(err);
//                             else resolve();
//                         });
//                     });

//                     console.log(`Found & marked in: ${folder}`);
//                     await connection.end();
//                     return { success: true, folder };
//                 }
//             } catch (err) {
//                 console.warn(`Folder ${folder} check failed: ${err.message}`);
//             }
//         }

//         await connection.end();
//         return { success: false, error: 'Message not found in any folder' };
//     } catch (err) {
//         return { success: false, error: err.message };
//     }
// }

// /**
//  * Move message from Spam to INBOX
//  */
// async function moveEmailToInbox(account, messageId) {
//     const config = getImapConfig(account);
//     const connection = await imaps.connect(config);

//     try {
//         await connection.openBox('Spam').catch(() => connection.openBox('[Gmail]/Spam'));

//         const searchCriteria = [['HEADER', 'Message-ID', messageId]];
//         const results = await connection.search(searchCriteria, { bodies: [''], struct: true });

//         if (results.length > 0) {
//             const uid = results[0].attributes.uid;
//             await connection.moveMessage(uid, 'INBOX');
//             console.log(`Moved message ${messageId} to INBOX`);

//             //Always open INBOX and re-flag it
//             await connection.openBox('INBOX');

//             await new Promise((resolve, reject) => {
//                 connection.imap.addFlags(uid, ['\\Seen', '\\Flagged'], (err) => {
//                     if (err) reject(err);
//                     else resolve();
//                 });
//             });

//             console.log(`Marked as Seen + Flagged in INBOX after moving`);
//         } else {
//             console.warn(`Message not found in Spam folders to move`);
//         }
//     } catch (err) {
//         console.error(`Error during moving email: ${err.message}`);
//     }

//     await connection.end();
// }

// /**
//  * Reply to message via SMTP
//  */
// async function replyToEmail(account, options) {
//     const { to, subject, html, inReplyTo, references } = options;

//     const replyResult = await sendEmail(account, {
//         to,
//         subject,
//         html,
//         headers: {
//             'In-Reply-To': inReplyTo,
//             'References': references.join(' ')
//         }
//     });

//     return replyResult;
// }

// module.exports = {
//     checkEmailStatus,
//     moveEmailToInbox,
//     replyToEmail
// };



const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const { sendEmail } = require('./emailSender');

/**
* Create IMAP config
*/
function getImapConfig(account) {
    return {
        imap: {
            user: account.imapUser,
            password: account.imapPass,
            host: account.imapHost,
            port: account.imapPort,
            tls: true,
            tlsOptions: {
                rejectUnauthorized: false
            },
            connTimeout: 10000,
            authTimeout: 10000,
            keepalive: true
        },
        onmail: () => { } // noopss
    };
}

// const { refreshMicrosoftToken } = require('./microsoftTokenHelper'); // the file from above
// const MS_CLIENT_ID = 'your-client-id';
// const MS_CLIENT_SECRET = 'your-client-secret';
// const MS_TENANT_ID = 'common'; 


// Mark getImapConfig as async
// async function getImapConfig(account) {
//   if (account.type === 'microsoft') {
//     const now = Date.now();
//     if (!account.expiresAt || (account.expiresAt - now) < 300000) { // 5 min buffer
//       const tokenData = await refreshMicrosoftToken(
//         MS_CLIENT_ID,
//         MS_CLIENT_SECRET,
//         account.refreshToken,
//         MS_TENANT_ID
//       );
//       account.accessToken = tokenData.access_token;
//       account.expiresAt = now + tokenData.expires_in * 1000;

//       await account.save(); // save tokens to DB
//     }

//     return {
//       imap: {
//         user: account.imapUser,
//         xoauth2: account.accessToken,  // Use OAuth2 token, not password
//         host: account.imapHost || 'outlook.office365.com',
//         port: account.imapPort || 993,
//         tls: true,
//         tlsOptions: { rejectUnauthorized: false },
//         authTimeout: 10000,
//         connTimeout: 10000,
//         keepalive: true
//       },
//       onmail: () => {}
//     };
//   } else {
//     return {
//       imap: {
//         user: account.imapUser,
//         password: account.imapPass,
//         host: account.imapHost,
//         port: account.imapPort,
//         tls: true,
//         tlsOptions: { rejectUnauthorized: false },
//         authTimeout: 10000,
//         connTimeout: 10000,
//         keepalive: true
//       },
//       onmail: () => {}
//     };
//   }
// }


/**
* Sleep helper
*/
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
* Search all folders for the message and mark it seen + flagged
*/
async function checkEmailStatus(account, messageId) {
    try {
        const config = getImapConfig(account);
        const connection = await imaps.connect(config);
        const folders = ['INBOX', '[Gmail]/Spam', 'Spam', '[Gmail]/All Mail'];

        await delay(15000); // wait for sync

        for (const folder of folders) {
            try {
                console.log(`Checking folder: ${folder}`);
                await connection.openBox(folder, false);

                const searchCriteria = [['HEADER', 'Message-ID', messageId]];
                const fetchOptions = { bodies: ['HEADER.FIELDS (MESSAGE-ID)'], markSeen: false };

                const results = await connection.search(searchCriteria, fetchOptions);

                if (results.length > 0) {
                    const uid = results[0].attributes.uid;

                    //Mark as Seen and Flagged (Starred) in any folder
                    await new Promise((resolve, reject) => {
                        connection.imap.addFlags(uid, ['\\Seen', '\\Flagged'], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });

                    console.log(`Found & marked in: ${folder}`);
                    await connection.end();
                    return { success: true, folder };
                }
            } catch (err) {
                console.warn(`Folder ${folder} check failed: ${err.message}`);
            }
        }

        await connection.end();
        return { success: false, error: 'Message not found in any folder' };
    } catch (err) {
        return { success: false, error: err.message };
    }
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

            //Always open INBOX and re-flag it
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