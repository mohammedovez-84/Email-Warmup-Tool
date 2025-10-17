const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const { sendEmail } = require('./emailSender');
const { checkEmailStatus, moveEmailToInbox, getImapConfig } = require('./imapHelper');
const { maybeReply } = require('./replyHelper');
const { generateEmail, generateReply } = require("./aiService");

const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const EmailMetric = require('../models/EmailMetric');

function extractNameFromEmail(email) {
    if (!email) return "User";
    const localPart = email.split("@")[0];
    return localPart
        .split(/[._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// ---------------- Get next receiver based on sender type ----------------
async function getNextReceiver(sender) {
    let receivers;

    // Google + SMTP group
    if (sender.provider === 'google' || sender.smtpUser) {
        receivers = [
            ...(await GoogleUser.findAll({ where: { warmupStatus: 'active' } })),
            ...(await SmtpAccount.findAll({ where: { warmupStatus: 'active' } }))
        ];
    }
    // Microsoft group
    else if (sender.provider === 'microsoft') {
        receivers = await MicrosoftUser.findAll({ where: { warmupStatus: 'active' } });
    } else {
        throw new Error('Unknown sender type');
    }

    receivers = receivers.filter(r => r.email !== sender.email);
    if (!receivers.length) throw new Error(`No active receiver found for ${sender.email}`);

    // Round-robin selection
    let receiver = receivers[0];
    for (const r of receivers) {
        const indexKey = r.roundRobinIndex ?? r.roundRobinIndexMicrosoft ?? r.roundRobinIndexCustom ?? 0;
        const receiverIndex = receiver.roundRobinIndex ?? receiver.roundRobinIndexMicrosoft ?? receiver.roundRobinIndexCustom ?? 0;
        if (indexKey < receiverIndex) receiver = r;
    }

    if ('roundRobinIndexMicrosoft' in receiver) {
        receiver.roundRobinIndexMicrosoft = (receiver.roundRobinIndexMicrosoft || 0) + 1;
    } else if ('roundRobinIndexCustom' in receiver) {
        receiver.roundRobinIndexCustom = (receiver.roundRobinIndexCustom || 0) + 1;
    } else {
        receiver.roundRobinIndex = (receiver.roundRobinIndex || 0) + 1;
    }

    await receiver.save();
    return receiver;
}

function computeEmailsToSend(sender) {
    const warmupDayCount = sender.warmupDayCount || 0;
    const startEmailsPerDay = sender.startEmailsPerDay || 3;
    const increaseEmailsPerDay = sender.increaseEmailsPerDay || 3;
    const maxEmailsPerDay = sender.maxEmailsPerDay || 25;

    let emailsToSend = startEmailsPerDay + increaseEmailsPerDay * warmupDayCount;
    if (emailsToSend > maxEmailsPerDay) emailsToSend = maxEmailsPerDay;
    return emailsToSend;
}

function computeReplyRate(sender) {
    const baseRate = sender.replyRate || 0.3;
    const dailyIncrease = sender.increaseReplyRate || 0.0;
    return Math.min(baseRate + dailyIncrease * (sender.warmupDayCount || 0), 1.0);
}

// ---------------- Warmup email workflow ----------------
async function warmupSingleEmail(sender, receiver) {
    const senderName = extractNameFromEmail(sender.email);
    const receiverName = extractNameFromEmail(receiver.email);

    const aiEmail = await generateEmail(senderName, receiverName, sender.industry || "general");
    if (!aiEmail) {
        console.error("Failed to generate warmup email");
        return;
    }

    const { subject, content: html } = aiEmail;

    // Send email
    const sendResult = await sendEmail(sender, { to: receiver.email, subject, html });
    if (!sendResult.success) {
        console.error(`Failed to send: ${sendResult.error}`);
        return;
    }

    const messageId = sendResult.messageId;
    console.log(`Sent warmup to ${receiver.email}: ${messageId}`);

    // Log in EmailMetric
    const emailMetric = await EmailMetric.create({
        senderEmail: sender.email,
        senderType: sender.provider || (sender.roundRobinIndexMicrosoft !== undefined ? 'microsoft' : 'custom'),
        receiverEmail: receiver.email,
        messageId,
        sentAt: new Date()
    });

    await delay(4500);

    // Check IMAP status
    const statusResult = await checkEmailStatus(receiver, messageId);
    if (!statusResult.success) {
        console.error(`IMAP check failed: ${statusResult.error}`);
        return;
    }

    const folder = statusResult.folder;
    await EmailMetric.update({ deliveredInbox: folder === 'INBOX' }, { where: { id: emailMetric.id } });

    if (folder !== 'INBOX') {
        await moveEmailToInbox(receiver, messageId, folder);
        const postMoveStatus = await checkEmailStatus(receiver, messageId);
        if (postMoveStatus.success && postMoveStatus.folder === 'INBOX') {
            await EmailMetric.update({ deliveredInbox: true }, { where: { id: emailMetric.id } });
        }
    }

    // AI Reply
    const aiReply = await generateReply(aiEmail);
    if (aiReply?.reply_content) {
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
            await EmailMetric.update({ replied: true }, { where: { id: emailMetric.id } });

            // Mark sender reply as Seen + Flagged
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

    console.log(`✅ Warmup completed for ${sender.email} -> ${receiver.email}`);
}

module.exports = {
    warmupSingleEmail,
    getNextReceiver,
    computeEmailsToSend,
    computeReplyRate,
};
