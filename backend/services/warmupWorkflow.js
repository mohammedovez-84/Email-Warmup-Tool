const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const { sendEmail } = require('./emailSender');
const { checkEmailStatus, moveEmailToInbox, getImapConfig } = require('./imapHelper');
const { maybeReply } = require('./replyHelper');
const { generateEmail: gpt2GenerateEmail, generateReplyWithRetry: gpt2GenerateReplyWithRetry } = require("./aiService");
const { generateEmail: templateGenerateEmail, generateReplyWithRetry: templateGenerateReplyWithRetry } = require("./email-template.service");

const EmailMetric = require('../models/EmailMetric');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const EmailPool = require('../models/EmailPool');
const { buildSenderConfig, getSenderType } = require('../utils/senderConfig');
const { sequelize } = require('../config/db');

// Enhanced Rate limiting configuration for bidirectional flow
const RATE_LIMIT_CONFIG = {
    minDelayBetweenEmails: 15 * 60 * 1000,
    maxEmailsPerHour: 8,
    maxEmailsPerDay: 20,
    maxConcurrentJobs: 2,
    dailyResetTime: '00:00',
    // Pool-specific limits
    POOL_MAX_DAILY: 50,
    POOL_START_DAILY: 10
};

// Enhanced rate limiting state with pool tracking
const rateLimitState = {
    hourlyCounts: new Map(),
    dailyCounts: new Map(),
    poolDailyCounts: new Map(), // Track pool account usage separately
    lastReset: Date.now(),
    lastDailyReset: new Date().setHours(0, 0, 0, 0),
    concurrentJobs: 0
};

// Reset counts every hour
setInterval(() => {
    rateLimitState.hourlyCounts.clear();
    rateLimitState.lastReset = Date.now();
}, 60 * 60 * 1000);

// Reset daily counts every 24 hours
setInterval(() => {
    rateLimitState.dailyCounts.clear();
    rateLimitState.poolDailyCounts.clear();
    rateLimitState.lastDailyReset = new Date().setHours(0, 0, 0, 0);
}, 24 * 60 * 60 * 1000);

function extractNameFromEmail(email) {
    if (!email) return "User";
    const localPart = email.split("@")[0];
    return localPart.split(/[._-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

// ENHANCED: Check rate limits with pool account support
function checkRateLimit(senderEmail, senderType = 'warmup', isCoordinatedJob = false) {
    if (!isCoordinatedJob) {
        if (senderType === 'pool') {
            // Pool account rate limiting
            const dailyCount = rateLimitState.poolDailyCounts.get(senderEmail) || 0;
            if (dailyCount >= RATE_LIMIT_CONFIG.POOL_MAX_DAILY) {
                throw new Error(`Pool daily rate limit exceeded for ${senderEmail}: ${dailyCount}/${RATE_LIMIT_CONFIG.POOL_MAX_DAILY}`);
            }
        } else {
            // Warmup account rate limiting
            const hourlyCount = rateLimitState.hourlyCounts.get(senderEmail) || 0;
            const dailyCount = rateLimitState.dailyCounts.get(senderEmail) || 0;

            if (hourlyCount >= RATE_LIMIT_CONFIG.maxEmailsPerHour) {
                throw new Error(`Hourly rate limit exceeded for ${senderEmail}: ${hourlyCount}/${RATE_LIMIT_CONFIG.maxEmailsPerHour}`);
            }
            if (dailyCount >= RATE_LIMIT_CONFIG.maxEmailsPerDay) {
                throw new Error(`Daily rate limit exceeded for ${senderEmail}: ${dailyCount}/${RATE_LIMIT_CONFIG.maxEmailsPerDay}`);
            }
        }
    }
    return true;
}

// ENHANCED: Update rate limits with pool account support
function updateRateLimit(senderEmail, senderType = 'warmup', isCoordinatedJob = false) {
    if (!isCoordinatedJob) {
        if (senderType === 'pool') {
            const dailyCount = rateLimitState.poolDailyCounts.get(senderEmail) || 0;
            rateLimitState.poolDailyCounts.set(senderEmail, dailyCount + 1);
        } else {
            const hourlyCount = rateLimitState.hourlyCounts.get(senderEmail) || 0;
            const dailyCount = rateLimitState.dailyCounts.get(senderEmail) || 0;
            rateLimitState.hourlyCounts.set(senderEmail, hourlyCount + 1);
            rateLimitState.dailyCounts.set(senderEmail, dailyCount + 1);
        }
    }
}

// ENHANCED: Compute emails with pool account support
async function computeEmailsToSend(account) {
    // Handle pool accounts differently
    if (account.providerType || account.isActive !== undefined) {
        // This is likely a pool account
        const currentSent = account.currentDaySent || 0;
        const maxAllowed = account.maxEmailsPerDay || RATE_LIMIT_CONFIG.POOL_MAX_DAILY;
        const remaining = Math.max(0, maxAllowed - currentSent);

        console.log(`📊 Pool capacity for ${account.email}:`);
        console.log(`   Current sent: ${currentSent}`);
        console.log(`   Max allowed: ${maxAllowed}`);
        console.log(`   Remaining capacity: ${remaining}`);

        return remaining;
    }

    // Original warmup account logic
    const warmupDayCount = account.warmupDayCount || 0;
    const startEmailsPerDay = account.startEmailsPerDay || 3;
    const increaseEmailsPerDay = account.increaseEmailsPerDay || 3;
    const maxEmailsPerDay = account.maxEmailsPerDay || 25;

    console.log(`📊 Send limit calculation for ${account.email}:`);
    console.log(`   warmupDayCount: ${warmupDayCount}`);
    console.log(`   startEmailsPerDay: ${startEmailsPerDay} (FROM DB)`);
    console.log(`   increaseEmailsPerDay: ${increaseEmailsPerDay} (FROM DB)`);
    console.log(`   maxEmailsPerDay: ${maxEmailsPerDay} (FROM DB)`);

    let emailsToSend = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
    emailsToSend = Math.min(emailsToSend, maxEmailsPerDay);
    emailsToSend = Math.min(emailsToSend, RATE_LIMIT_CONFIG.maxEmailsPerDay);
    emailsToSend = Math.max(emailsToSend, 1);

    console.log(`   Calculated: ${emailsToSend} emails/day`);
    return emailsToSend;
}

async function computeReplyRate(account) {
    const configuredReplyRate = account.replyRate || 0.25;
    console.log(`📨 Reply rate calculation for ${account.email}:`);
    console.log(`   configuredReplyRate from DB: ${configuredReplyRate}`);
    const finalRate = Math.min(configuredReplyRate, 1.0);
    console.log(`   ✅ Final reply rate: ${(finalRate * 100).toFixed(1)}%`);
    return finalRate;
}

async function getAccountFromDatabase(email) {
    try {
        let account = await GoogleUser.findOne({ where: { email } });
        if (account) return account;

        account = await MicrosoftUser.findOne({ where: { email } });
        if (account) return account;

        account = await SmtpAccount.findOne({ where: { email } });
        if (account) return account;

        account = await EmailPool.findOne({ where: { email } });
        if (account) return account;

        return null;
    } catch (error) {
        console.error(`❌ Database query error: ${error.message}`);
        return null;
    }
}

async function getFreshAccountData(account) {
    try {
        if (!account || !account.email) {
            console.error('❌ Invalid account provided to getFreshAccountData:', account);
            throw new Error('Invalid account provided to getFreshAccountData');
        }

        console.log(`🔍 Refreshing account data for: ${account.email}`);

        // Re-fetch the account to ensure we have latest data
        let freshAccount = null;

        // Check all possible models
        freshAccount = await EmailPool.findOne({ where: { email: account.email } });
        if (!freshAccount) freshAccount = await GoogleUser.findOne({ where: { email: account.email } });
        if (!freshAccount) freshAccount = await MicrosoftUser.findOne({ where: { email: account.email } });
        if (!freshAccount) freshAccount = await SmtpAccount.findOne({ where: { email: account.email } });

        if (!freshAccount) {
            console.error(`❌ Account not found in database: ${account.email}`);
            return account; // Return original as fallback
        }

        // **CRITICAL: Convert to plain object and ensure all fields are present**
        const plainAccount = freshAccount.get ? freshAccount.get({ plain: true }) : freshAccount;

        // **ENSURE PROVIDER TYPE IS SET**
        if (!plainAccount.providerType) {
            if (plainAccount.microsoft_id) {
                plainAccount.providerType = 'MICROSOFT_ORGANIZATIONAL';
            } else if (plainAccount.access_token || plainAccount.refresh_token) {
                // Check email domain to determine if personal or organizational
                if (plainAccount.email && (plainAccount.email.endsWith('@outlook.com') ||
                    plainAccount.email.endsWith('@hotmail.com') ||
                    plainAccount.email.endsWith('@live.com'))) {
                    plainAccount.providerType = 'OUTLOOK_PERSONAL';
                } else {
                    plainAccount.providerType = 'MICROSOFT_ORGANIZATIONAL';
                }
            }
        }

        console.log(`✅ Refreshed account data for: ${plainAccount.email}`);
        console.log(`   ProviderType: ${plainAccount.providerType}`);
        console.log(`   Has access_token: ${!!plainAccount.access_token}`);
        console.log(`   Has refresh_token: ${!!plainAccount.refresh_token}`);

        return plainAccount;

    } catch (error) {
        console.error('❌ Error in getFreshAccountData:', error.message);
        return account; // Return original as fallback
    }
}

function getSenderTypeFromModel(sender) {
    return getSenderType(sender);
}

function getReceiverTypeFromModel(receiver) {
    if (receiver.providerType) {
        return 'pool';
    }
    return getSenderType(receiver);
}

// NEW: Check if pool account can send more emails
async function canPoolSendMore(poolAccount) {
    try {
        // Refresh pool account data to get current counts
        const freshPool = await getFreshAccountData(poolAccount);
        if (!freshPool) return false;

        const today = new Date().toDateString();

        // Reset if new day
        if (freshPool.lastResetDate && new Date(freshPool.lastResetDate).toDateString() !== today) {
            console.log(`🔄 Resetting daily count for pool: ${freshPool.email}`);
            await resetPoolDailyCount(freshPool.email);
            return true; // Reset to 0, so can send
        }

        const currentSent = freshPool.currentDaySent || 0;
        const maxAllowed = freshPool.maxEmailsPerDay || RATE_LIMIT_CONFIG.POOL_MAX_DAILY;

        const canSend = currentSent < maxAllowed;

        if (!canSend) {
            console.log(`⏩ Pool ${freshPool.email} at daily limit: ${currentSent}/${maxAllowed}`);
        }

        return canSend;
    } catch (error) {
        console.error(`❌ Error checking pool capacity for ${poolAccount.email}:`, error);
        return false;
    }
}

// NEW: Update pool account sent count
async function updatePoolSentCount(poolEmail) {
    try {
        await EmailPool.update(
            {
                currentDaySent: sequelize.literal('currentDaySent + 1'),
                lastResetDate: new Date()
            },
            { where: { email: poolEmail } }
        );
        console.log(`📈 Updated pool sent count for: ${poolEmail}`);
    } catch (error) {
        console.error(`❌ Error updating pool sent count for ${poolEmail}:`, error);
    }
}

// NEW: Reset pool daily count
async function resetPoolDailyCount(poolEmail) {
    try {
        await EmailPool.update(
            {
                currentDaySent: 0,
                lastResetDate: new Date()
            },
            { where: { email: poolEmail } }
        );
        console.log(`🔄 Reset daily count for pool: ${poolEmail}`);
    } catch (error) {
        console.error(`❌ Error resetting pool daily count for ${poolEmail}:`, error);
    }
}

async function warmupSingleEmail(senderConfig, receiver, replyRate = 0.25, isScheduledReply = false, isCoordinatedJob = false, isInitialEmail = false, direction = 'WARMUP_TO_POOL') {
    let emailMetric = null;
    let messageId = null;

    try {
        console.log(`📧 Starting ${direction}: ${senderConfig.email} → ${receiver.email} [${isInitialEmail ? 'INITIAL' : 'REPLY'}]`);

        // Determine sender type for rate limiting
        const senderType = direction === 'POOL_TO_WARMUP' ? 'pool' : 'warmup';
        console.log(`   Sender type: ${senderType}, Coordinated: ${isCoordinatedJob}`);

        // Check rate limits with sender type support
        if (!isCoordinatedJob) {
            checkRateLimit(senderConfig.email, senderType, isCoordinatedJob);
        }

        // For pool accounts, check database capacity
        if (senderType === 'pool' && !await canPoolSendMore(senderConfig)) {
            throw new Error(`Pool account ${senderConfig.email} has reached daily limit`);
        }

        const senderName = extractNameFromEmail(senderConfig.email);
        const receiverName = extractNameFromEmail(receiver.email);
        const industry = senderConfig.industry || 'general';
        const warmupDay = senderConfig.warmupDayCount || 0;

        // Generate email content
        const aiEmail = await generateEmail(senderName, receiverName, industry);
        if (!aiEmail || !aiEmail.subject || !aiEmail.content) {
            throw new Error('AI email generation failed');
        }

        const { subject, content: html } = aiEmail;

        // Send email using the pre-built sender config
        const sendResult = await sendEmail(senderConfig, {
            to: receiver.email,
            subject: subject.trim(),
            html: html.trim()
        });

        messageId = sendResult.messageId;

        // Update rate limits with sender type support
        if (!isCoordinatedJob) {
            updateRateLimit(senderConfig.email, senderType, isCoordinatedJob);
        }

        // For pool accounts, update database count
        if (senderType === 'pool') {
            await updatePoolSentCount(senderConfig.email);
        }

        // Create email metric with direction information
        emailMetric = await EmailMetric.create({
            senderEmail: senderConfig.email,
            senderType: senderType,
            receiverEmail: receiver.email,
            receiverType: getReceiverTypeFromModel(receiver),
            messageId: messageId,
            subject: subject,
            sentAt: new Date(),
            deliveredInbox: sendResult.deliveredInbox || false,
            replied: false,
            warmupDay: warmupDay,
            replyRate: replyRate,
            emailType: isInitialEmail ? 'warmup_send' : 'warmup_reply',
            industry: industry,
            isCoordinated: isCoordinatedJob,
            direction: direction
        });

        // Skip IMAP check for Graph API emails or if explicitly skipped
        if (!sendResult.skipImapCheck) {
            // Wait for delivery and check status
            await delay(15000);

            try {
                const statusResult = await checkEmailStatus(receiver, messageId);
                if (statusResult.success) {
                    const deliveredInbox = statusResult.folder === 'INBOX';
                    await EmailMetric.update({
                        deliveredInbox,
                        deliveryFolder: statusResult.folder
                    }, { where: { id: emailMetric.id } });

                    // Try to move to inbox if not delivered
                    if (!deliveredInbox) {
                        try {
                            await moveEmailToInbox(receiver, messageId, statusResult.folder);
                            console.log(`📥 Attempted to move email to inbox`);
                        } catch (moveError) {
                            console.log(`⚠️  Could not move email to inbox: ${moveError.message}`);
                        }
                    }
                }
            } catch (imapError) {
                console.error(`❌ IMAP operation error: ${imapError.message}`);
            }
        } else {
            console.log(`⏩ Skipping IMAP check for Graph API email`);
            // For Graph API emails, mark as delivered immediately
            await EmailMetric.update({
                deliveredInbox: true,
                deliveryFolder: 'GRAPH_API'
            }, { where: { id: emailMetric.id } });
        }

        // Handle automatic replies based on reply rate (only for initial emails, not replies)
        if (isInitialEmail && !isScheduledReply && direction === 'WARMUP_TO_POOL') {
            const shouldReply = Math.random() < replyRate;
            if (shouldReply) {
                console.log(`🔄 Processing reply (${(replyRate * 100).toFixed(1)}% rate)`);
                await processAutomaticReply(senderConfig, receiver, aiEmail, messageId);
            } else {
                console.log(`⏩ Skipping reply (${(replyRate * 100).toFixed(1)}% rate)`);
            }
        }

        await EmailMetric.update({
            completedAt: new Date(),
            status: 'completed'
        }, { where: { id: emailMetric.id } });

        console.log(`✅ ${direction} email completed: ${senderConfig.email} → ${receiver.email}`);

    } catch (error) {
        console.error(`❌ Error in warmupSingleEmail:`, error);

        if (emailMetric) {
            await EmailMetric.update({
                error: error.message.substring(0, 500),
                status: 'failed',
                completedAt: new Date()
            }, { where: { id: emailMetric.id } });
        }
        throw error;
    }
}

async function processAutomaticReply(senderConfig, originalReceiver, originalEmail, originalMessageId) {
    try {
        console.log(`🤖 Generating reply from ${originalReceiver.email} to ${senderConfig.email}`);

        const aiReply = await generateReplyWithFallback(originalEmail);

        if (aiReply && aiReply.reply_content) {
            const replySubject = originalEmail.subject.startsWith('Re:') ?
                originalEmail.subject : `Re: ${originalEmail.subject}`;

            await delay(10000);

            // Get fresh account data from database for the replier
            const freshReplierAccount = await getFreshAccountData({ email: senderConfig.email });

            if (!freshReplierAccount) {
                console.error(`❌ Could not fetch fresh account data for: ${senderConfig.email}`);
                return;
            }

            console.log(`🔧 Using fresh account data for reply:`, {
                email: freshReplierAccount.email,
                providerType: freshReplierAccount.providerType,
                hasAppPassword: !!freshReplierAccount.app_password,
                hasOAuth2: !!(freshReplierAccount.access_token || freshReplierAccount.accessToken)
            });

            // Pass the RAW ACCOUNT DATA to maybeReply, not the built config
            const replyResult = await maybeReply(freshReplierAccount, {
                to: originalReceiver.email, // Reply TO the original receiver
                subject: replySubject,
                html: aiReply.reply_content,
                inReplyTo: originalMessageId,
                references: [originalMessageId]
            }, 1.0);

            if (replyResult?.success) {
                console.log(`✅ Reply sent successfully from ${senderConfig.email}`);

                // Update metrics
                await EmailMetric.update({
                    replied: true,
                    repliedAt: new Date(),
                    replyMessageId: replyResult.messageId
                }, {
                    where: {
                        messageId: originalMessageId
                    }
                });
            } else {
                console.error(`❌ Reply failed from ${senderConfig.email}: ${replyResult?.error}`);
            }
        }
    } catch (replyError) {
        console.error(`❌ Reply error in processAutomaticReply:`, replyError.message);
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

// ENHANCED: Get rate limit stats with pool tracking
function getRateLimitStats() {
    return {
        hourlyCounts: Object.fromEntries(rateLimitState.hourlyCounts),
        dailyCounts: Object.fromEntries(rateLimitState.dailyCounts),
        poolDailyCounts: Object.fromEntries(rateLimitState.poolDailyCounts),
        concurrentJobs: rateLimitState.concurrentJobs,
        lastReset: rateLimitState.lastReset,
        lastDailyReset: rateLimitState.lastDailyReset,
        config: RATE_LIMIT_CONFIG
    };
}

async function generateEmail(senderName, receiverName, industry = "general") {
    try {
        console.log('🤖 Attempting GPT-2 email generation...');
        return await gpt2GenerateEmail(senderName, receiverName, industry);
    } catch (error) {
        console.log('🔄 GPT-2 failed, using template service...');
        return await templateGenerateEmail(senderName, receiverName, industry);
    }
}

async function generateReplyWithRetry(originalEmail, maxRetries = 2) {
    try {
        console.log('🤖 Attempting GPT-2 reply generation...');
        return await gpt2GenerateReplyWithRetry(originalEmail, maxRetries);
    } catch (error) {
        console.log('🔄 GPT-2 reply failed, using template service...');
        return await templateGenerateReplyWithRetry(originalEmail, maxRetries);
    }
}

module.exports = {
    warmupSingleEmail,
    computeEmailsToSend,
    computeReplyRate,
    getSenderTypeFromModel,
    getAccountFromDatabase,
    getFreshAccountData,
    getRateLimitStats,
    canPoolSendMore,
    updatePoolSentCount,
    resetPoolDailyCount,
    RATE_LIMIT_CONFIG
};