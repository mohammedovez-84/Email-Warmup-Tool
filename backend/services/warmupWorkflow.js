const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const { sendEmail } = require('./emailSender');
const { checkEmailStatus, moveEmailToInbox, getImapConfig } = require('./imapHelper');
const { maybeReply } = require('./replyHelper');

// ✅ CORRECTED: Import from the actual service files
const { generateEmail: gpt2GenerateEmail, generateReplyWithRetry: gpt2GenerateReplyWithRetry } = require("./aiService");
const { generateEmail: templateGenerateEmail, generateReplyWithRetry: templateGenerateReplyWithRetry } = require("./email-template.service");

const EmailMetric = require('../models/EmailMetric');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const { buildSenderConfig, getSenderType } = require('../utils/senderConfig');

// Rate limiting configuration (keep your existing)
const RATE_LIMIT_CONFIG = {
    minDelayBetweenEmails: 15 * 60 * 1000,
    maxEmailsPerHour: 8,
    maxEmailsPerDay: 20,
    maxConcurrentJobs: 2,
    dailyResetTime: '00:00'
};

// Track rate limiting state (keep your existing)
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


function checkRateLimit(senderEmail, isCoordinatedJob = false) {
    // Skip concurrent job check for coordinated jobs (they're managed by the scheduler)
    if (!isCoordinatedJob) {
        const hourlyCount = rateLimitState.hourlyCounts.get(senderEmail) || 0;
        const dailyCount = rateLimitState.dailyCounts.get(senderEmail) || 0;

        if (hourlyCount >= RATE_LIMIT_CONFIG.maxEmailsPerHour) {
            throw new Error(`Hourly rate limit exceeded for ${senderEmail}: ${hourlyCount}/${RATE_LIMIT_CONFIG.maxEmailsPerHour}`);
        }
        if (dailyCount >= RATE_LIMIT_CONFIG.maxEmailsPerDay) {
            throw new Error(`Daily rate limit exceeded for ${senderEmail}: ${dailyCount}/${RATE_LIMIT_CONFIG.maxEmailsPerDay}`);
        }
        // if (rateLimitState.concurrentJobs >= RATE_LIMIT_CONFIG.maxConcurrentJobs) {
        //     throw new Error(`Too many concurrent jobs: ${rateLimitState.concurrentJobs}/${RATE_LIMIT_CONFIG.maxConcurrentJobs}`);
        // }
    }
    return true;
}

function updateRateLimit(senderEmail, isCoordinatedJob = false) {
    if (!isCoordinatedJob) {
        const hourlyCount = rateLimitState.hourlyCounts.get(senderEmail) || 0;
        const dailyCount = rateLimitState.dailyCounts.get(senderEmail) || 0;
        rateLimitState.hourlyCounts.set(senderEmail, hourlyCount + 1);
        rateLimitState.dailyCounts.set(senderEmail, dailyCount + 1);
    }
}

async function computeReplyRate(account) {
    // Use ACTUAL database fields with safe defaults
    const warmupDayCount = account.warmupDayCount || 0;
    const configuredReplyRate = account.replyRate || 0.25;

    console.log(`📨 Reply rate calculation for ${account.email}:`);
    console.log(`   warmupDayCount: ${warmupDayCount}`);
    console.log(`   configuredReplyRate: ${configuredReplyRate}`);

    // Progressive warmup: start at 15%, increase by 2% daily, max 25%
    const baseRate = 0.15;
    const dailyIncrease = 0.02;
    let calculatedRate = baseRate + (dailyIncrease * warmupDayCount);

    // Cap at configured rate and absolute maximum of 25%
    const maxAllowedRate = Math.min(configuredReplyRate, 0.25);
    calculatedRate = Math.min(calculatedRate, maxAllowedRate);

    // Ensure minimum of 15%
    calculatedRate = Math.max(calculatedRate, 0.15);

    const finalRate = Math.round(calculatedRate * 100) / 100;

    console.log(`   Calculated: ${(finalRate * 100).toFixed(1)}% reply rate`);
    return finalRate;
}

// PROPER DATABASE FIELD USAGE
async function computeEmailsToSend(account) {
    // Use ACTUAL database fields with safe defaults
    const warmupDayCount = account.warmupDayCount || 0;
    const startEmailsPerDay = account.startEmailsPerDay || 3;
    const increaseEmailsPerDay = account.increaseEmailsPerDay || 3;
    const maxEmailsPerDay = account.maxEmailsPerDay || 25;

    console.log(`📊 Send limit calculation for ${account.email}:`);
    console.log(`   warmupDayCount: ${warmupDayCount}`);
    console.log(`   startEmailsPerDay: ${startEmailsPerDay}`);
    console.log(`   increaseEmailsPerDay: ${increaseEmailsPerDay}`);
    console.log(`   maxEmailsPerDay: ${maxEmailsPerDay}`);

    // Progressive warmup formula
    let emailsToSend = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);

    // Cap at account maximum and system maximum
    emailsToSend = Math.min(emailsToSend, maxEmailsPerDay);
    emailsToSend = Math.min(emailsToSend, RATE_LIMIT_CONFIG.maxEmailsPerDay);

    // Ensure minimum of 1 email
    emailsToSend = Math.max(emailsToSend, 1);

    console.log(`   Calculated: ${emailsToSend} emails/day`);
    return emailsToSend;
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

async function warmupSingleEmail(sender, receiver, replyRate = 0.25, isScheduledReply = false, isCoordinatedJob = false) {
    let emailMetric = null;
    let messageId = null;

    try {
        const freshSender = await buildSenderConfig(sender);
        const freshReceiver = await getFreshAccountData(receiver);

        // // ✅ FIX: Skip rate limit check for coordinated jobs (they're managed by scheduler)
        // if (!isScheduledReply && !isCoordinatedJob) {
        //     checkRateLimit(freshSender.email);
        // }

        // ✅ FIX: Only track concurrent jobs for non-coordinated emails
        if (!isCoordinatedJob) {
            rateLimitState.concurrentJobs++;
        }

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

        // ✅ Now using properly built sender config
        const sendResult = await sendEmail(freshSender, {
            to: freshReceiver.email,
            subject: subject.trim(),
            html: html.trim()
        });

        if (!sendResult.success) {
            throw new Error(`Email sending failed: ${sendResult.error}`);
        }

        messageId = sendResult.messageId;

        // ✅ FIX: Only update rate limits for non-coordinated jobs
        if (!isScheduledReply && !isCoordinatedJob) {
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
            emailType: isScheduledReply ? 'scheduled_reply' : (isCoordinatedJob ? 'coordinated' : 'warmup'),
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
        // ✅ FIX: Only decrement for non-coordinated jobs
        if (!isCoordinatedJob) {
            rateLimitState.concurrentJobs = Math.max(0, rateLimitState.concurrentJobs - 1);
        }
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

async function generateEmail(senderName, receiverName, industry = "general") {
    try {
        // Try GPT-2 first for more creative emails
        console.log('🤖 Attempting GPT-2 email generation...');
        return await gpt2GenerateEmail(senderName, receiverName, industry);
    } catch (error) {
        console.log('🔄 GPT-2 failed, using template service...');
        // Fallback to reliable templates
        return await templateGenerateEmail(senderName, receiverName, industry);
    }
}

async function generateReplyWithRetry(originalEmail, maxRetries = 2) {
    try {
        // Try GPT-2 first
        console.log('🤖 Attempting GPT-2 reply generation...');
        return await gpt2GenerateReplyWithRetry(originalEmail, maxRetries);
    } catch (error) {
        console.log('🔄 GPT-2 reply failed, using template service...');
        // Fallback to reliable templates
        return await templateGenerateReplyWithRetry(originalEmail, maxRetries);
    }
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