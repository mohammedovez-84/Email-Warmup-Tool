const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const { sendEmail } = require('../services/schedule/emailSender');
const { checkEmailStatus } = require('../services/schedule/imapHelper'); // Removed moveEmailToInbox import
const { maybeReply } = require('../services/schedule/replyHelper');
const { generateEmail: generateEmailByGpt, generateReply: generateReplyByGpt } = require("../services/email/email-generator");
const { generateReplyWithRetry: templateGenerateReplyWithRetry } = require("../services/email/email-template.service");
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const EmailPool = require('../models/EmailPool');
const { getSenderType } = require('../utils/senderConfig');
const { sequelize } = require('../config/db');
// In warmupSingleEmail function - COMPLETE UPDATED VERSION
const trackingService = require('../services/tracking/trackingService');

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
    let messageId = null;
    let deliveryStatus = null; // 🚨 ADD THIS to track delivery status

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

        // 🚨 TRACK EMAIL SENT WITH NEW SYSTEM
        const emailData = {
            senderEmail: senderConfig.email,
            senderType: senderType,
            receiverEmail: receiver.email,
            receiverType: getReceiverTypeFromModel(receiver),
            subject: subject,
            messageId: messageId,
            emailType: isInitialEmail ? 'warmup_send' : 'warmup_reply',
            direction: direction,
            warmupDay: warmupDay,
            replyRate: replyRate,
            industry: industry,
            isCoordinated: isCoordinatedJob
        };

        await trackingService.trackEmailSent(emailData);

        // Skip IMAP check for Graph API emails or if explicitly skipped
        if (!sendResult.skipImapCheck) {
            // Wait for delivery and check status
            await delay(15000);

            try {
                const statusResult = await checkEmailStatus(receiver, messageId);
                deliveryStatus = statusResult; // 🚨 STORE THE STATUS RESULT

                if (statusResult.success) {
                    const deliveredInbox = statusResult.folder === 'INBOX';

                    // 🚨 TRACK DELIVERY STATUS
                    await trackingService.trackEmailDelivered(messageId, {
                        deliveredInbox: deliveredInbox,
                        deliveryFolder: statusResult.folder,
                        isSpamFolder: statusResult.isSpamFolder || false,
                        spamRisk: statusResult.spamRisk || 'unknown'
                    });

                    // 🚨 REMOVED: Forceful email moving to inbox
                    // We now only track spam folder placement without attempting to move
                    if (statusResult.isSpamFolder) {
                        console.log(`⚠️  Email delivered to spam folder: ${statusResult.folder}`);
                        // Track spam placement for analytics but don't attempt to move
                        await trackingService.trackSpamComplaint(messageId, {
                            complaintType: 'automated_filter',
                            complaintSource: 'ISP_FILTER',
                            complaintFeedback: `Automatically placed in ${statusResult.folder} folder by email provider`,
                            reportingIsp: statusResult.isp || 'unknown',
                            folder: statusResult.folder
                        });
                    }

                } else {
                    // 🚨 TRACK DELIVERY FAILURE
                    await trackingService.trackEmailBounce(messageId, {
                        bounceType: 'soft_bounce',
                        bounceCategory: 'transient',
                        bounceReason: 'IMAP verification failed',
                        canRetry: true
                    });
                }
            } catch (imapError) {
                console.error(`❌ IMAP operation error: ${imapError.message}`);

                // 🚨 TRACK IMAP VERIFICATION ERROR
                await trackingService.trackEmailBounce(messageId, {
                    bounceType: 'soft_bounce',
                    bounceCategory: 'transient',
                    bounceReason: `IMAP error: ${imapError.message}`,
                    canRetry: true
                });
            }
        } else {
            console.log(`⏩ Skipping IMAP check for Graph API email`);
            // For Graph API emails, mark as delivered immediately
            await trackingService.trackEmailDelivered(messageId, {
                deliveredInbox: true,
                deliveryFolder: 'GRAPH_API',
                skipImapCheck: true
            });
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

        console.log(`✅ ${direction} email completed: ${senderConfig.email} → ${receiver.email}`);

        // 🚨 FIXED: Use deliveryStatus instead of statusResult
        return {
            success: true,
            messageId: messageId,
            subject: subject,
            deliveredInbox: deliveryStatus?.deliveredInbox || sendResult.deliveredInbox || false,
            deliveryFolder: deliveryStatus?.folder || sendResult.deliveryFolder,
            isSpamFolder: deliveryStatus?.isSpamFolder || false
        };

    } catch (error) {
        console.error(`❌ Error in warmupSingleEmail:`, error);

        // 🚨 TRACK FAILURE/BOUNCE
        if (messageId) {
            const bounceType = determineBounceType(error);
            await trackingService.trackEmailBounce(messageId, {
                bounceType: bounceType,
                bounceCategory: bounceType === 'hard_bounce' ? 'permanent' : 'transient',
                bounceReason: error.message,
                canRetry: bounceType !== 'hard_bounce'
            });
        }

        throw error;
    }
}

// 🚨 ADDED: Helper function to determine bounce type
function determineBounceType(error) {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('permanent') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('not found') ||
        errorMessage.includes('no such user') ||
        errorMessage.includes('mailbox not found')) {
        return 'hard_bounce';
    }

    if (errorMessage.includes('quota') ||
        errorMessage.includes('full') ||
        errorMessage.includes('spam') ||
        errorMessage.includes('blocked')) {
        return 'blocked';
    }

    if (errorMessage.includes('rate limit') ||
        errorMessage.includes('too many') ||
        errorMessage.includes('temporary') ||
        errorMessage.includes('timeout')) {
        return 'soft_bounce';
    }

    return 'soft_bounce'; // Default to soft bounce for unknown errors
}

// 🚨 UPDATED: processAutomaticReply with new tracking
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

                // 🚨 TRACK REPLY WITH NEW SYSTEM
                await trackingService.trackReply(originalMessageId, {
                    replySender: senderConfig.email,
                    replyReceiver: originalReceiver.email,
                    replyMessageId: replyResult.messageId,
                    repliedAt: new Date(),
                    isAutomatedReply: true,
                    replyQuality: aiReply.is_fallback ? 'generic' : 'medium'
                });

            } else {
                console.error(`❌ Reply failed from ${senderConfig.email}: ${replyResult?.error}`);

                // 🚨 TRACK REPLY FAILURE
                await trackingService.trackReply(originalMessageId, {
                    replySender: senderConfig.email,
                    replyReceiver: originalReceiver.email,
                    repliedAt: new Date(),
                    isAutomatedReply: true,
                    replyQuality: 'failed',
                    error: replyResult?.error
                });
            }
        }
    } catch (replyError) {
        console.error(`❌ Reply error in processAutomaticReply:`, replyError.message);

        // 🚨 TRACK REPLY ERROR
        await trackingService.trackReply(originalMessageId, {
            replySender: senderConfig.email,
            replyReceiver: originalReceiver.email,
            repliedAt: new Date(),
            isAutomatedReply: true,
            replyQuality: 'error',
            error: replyError.message
        });
    }
}

// 🚨 UPDATED: generateReplyWithFallback with tracking
async function generateReplyWithFallback(originalEmail, maxRetries = 2) {
    let attempts = 0;
    let usedFallback = false;

    while (attempts <= maxRetries) {
        try {
            const aiReply = await generateReplyWithRetry(originalEmail);
            if (aiReply && aiReply.reply_content && aiReply.reply_content.trim().length > 10) {
                return {
                    ...aiReply,
                    is_fallback: usedFallback
                };
            }
        } catch (error) {
            console.error(`❌ AI reply generation error (attempt ${attempts + 1}):`, error.message);
        }
        attempts++;
        if (attempts <= maxRetries) {
            await delay(1000 * Math.pow(2, attempts));
        }
    }

    // Mark as fallback
    const fallbackReply = generateFallbackReply(originalEmail);
    return {
        ...fallbackReply,
        is_fallback: true
    };
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

async function generateEmail(senderName, receiverName) {
    try {
        console.log('🤖 Generating email with template service...');
        const result = await generateEmailByGpt(senderName, receiverName);
        return {
            subject: result.subject,
            content: result.body
        };
    } catch (error) {
        console.log('❌ Email generation failed:', error.message);
        throw error;
    }
}

async function generateReplyWithRetry(originalEmail, maxRetries = 2) {
    try {
        console.log('🤖 Attempting GPT-2 reply generation...');
        return await generateReplyByGpt(originalEmail, maxRetries);
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
    determineBounceType,
    RATE_LIMIT_CONFIG
};