
// const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// const { sendEmail } = require('./emailSender');
// const { checkEmailStatus, moveEmailToInbox, getImapConfig } = require('./imapHelper');
// const { maybeReply } = require('./replyHelper');
// const { updateMetrics } = require('../services/metricsService');
// const { getIO } = require('../controllers/socket');
// const { sequelize } = require('../config/db');
// const Account = require('../models/Account');

// /**l
// * 🔹 Round robin receiver selection
// */
// async function getNextReceiver() {
//     return await sequelize.transaction(async (t) => {
//         const receiver = await Account.findOne({
//             order: [['roundRobinIndex', 'ASC']],
//             transaction: t,
//             lock: t.LOCK.UPDATE,
//         });

//         if (!receiver) throw new Error('No receivers available');

//         const maxIndex = await Account.max('roundRobinIndex', { transaction: t }) || 0;
//         receiver.roundRobinIndex = maxIndex + 1;
//         await receiver.save({ transaction: t });

//         return receiver;
//     });
// }

// /**
// * 🔹 Compute how many emails a sender should send today
// */
// function computeEmailsToSend(sender) {
//     const warmupDayCount = sender.warmupDayCount || 0;
//     const startEmailsPerDay = sender.startEmailsPerDay || 3;
//     const increaseEmailsPerDay = sender.increaseEmailsPerDay || 3;
//     const maxEmailsPerDay = sender.maxEmailsPerDay || 25;

//     let emailsToSend = startEmailsPerDay + increaseEmailsPerDay * warmupDayCount;
//     if (emailsToSend > maxEmailsPerDay) emailsToSend = maxEmailsPerDay;

//     return emailsToSend;
// }

// /**
// * 🔹 Compute reply rate for sender
// */
// function computeReplyRate(sender) {
//     const baseRate = sender.replyRate || 0.3;
//     const dailyIncrease = sender.increaseReplyRate || 0.0;
//     return Math.min(baseRate + dailyIncrease * (sender.warmupDayCount || 0), 1.0);
// }


// /**
// * 🔹 Handles a single warmup email
// */
// async function warmupSingleEmail(sender, receiver) {
//     let io = null;
//     try {
//         io = getIO();
//     } catch {
//         io = null;
//     }

//     const subject = `Quick email check`;
//     const html = `<p>Hi! This is just a quick warmup message to keep things flowing.</p>`;

//     const sendResult = await sendEmail(sender, { to: receiver.email, subject, html });
//     if (!sendResult.success) {
//         console.error(`Failed to send: ${sendResult.error}`);
//         return;
//     }

//     const messageId = sendResult.messageId;
//     console.log(`Sent warmup to ${receiver.email}: ${messageId}`);

//     await updateMetrics(sender, receiver, { sent: true }, io);
//     await delay(4500);

//     const statusResult = await checkEmailStatus(receiver, messageId);
//     if (!statusResult.success) {
//         console.error(`IMAP check failed: ${statusResult.error}`);
//         return;
//     }

//     const folder = statusResult.folder;
//     console.log(`Message found in: ${folder}`);

//     await updateMetrics(sender, receiver, {
//         deliveredInbox: folder === 'INBOX',
//         landedSpam: folder !== 'INBOX'
//     }, io);

//     if (folder !== 'INBOX') {
//         await moveEmailToInbox(receiver, messageId, folder);
//         const postMoveStatus = await checkEmailStatus(receiver, messageId);
//         if (postMoveStatus.success && postMoveStatus.folder === 'INBOX') {
//             await updateMetrics(sender, receiver, { movedToInbox: true }, io);
//         } else {
//             console.warn(`Message ${messageId} could not be moved to INBOX.`);
//         }
//     }

//     const replySubject = `Re: ${subject}`;
//     const replyHtml = `<p>Thanks for your warmup test!</p>`;
//     const replyResult = await maybeReply(receiver, {
//         to: sender.email,
//         subject: replySubject,
//         html: replyHtml,
//         inReplyTo: messageId,
//         references: [messageId]
//     }, sender.replyRate);

//     if (replyResult?.messageId) {
//         await updateMetrics(sender, receiver, { replied: true }, io);
//     }

//     await delay(1500);

//     if (replyResult?.messageId) {
//         const senderReplyStatus = await checkEmailStatus(sender, replyResult.messageId);
//         if (senderReplyStatus.success) {
//             await moveEmailToInbox(sender, replyResult.messageId, senderReplyStatus.folder);

//             const imaps = require('imap-simple');
//             const config = getImapConfig(sender);
//             const connection = await imaps.connect(config);
//             try {
//                 await connection.openBox('INBOX', false);
//                 const searchCriteria = [['HEADER', 'Message-ID', replyResult.messageId]];
//                 const results = await connection.search(searchCriteria, { bodies: [''], struct: true });
//                 if (results.length > 0) {
//                     const uid = results[0].attributes.uid;
//                     await connection.imap.addFlags(uid, ['\\Seen', '\\Flagged']);
//                     console.log(`Sender side reply marked as Seen + Flagged`);
//                 }
//             } catch (err) {
//                 console.error(`Error marking sender reply: ${err.message}`);
//             }
//             await connection.end();
//         }
//     }

//     console.log(`Warmup workflow completed for ${sender.email} -> ${receiver.email}`);
// }


// module.exports = {
//     warmupSingleEmail,
//     getNextReceiver,
//     computeEmailsToSend,
//     computeReplyRate,
// };
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const { sendEmail } = require('./emailSender');
const { checkEmailStatus, moveEmailToInbox, getImapConfig } = require('./imapHelper');
const { maybeReply } = require('./replyHelper');
const { updateMetrics } = require('../services/metricsService');
// const { getIO } = require('../controllers/socket');
const { sequelize } = require('../config/db');
const Account = require('../models/Account');
const { generateEmail, generateReply } = require("./aiService"); // ✅ new import


// 🔹 Extract a readable name from email
function extractNameFromEmail(email) {
    if (!email) return "User";

    const localPart = email.split("@")[0]; // before @
    return localPart
        .split(/[._-]/) // split on ., _, -
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}


/** 
* 🔹 Round robin receiver selection
*/
async function getNextReceiver() {
    return await sequelize.transaction(async (t) => {
        const receiver = await Account.findOne({
            order: [['roundRobinIndex', 'ASC']],
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!receiver) throw new Error('No receivers available');

        const maxIndex = await Account.max('roundRobinIndex', { transaction: t }) || 0;
        receiver.roundRobinIndex = maxIndex + 1;
        await receiver.save({ transaction: t });

        return receiver;
    });
}

/**
* 🔹 Compute how many emails a sender should send today
*/
function computeEmailsToSend(sender) {
    const warmupDayCount = sender.warmupDayCount || 0;
    const startEmailsPerDay = sender.startEmailsPerDay || 3;
    const increaseEmailsPerDay = sender.increaseEmailsPerDay || 3;
    const maxEmailsPerDay = sender.maxEmailsPerDay || 25;

    let emailsToSend = startEmailsPerDay + increaseEmailsPerDay * warmupDayCount;
    if (emailsToSend > maxEmailsPerDay) emailsToSend = maxEmailsPerDay;

    return emailsToSend;
}

/**
* 🔹 Compute reply rate for sender
*/
function computeReplyRate(sender) {
    const baseRate = sender.replyRate || 0.3;
    const dailyIncrease = sender.increaseReplyRate || 0.0;
    return Math.min(baseRate + dailyIncrease * (sender.warmupDayCount || 0), 1.0);
}

/**
* 🔹 Handles a single warmup email with AI
*/
async function warmupSingleEmail(sender, receiver) {
    let io = null;
    try {
        io = getIO();
    } catch {
        io = null;
    }


    // ✅ Get AI-generated warmup email
    const senderName = extractNameFromEmail(sender.email);
    const receiverName = extractNameFromEmail(receiver.email);

    const aiEmail = await generateEmail(senderName, receiverName, sender.industry || "general");

    if (!aiEmail) {
        console.error("Failed to generate warmup email");
        return;
    }

    const subject = aiEmail.subject;
    const html = aiEmail.content;

    const sendResult = await sendEmail(sender, { to: receiver.email, subject, html });
    if (!sendResult.success) {
        console.error(`Failed to send: ${sendResult.error}`);
        return;
    }

    const messageId = sendResult.messageId;
    console.log(`Sent warmup to ${receiver.email}: ${messageId}`);

    await updateMetrics(sender, receiver, { sent: true }, io);
    await delay(4500);

    const statusResult = await checkEmailStatus(receiver, messageId);
    if (!statusResult.success) {
        console.error(`IMAP check failed: ${statusResult.error}`);
        return;
    }

    const folder = statusResult.folder;
    console.log(`Message found in: ${folder}`);

    await updateMetrics(sender, receiver, {
        deliveredInbox: folder === 'INBOX',
        landedSpam: folder !== 'INBOX'
    }, io);

    if (folder !== 'INBOX') {
        await moveEmailToInbox(receiver, messageId, folder);
        const postMoveStatus = await checkEmailStatus(receiver, messageId);
        if (postMoveStatus.success && postMoveStatus.folder === 'INBOX') {
            await updateMetrics(sender, receiver, { movedToInbox: true }, io);
        } else {
            console.warn(`Message ${messageId} could not be moved to INBOX.`);
        }
    }

    // ✅ AI-based reply
    const aiReply = await generateReply(aiEmail.id); // FastAPI gives an id
    if (aiReply && aiReply.reply_content) {
        const replySubject = `Re: ${subject}`;
        const replyHtml = aiReply.reply_content;

        const replyResult = await maybeReply(receiver, {
            to: sender.email,
            subject: replySubject,
            html: replyHtml,
            inReplyTo: messageId,
            references: [messageId]
        }, sender.replyRate);

        if (replyResult?.messageId) {
            await updateMetrics(sender, receiver, { replied: true }, io);

            // ✅ Mark sender side reply as Seen + Flagged
            const senderReplyStatus = await checkEmailStatus(sender, replyResult.messageId);
            if (senderReplyStatus.success) {
                await moveEmailToInbox(sender, replyResult.messageId, senderReplyStatus.folder);

                const imaps = require('imap-simple');
                const config = getImapConfig(sender);
                const connection = await imaps.connect(config);
                try {
                    await connection.openBox('INBOX', false);
                    const searchCriteria = [['HEADER', 'Message-ID', replyResult.messageId]];
                    const results = await connection.search(searchCriteria, { bodies: [''], struct: true });
                    if (results.length > 0) {
                        const uid = results[0].attributes.uid;
                        await connection.imap.addFlags(uid, ['\\Seen', '\\Flagged']);
                        console.log(`Sender side reply marked as Seen + Flagged`);
                    }
                } catch (err) {
                    console.error(`Error marking sender reply: ${err.message}`);
                }
                await connection.end();
            }
        }
    }

    console.log(`✅ Warmup workflow completed for ${sender.email} -> ${receiver.email}`);
}

module.exports = {
    warmupSingleEmail,
    getNextReceiver,
    computeEmailsToSend,
    computeReplyRate,
};
