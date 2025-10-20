const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const { sendEmail } = require('./emailSender');
const { checkEmailStatus, moveEmailToInbox, getImapConfig } = require('./imapHelper');
const { maybeReply } = require('./replyHelper');
const { generateEmail, generateReplyWithRetry } = require("./aiService");
const EmailMetric = require('../models/EmailMetric');

// Import models for receiver lookup
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');

// Enhanced Rate limiting configuration
const RATE_LIMIT_CONFIG = {
    minDelayBetweenEmails: 15 * 60 * 1000, // 15 minutes minimum between emails
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
    console.log('🕐 Hourly rate limit counters reset');
}, 60 * 60 * 1000);

// Reset daily counts every 24 hours
setInterval(() => {
    rateLimitState.dailyCounts.clear();
    rateLimitState.lastDailyReset = new Date().setHours(0, 0, 0, 0);
    console.log('📅 Daily rate limit counters reset');
}, 24 * 60 * 60 * 1000);

function extractNameFromEmail(email) {
    if (!email) return "User";
    const localPart = email.split("@")[0];
    return localPart
        .split(/[._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// Enhanced rate limiting check
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

// Update rate limit counters
function updateRateLimit(senderEmail) {
    const hourlyCount = rateLimitState.hourlyCounts.get(senderEmail) || 0;
    const dailyCount = rateLimitState.dailyCounts.get(senderEmail) || 0;

    rateLimitState.hourlyCounts.set(senderEmail, hourlyCount + 1);
    rateLimitState.dailyCounts.set(senderEmail, dailyCount + 1);
}

// Fixed: Compute emails to send with proper gradual increase
function computeEmailsToSend(sender) {
    const warmupDayCount = sender.warmupDayCount || 0;
    const startEmailsPerDay = sender.startEmailsPerDay || 3;
    const increaseEmailsPerDay = sender.increaseEmailsPerDay || 2;
    const maxEmailsPerDay = sender.maxEmailsPerDay || 25;

    let emailsToSend = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);

    // Ensure within bounds
    emailsToSend = Math.min(emailsToSend, maxEmailsPerDay);
    emailsToSend = Math.max(emailsToSend, 1);

    // Cap at daily rate limit
    emailsToSend = Math.min(emailsToSend, RATE_LIMIT_CONFIG.maxEmailsPerDay);

    return emailsToSend;
}

// Fixed: Compute reply rate with strict 25% cap
function computeReplyRate(sender) {
    const baseRate = 0.20; // Start with 20%
    const dailyIncrease = 0.02; // Increase by 2% daily
    const warmupDayCount = sender.warmupDayCount || 0;

    let replyRate = baseRate + (dailyIncrease * warmupDayCount);

    // Strict cap at 25%
    replyRate = Math.min(replyRate, 0.25);
    replyRate = Math.max(replyRate, 0.15);

    return Math.round(replyRate * 100) / 100;
}

// Fixed: Get sender type from model
function getSenderTypeFromModel(sender) {
    if (sender.roundRobinIndexGoogle !== undefined || sender.provider === 'google') {
        return 'google';
    } else if (sender.roundRobinIndexMicrosoft !== undefined || sender.provider === 'microsoft') {
        return 'microsoft';
    } else if (sender.roundRobinIndexCustom !== undefined || sender.smtp_host) {
        return 'smtp';
    }
    return 'unknown';
}

// Fixed: Get receiver type from model
function getReceiverTypeFromModel(receiver) {
    if (receiver.roundRobinIndexGoogle !== undefined || receiver.provider === 'google') {
        return 'google';
    } else if (receiver.roundRobinIndexMicrosoft !== undefined || receiver.provider === 'microsoft') {
        return 'microsoft';
    } else if (receiver.roundRobinIndexCustom !== undefined || receiver.smtp_host) {
        return 'smtp';
    }
    return 'unknown';
}

// Enhanced warmup email workflow with proper metrics tracking
async function warmupSingleEmail(sender, receiver, replyRate = 0.25) {
    let emailMetric = null;
    let messageId = null;

    try {
        // Check rate limits before starting
        checkRateLimit(sender.email);

        // Update concurrent job counter
        rateLimitState.concurrentJobs++;
        console.log(`📊 Concurrent jobs: ${rateLimitState.concurrentJobs}/${RATE_LIMIT_CONFIG.maxConcurrentJobs}`);

        const senderName = extractNameFromEmail(sender.email);
        const receiverName = extractNameFromEmail(receiver.email);

        console.log(`📨 Starting warmup: ${sender.email} -> ${receiver.email} (Reply rate: ${(replyRate * 100).toFixed(1)}%)`);

        // Generate AI email
        const aiEmail = await generateEmail(senderName, receiverName, sender.industry || "general");
        if (!aiEmail || !aiEmail.subject || !aiEmail.content) {
            console.error("❌ Failed to generate valid warmup email");
            throw new Error('AI email generation failed');
        }

        const { subject, content: html } = aiEmail;

        // Send email
        const sendResult = await sendEmail(sender, {
            to: receiver.email,
            subject: subject.trim(),
            html: html.trim()
        });

        if (!sendResult.success) {
            console.error(`❌ Failed to send email: ${sendResult.error}`);
            throw new Error(`Email sending failed: ${sendResult.error}`);
        }

        messageId = sendResult.messageId;
        console.log(`✅ Email sent to ${receiver.email}: ${messageId}`);

        // Update rate limit counter
        updateRateLimit(sender.email);

        // Create EmailMetric record immediately
        emailMetric = await EmailMetric.create({
            senderEmail: sender.email,
            senderType: getSenderTypeFromModel(sender),
            receiverEmail: receiver.email,
            receiverType: getReceiverTypeFromModel(receiver),
            messageId: messageId,
            subject: subject,
            sentAt: new Date(),
            deliveredInbox: false,
            replied: false,
            warmupDay: sender.warmupDayCount || 0,
            replyRate: replyRate
        });

        // Wait before checking status
        await delay(10000);

        // Check IMAP status and update delivery metrics
        let folder = 'UNKNOWN';
        let deliveredInbox = false;

        try {
            const statusResult = await checkEmailStatus(receiver, messageId);
            if (statusResult.success) {
                folder = statusResult.folder;
                deliveredInbox = folder === 'INBOX';

                await EmailMetric.update({
                    deliveredInbox: deliveredInbox,
                    deliveryFolder: folder
                }, { where: { id: emailMetric.id } });

                if (!deliveredInbox && folder !== 'NOT_FOUND' && folder !== 'UNKNOWN') {
                    console.log(`📦 Moving email from ${folder} to INBOX`);
                    const moveResult = await moveEmailToInbox(receiver, messageId, folder);

                    if (moveResult && moveResult.success) {
                        // Verify move was successful after a delay
                        await delay(8000);
                        const postMoveStatus = await checkEmailStatus(receiver, messageId);

                        if (postMoveStatus.success && postMoveStatus.folder === 'INBOX') {
                            await EmailMetric.update({
                                deliveredInbox: true,
                                movedToInbox: true
                            }, { where: { id: emailMetric.id } });
                            console.log(`✅ Successfully moved email to INBOX`);
                            deliveredInbox = true;
                        }
                    } else {
                        console.error(`❌ Failed to move email: ${moveResult?.error || 'Unknown error'}`);
                    }
                }
            } else {
                console.error(`❌ IMAP check failed: ${statusResult.error}`);
            }
        } catch (imapError) {
            console.error(`❌ IMAP operation error: ${imapError.message}`);
        }

        // AI Reply based on replyRate (with proper probability)
        const shouldReply = Math.random() < replyRate;
        if (shouldReply) {
            console.log(`🔄 Generating reply from ${receiver.email} (${(replyRate * 100).toFixed(1)}% rate triggered)`);

            try {
                const aiReply = await generateReplyWithFallback(aiEmail);

                if (aiReply && aiReply.reply_content) {
                    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
                    const replyHtml = aiReply.reply_content;

                    console.log(`📝 Sending reply: ${receiver.email} -> ${sender.email}`);

                    // Add delay before sending reply
                    await delay(5000);

                    const replyResult = await maybeReply(receiver, {
                        to: sender.email,
                        subject: replySubject,
                        html: replyHtml,
                        inReplyTo: messageId,
                        references: [messageId]
                    }, 1.0); // Always send reply if we decided to reply

                    if (replyResult?.success && replyResult.messageId) {
                        await EmailMetric.update({
                            replied: true,
                            repliedAt: new Date(),
                            replyMessageId: replyResult.messageId
                        }, { where: { id: emailMetric.id } });
                        console.log(`✅ Reply sent successfully: ${receiver.email} -> ${sender.email}`);

                        // Mark sender reply as Seen + Flagged
                        try {
                            await markEmailAsSeenAndFlagged(sender, replyResult.messageId);
                        } catch (markError) {
                            console.error(`⚠️ Could not mark email as seen/flagged: ${markError.message}`);
                        }
                    } else {
                        console.error(`❌ Reply sending failed: ${replyResult?.error}`);
                        await EmailMetric.update({
                            replyError: replyResult?.error?.substring(0, 255) || 'Reply failed'
                        }, { where: { id: emailMetric.id } });
                    }
                } else {
                    console.error(`❌ Failed to generate valid reply content`);
                }
            } catch (replyError) {
                console.error(`❌ Reply generation/processing error: ${replyError.message}`);
                await EmailMetric.update({
                    replyError: replyError.message.substring(0, 255)
                }, { where: { id: emailMetric.id } });
            }
        } else {
            const randomValue = Math.random().toFixed(2);
            console.log(`⏭️ Skipping reply (${(replyRate * 100).toFixed(1)}% rate, random: ${randomValue})`);
        }

        console.log(`✅ Warmup completed for ${sender.email} -> ${receiver.email}`);

        // Final metric update for success
        await EmailMetric.update({
            completedAt: new Date(),
            status: 'completed'
        }, { where: { id: emailMetric.id } });

    } catch (error) {
        console.error(`❌ Error in warmupSingleEmail:`, error);

        // Update metric with failure if it was created
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
        // Always decrement concurrent job counter
        rateLimitState.concurrentJobs = Math.max(0, rateLimitState.concurrentJobs - 1);
    }
}

// Enhanced AI reply generation with fallbacks
async function generateReplyWithFallback(originalEmail, maxRetries = 2) {
    let attempts = 0;

    while (attempts <= maxRetries) {
        try {
            console.log(`🔄 Generating AI reply (attempt ${attempts + 1}/${maxRetries + 1})`);
            const aiReply = await generateReplyWithRetry(originalEmail);

            if (aiReply && aiReply.reply_content && aiReply.reply_content.trim().length > 10) {
                console.log(`✅ Successfully generated reply content (length: ${aiReply.reply_content.length})`);
                return aiReply;
            }
        } catch (error) {
            console.error(`❌ AI reply generation error (attempt ${attempts + 1}):`, error.message);
        }

        attempts++;
        if (attempts <= maxRetries) {
            const delayMs = 1000 * Math.pow(2, attempts);
            console.log(`⏳ Retrying in ${delayMs / 1000}s...`);
            await delay(delayMs);
        }
    }

    console.log(`🔄 Using fallback reply content`);
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

    return {
        reply_content: randomReply,
        is_fallback: true
    };
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

// Get current rate limit stats for monitoring
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
    computeEmailsToSend,
    computeReplyRate,
    getSenderTypeFromModel,
    getRateLimitStats,
    RATE_LIMIT_CONFIG
};