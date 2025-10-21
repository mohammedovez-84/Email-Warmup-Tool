const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const { sendEmail } = require('./emailSender');
const { checkEmailStatus, moveEmailToInbox, getImapConfig } = require('./imapHelper');
const { maybeReply } = require('./replyHelper');
const { generateEmail, generateReplyWithRetry } = require("./aiService");
const EmailMetric = require('../models/EmailMetric');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const { buildSenderConfig, getSenderType } = require('../utils/senderConfig');

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
    minDelayBetweenEmails: 15 * 60 * 1000,
    maxEmailsPerHour: 8,
    maxEmailsPerDay: 20,
    maxConcurrentJobs: 2,
    dailyResetTime: '00:00'
};

// Track rate limiting state
const rateLimitState = {
    hourlyCounts: new Map(),
    dailyCounts: new Map(),
    lastReset: Date.now(),
    lastDailyReset: new Date().setHours(0, 0, 0, 0),
    concurrentJobs: 0
};

// Reset hourly counts every hour
setInterval(() => {
    rateLimitState.hourlyCounts.clear();
    rateLimitState.lastReset = Date.now();
}, 60 * 60 * 1000);

// Reset daily counts every 24 hours
setInterval(() => {
    rateLimitState.dailyCounts.clear();
    rateLimitState.lastDailyReset = new Date().setHours(0, 0, 0, 0);
}, 24 * 60 * 60 * 1000);

function extractNameFromEmail(email) {
    if (!email) return "User";
    const localPart = email.split("@")[0];
    return localPart.split(/[._-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function checkRateLimit(senderEmail) {
    const hourlyCount = rateLimitState.hourlyCounts.get(senderEmail) || 0;
    const dailyCount = rateLimitState.dailyCounts.get(senderEmail) || 0;

    if (hourlyCount >= RATE_LIMIT_CONFIG.maxEmailsPerHour) {
        throw new Error(`Hourly rate limit exceeded for ${senderEmail}: ${hourlyCount}/${RATE_LIMIT_CONFIG.maxEmailsPerHour}`);
    }
    if (dailyCount >= RATE_LIMIT_CONFIG.maxEmailsPerDay) {
        throw new Error(`Daily rate limit exceeded for ${senderEmail}: ${dailyCount}/${RATE_LIMIT_CONFIG.maxEmailsPerDay}`);
    }
    if (rateLimitState.concurrentJobs >= RATE_LIMIT_CONFIG.maxConcurrentJobs) {
        throw new Error(`Too many concurrent jobs: ${rateLimitState.concurrentJobs}/${RATE_LIMIT_CONFIG.maxConcurrentJobs}`);
    }
    return true;
}

function updateRateLimit(senderEmail) {
    const hourlyCount = rateLimitState.hourlyCounts.get(senderEmail) || 0;
    const dailyCount = rateLimitState.dailyCounts.get(senderEmail) || 0;
    rateLimitState.hourlyCounts.set(senderEmail, hourlyCount + 1);
    rateLimitState.dailyCounts.set(senderEmail, dailyCount + 1);
}

// PROPER DATABASE FIELD USAGE
async function computeEmailsToSend(account) {
    // Use ACTUAL database fields - no hardcoded defaults
    const warmupDayCount = account.warmupDayCount;
    const startEmailsPerDay = account.startEmailsPerDay;
    const increaseEmailsPerDay = account.increaseEmailsPerDay;
    const maxEmailsPerDay = account.maxEmailsPerDay;

    console.log(`📊 Database fields for ${account.email}:`);
    console.log(`   warmupDayCount: ${warmupDayCount}`);
    console.log(`   startEmailsPerDay: ${startEmailsPerDay}`);
    console.log(`   increaseEmailsPerDay: ${increaseEmailsPerDay}`);
    console.log(`   maxEmailsPerDay: ${maxEmailsPerDay}`);

    // Progressive warmup using ACTUAL database fields
    let emailsToSend = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);

    // Use ACTUAL maxEmailsPerDay from database
    emailsToSend = Math.min(emailsToSend, maxEmailsPerDay);
    emailsToSend = Math.max(emailsToSend, 1);
    emailsToSend = Math.min(emailsToSend, RATE_LIMIT_CONFIG.maxEmailsPerDay);

    console.log(`   Calculated: ${emailsToSend} emails/day`);
    return emailsToSend;
}

// PROPER DATABASE FIELD USAGE
async function computeReplyRate(account) {
    // Use ACTUAL database fields
    const warmupDayCount = account.warmupDayCount;
    const configuredReplyRate = account.replyRate;

    console.log(`📨 Database fields for ${account.email}:`);
    console.log(`   warmupDayCount: ${warmupDayCount}`);
    console.log(`   replyRate: ${configuredReplyRate}`);

    const baseRate = 0.20;
    const dailyIncrease = 0.02;
    let replyRate = baseRate + (dailyIncrease * warmupDayCount);

    // Use ACTUAL replyRate from database
    const maxReplyRate = Math.min(configuredReplyRate, 0.25);
    replyRate = Math.min(replyRate, maxReplyRate);
    replyRate = Math.max(replyRate, 0.15);

    console.log(`   Calculated: ${(replyRate * 100).toFixed(1)}% reply rate`);
    return Math.round(replyRate * 100) / 100;
}

// Get account from database
async function getAccountFromDatabase(email) {
    try {
        let account = await GoogleUser.findOne({ where: { email } });
        if (account) return account;

        account = await MicrosoftUser.findOne({ where: { email } });
        if (account) return account;

        account = await SmtpAccount.findOne({ where: { email } });
        if (account) return account;

        return null;
    } catch (error) {
        console.error(`❌ Database query error: ${error.message}`);
        return null;
    }
}

async function getFreshAccountData(account) {
    if (!account || !account.email) return account;
    try {
        const freshAccount = await getAccountFromDatabase(account.email);
        return freshAccount || account;
    } catch (error) {
        return account;
    }
}

function getSenderTypeFromModel(sender) {
    return getSenderType(sender);
}

function getReceiverTypeFromModel(receiver) {
    return getSenderType(receiver);
}

// Warmup email workflow
async function warmupSingleEmail(sender, receiver, replyRate = 0.25, isScheduledReply = false) {
    let emailMetric = null;
    let messageId = null;

    try {
        // ✅ ADDED: Debug logging to see what's received
        console.log(`🔍 warmupSingleEmail received config:`, {
            senderEmail: sender.email,
            senderType: sender.type,
            hasSmtpHost: !!sender.smtpHost,
            hasSmtpPort: !!sender.smtpPort,
            hasSmtpUser: !!sender.smtpUser,
            hasSmtpPass: !!sender.smtpPass,
            receiverEmail: receiver.email
        });

        // ✅ FIX: Use the sender config directly (it's already built)
        const freshSender = sender; // Use the provided config directly
        const freshReceiver = await getFreshAccountData(receiver);

        if (!isScheduledReply) {
            checkRateLimit(freshSender.email);
        }

        rateLimitState.concurrentJobs++;

        const senderName = extractNameFromEmail(freshSender.email);
        const receiverName = extractNameFromEmail(freshReceiver.email);

        // Use ACTUAL database fields
        const industry = freshSender.industry;
        const warmupDay = freshSender.warmupDayCount;

        const aiEmail = await generateEmail(senderName, receiverName, industry);
        if (!aiEmail || !aiEmail.subject || !aiEmail.content) {
            throw new Error('AI email generation failed');
        }

        const { subject, content: html } = aiEmail;

        // ✅ Use the sender config directly (it already has all SMTP settings)
        const sendResult = await sendEmail(freshSender, {
            to: freshReceiver.email,
            subject: subject.trim(),
            html: html.trim()
        });

        if (!sendResult.success) {
            throw new Error(`Email sending failed: ${sendResult.error}`);
        }

        messageId = sendResult.messageId;

        if (!isScheduledReply) {
            updateRateLimit(freshSender.email);
        }

        // Create EmailMetric with ACTUAL database fields
        emailMetric = await EmailMetric.create({
            senderEmail: freshSender.email,
            senderType: getSenderTypeFromModel(freshSender),
            receiverEmail: freshReceiver.email,
            receiverType: getReceiverTypeFromModel(freshReceiver),
            messageId: messageId,
            subject: subject,
            sentAt: new Date(),
            deliveredInbox: false,
            replied: false,
            warmupDay: warmupDay,
            replyRate: replyRate,
            emailType: isScheduledReply ? 'scheduled_reply' : 'warmup',
            industry: industry
        });

        if (isScheduledReply) {
            await EmailMetric.update({ completedAt: new Date(), status: 'completed' }, { where: { id: emailMetric.id } });
            return;
        }

        await delay(10000);

        try {
            const statusResult = await checkEmailStatus(freshReceiver, messageId);
            if (statusResult.success) {
                const folder = statusResult.folder;
                const deliveredInbox = folder === 'INBOX';

                await EmailMetric.update({ deliveredInbox, deliveryFolder: folder }, { where: { id: emailMetric.id } });

                if (!deliveredInbox && folder !== 'NOT_FOUND' && folder !== 'UNKNOWN') {
                    const moveResult = await moveEmailToInbox(freshReceiver, messageId, folder);
                    if (moveResult && moveResult.success) {
                        await delay(8000);
                        const postMoveStatus = await checkEmailStatus(freshReceiver, messageId);
                        if (postMoveStatus.success && postMoveStatus.folder === 'INBOX') {
                            await EmailMetric.update({ deliveredInbox: true, movedToInbox: true }, { where: { id: emailMetric.id } });
                        }
                    }
                }
            }
        } catch (imapError) {
            console.error(`❌ IMAP operation error: ${imapError.message}`);
        }

        const shouldReply = Math.random() < replyRate;
        if (shouldReply) {
            try {
                const aiReply = await generateReplyWithFallback(aiEmail);
                if (aiReply && aiReply.reply_content) {
                    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
                    await delay(5000);

                    const replyResult = await maybeReply(freshReceiver, {
                        to: freshSender.email,
                        subject: replySubject,
                        html: aiReply.reply_content,
                        inReplyTo: messageId,
                        references: [messageId]
                    }, 1.0);

                    if (replyResult?.success && replyResult.messageId) {
                        await EmailMetric.update({
                            replied: true,
                            repliedAt: new Date(),
                            replyMessageId: replyResult.messageId
                        }, { where: { id: emailMetric.id } });

                        try {
                            await markEmailAsSeenAndFlagged(freshSender, replyResult.messageId);
                        } catch (markError) {
                            console.error(`⚠️ Could not mark email as seen/flagged: ${markError.message}`);
                        }
                    }
                }
            } catch (replyError) {
                console.error(`❌ Reply generation/processing error: ${replyError.message}`);
            }
        }

        await EmailMetric.update({ completedAt: new Date(), status: 'completed' }, { where: { id: emailMetric.id } });

    } catch (error) {
        console.error(`❌ Error in warmupSingleEmail:`, error);
        if (emailMetric) {
            try {
                await EmailMetric.update({
                    error: error.message.substring(0, 500),
                    status: 'failed',
                    completedAt: new Date()
                }, { where: { id: emailMetric.id } });
            } catch (updateError) {
                console.error('Failed to update error metric:', updateError);
            }
        }
        throw error;
    } finally {
        rateLimitState.concurrentJobs = Math.max(0, rateLimitState.concurrentJobs - 1);
    }
}

async function sendScheduledReply(sender, receiver, originalSubject, replyRate = 0.25) {
    console.log(`📅 Executing scheduled reply: ${sender.email} -> ${receiver.email}`);

    try {
        const freshSender = sender;
        const freshReceiver = await getFreshAccountData(receiver);

        const aiReply = await generateReplyWithFallback({
            subject: originalSubject,
            content: `Original email about ${originalSubject}`
        });

        if (aiReply && aiReply.reply_content) {
            await warmupSingleEmail(freshSender, freshReceiver, replyRate, true);
            console.log(`✅ Scheduled reply sent`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ Error in scheduled reply:`, error);
        throw error;
    }
}

async function generateReplyWithFallback(originalEmail, maxRetries = 2) {
    let attempts = 0;
    while (attempts <= maxRetries) {
        try {
            const aiReply = await generateReplyWithRetry(originalEmail);
            if (aiReply && aiReply.reply_content && aiReply.reply_content.trim().length > 10) {
                return aiReply;
            }
        } catch (error) {
            console.error(`❌ AI reply generation error:`, error.message);
        }
        attempts++;
        if (attempts <= maxRetries) {
            await delay(1000 * Math.pow(2, attempts));
        }
    }
    return generateFallbackReply(originalEmail);
}

function generateFallbackReply(originalEmail) {
    const fallbackReplies = [
        "Thanks for your email! I'll review this and get back to you soon.",
        "Appreciate you reaching out. I'll look into this and follow up shortly.",
        "Thank you for the message. I'll circle back on this tomorrow.",
        "Got your email - thanks! I'll respond properly once I've had a chance to review.",
        "Thanks for getting in touch. I'll get back to you with a proper response soon."
    ];
    const randomReply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
    return { reply_content: randomReply, is_fallback: true };
}

async function markEmailAsSeenAndFlagged(sender, messageId) {
    try {
        const imaps = require('imap-simple');
        const config = getImapConfig(sender);
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX', false);
        const searchCriteria = [['HEADER', 'Message-ID', messageId]];
        const results = await connection.search(searchCriteria, { bodies: [''], struct: true });
        if (results.length > 0) {
            const uid = results[0].attributes.uid;
            await connection.imap.addFlags(uid, ['\\Seen', '\\Flagged']);
            console.log(`✅ Sender side reply marked as Seen + Flagged`);
        }
        await connection.end();
    } catch (err) {
        console.error(`❌ Error marking sender reply: ${err.message}`);
        throw err;
    }
}

function getRateLimitStats() {
    return {
        hourlyCounts: Object.fromEntries(rateLimitState.hourlyCounts),
        dailyCounts: Object.fromEntries(rateLimitState.dailyCounts),
        concurrentJobs: rateLimitState.concurrentJobs,
        lastReset: rateLimitState.lastReset,
        lastDailyReset: rateLimitState.lastDailyReset,
        config: RATE_LIMIT_CONFIG
    };
}

module.exports = {
    warmupSingleEmail,
    sendScheduledReply,
    computeEmailsToSend,
    computeReplyRate,
    getSenderTypeFromModel,
    getAccountFromDatabase,
    getFreshAccountData,
    getRateLimitStats,
    RATE_LIMIT_CONFIG
};