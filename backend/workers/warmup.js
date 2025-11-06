// workers/warmupWorker.js - COMPLETE FIXED VERSION
const EmailExchange = require("../models/MailExchange")
require('dotenv').config({ path: '../.env' });
const { Op } = require('sequelize');
const getChannel = require('../queues/rabbitConnection');
const {
    warmupSingleEmail,
    canPoolSendMore,
} = require('../workflows/warmupWorkflow');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const EmailPool = require('../models/EmailPool');
const { buildWarmupConfig, buildPoolConfig } = require('../utils/senderConfig');
const VolumeEnforcement = require('../services/volume/volume-enforcement');
const trackingService = require('../services/tracking/trackingService');
const analyticsService = require('../services/analytics/AnalyticsService');

const volumeEnforcement = new VolumeEnforcement();

// Add to your imports at the top
const {
    checkEmailStatusWithSpamTracking,
    moveEmailToInboxWithTracking
} = require('../services/schedule/imapHelper');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class WarmupWorker {
    constructor() {
        this.processing = false;
        this.lastProcessedTime = 0;
        this.MIN_JOB_INTERVAL = 60 * 1000; // 1 minutes between jobs
        this.currentJobQueue = [];
        this.isProcessingQueue = false;

        // Job sequencing control
        this.jobSequence = new Map();
        this.sequencedJobs = new Set();
    }


    // 1. Queue Consumption
    async consumeWarmupJobs() {
        const channel = await getChannel();
        await channel.assertQueue('warmup_jobs', { durable: true });
        channel.prefetch(1);
        console.log('🚀 Warmup Worker Started - Sequential Processing Enabled');

        channel.consume('warmup_jobs', async (msg) => {
            if (!msg) return;
            await this.addJobToQueue(channel, msg);
        }, { noAck: false });
    }

    // 🚨 ADDED: Queue Management
    async addJobToQueue(channel, msg) {
        const job = JSON.parse(msg.content.toString());
        const jobKey = this.getJobKey(job);

        // Add to processing queue
        this.currentJobQueue.push({ channel, msg, job, jobKey });

        console.log(`📥 Added job to queue: ${jobKey}`);
        console.log(`   Queue size: ${this.currentJobQueue.length}`);

        // Start processing if not already running
        if (!this.isProcessingQueue) {
            this.processQueueSequentially();
        }
    }


    async processSingleJob(channel, msg, job) {
        const jobKey = this.getJobKey(job);

        try {
            console.log(`\n🔨 PROCESSING: ${job.direction}`);
            console.log(`   ${job.pairs[0].senderEmail} → ${job.pairs[0].receiverEmail}`);

            // 🚨 TEMPORARY: Skip Outlook accounts
            if (await this.shouldSkipOutlookAccount(job.warmupAccount, job.direction)) {
                console.log(`⏩ SKIPPING: Outlook account needs reauthentication`);
                channel.ack(msg);
                return;
            }

            // 🚨 GRACEFUL VOLUME CHECK
            const warmupAccount = job.warmupAccount;
            let canExecute = false;

            try {
                // Use the instance method instead of static method
                canExecute = await volumeEnforcement.canAccountSendEmail(warmupAccount, 'warmup');
            } catch (volumeError) {
                console.log(`   ⚠️  Volume check failed for ${warmupAccount}: ${volumeError.message}`);
                canExecute = true; // Continue anyway for now
            }

            if (!canExecute) {
                console.log(`💥 EXECUTION BLOCKED: ${warmupAccount} at volume limit - ACKNOWLEDGING JOB`);
                channel.ack(msg);
                return;
            }

            // Process the job
            if (job.individualSchedule) {
                await this.processIndividualEmail(job);
            } else {
                await this.processCoordinatedTimeSlot(job);
            }

            channel.ack(msg);
            console.log(`✅ EXECUTION COMPLETED`);

        } catch (error) {
            console.error(`❌ EXECUTION FAILED:`, error);
            channel.ack(msg);
        }
    }

    async processQueueSequentially() {
        if (this.isProcessingQueue || this.currentJobQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.currentJobQueue.length > 0) {
            const { channel, msg, job, jobKey } = this.currentJobQueue[0];

            try {
                console.log(`\n🔨 PROCESSING JOB: ${jobKey}`);
                console.log(`   Queue position: 1/${this.currentJobQueue.length}`);

                await this.processSingleJob(channel, msg, job);

                // Remove from queue after successful processing
                this.currentJobQueue.shift();

                console.log(`✅ Job completed: ${jobKey}`);
                console.log(`   Remaining in queue: ${this.currentJobQueue.length}`);

                // Enforce minimum delay between jobs
                if (this.currentJobQueue.length > 0) {
                    const delayMs = this.calculateDynamicDelay(job, this.currentJobQueue[0].job);
                    console.log(`⏳ Enforcing delay: ${Math.round(delayMs / 1000)}s before next job`);
                    await this.delay(delayMs);
                }

            } catch (error) {
                console.error(`❌ Job failed: ${jobKey}`, error.message);
                await this.handleJobFailure(channel, msg, job, error);
                this.currentJobQueue.shift();
            }
        }

        this.isProcessingQueue = false;
        console.log('📭 Job queue empty - waiting for new jobs');
    }

    async processSingleJob(channel, msg, job) {
        const jobKey = this.getJobKey(job);

        try {
            console.log(`\n🔨 PROCESSING: ${job.direction}`);
            console.log(`   ${job.pairs[0].senderEmail} → ${job.pairs[0].receiverEmail}`);

            // 🚨 GRACEFUL VOLUME CHECK
            const warmupAccount = job.warmupAccount;
            let canExecute = false;

            try {
                canExecute = await volumeEnforcement.canAccountSendEmail(warmupAccount, 'warmup');
            } catch (volumeError) {
                console.log(`   ⚠️  Volume check failed for ${warmupAccount}: ${volumeError.message}`);
                canExecute = true; // Continue anyway
            }

            if (!canExecute) {
                console.log(`💥 EXECUTION BLOCKED: ${warmupAccount} at volume limit - ACKNOWLEDGING JOB`);

                // 🚨 CRITICAL: REVERSE THE TRACKING SINCE WE'RE NOT EXECUTING
                await volumeEnforcement.reverseScheduledEmail(warmupAccount, job.direction);

                channel.ack(msg);
                return;
            }

            // Process the job
            if (job.individualSchedule) {
                await this.processIndividualEmail(job);
            } else {
                await this.processCoordinatedTimeSlot(job);
            }

            channel.ack(msg);
            console.log(`✅ EXECUTION COMPLETED`);

        } catch (error) {
            console.error(`❌ EXECUTION FAILED:`, error);

            // 🚨 REVERSE TRACKING ON FAILURE TOO
            if (job.warmupAccount) {
                await volumeEnforcement.reverseScheduledEmail(job.warmupAccount, job.direction)
                    .catch(err => console.error('Error reversing tracking on failure:', err));
            }

            channel.ack(msg);
        }
    }

    async processIndividualEmail(job) {
        const { timeSlot, pairs, scheduledTime, direction, warmupAccount } = job;
        const pair = pairs[0];

        console.log(`🎯 Executing ${direction} email: ${scheduledTime}`);
        console.log(`   Warmup Account: ${warmupAccount}`);

        if (!pairs || pairs.length === 0) {
            console.log('⚠️ No pairs found in individual email job');
            return;
        }

        // ENHANCED: Different handling for sending vs receiving
        if (direction === 'WARMUP_TO_POOL') {
            await this.handleWarmupToPool(pair, warmupAccount);
        } else {
            await this.handlePoolToWarmup(pair, warmupAccount);
        }
    }



    async handleWarmupToPool(pair, warmupAccount) {
        console.log(`   🔄 HANDLING SENDING: ${pair.senderEmail} → ${pair.receiverEmail}`);

        let exchangeRecord;
        let sendResult;

        // 🚨 CRITICAL: Skip Outlook accounts that need reauthentication IMMEDIATELY
        const isOutlookPersonal = pair.senderEmail.includes('@outlook.com') ||
            pair.senderEmail.includes('@hotmail.com') ||
            pair.senderEmail.includes('@live.com');

        if (isOutlookPersonal) {
            console.log(`\n   🔐 OUTLOOK PERSONAL ACCOUNT DETECTED: ${pair.senderEmail}`);

            try {
                const tokenManager = require('../utils/token-manager');

                // 🚨 STEP 1: Get fresh account data FIRST
                console.log(`   📊 Fetching fresh account data...`);
                let sender = await tokenManager.getFreshAccountData(pair.senderEmail);

                if (!sender) {
                    console.log(`   ❌ ACCOUNT NOT FOUND: ${pair.senderEmail} - SKIPPING EMAIL`);
                    return; // STOP PROCESSING
                }

                // 🚨 STEP 2: Check if account is already marked for reauth
                if (sender.warmupStatus === 'needs_reauth' || sender.is_connected === false) {
                    console.log(`   ⏸️ ACCOUNT ALREADY MARKED FOR REAUTH: ${pair.senderEmail} - SKIPPING EMAIL`);
                    return; // STOP PROCESSING
                }

                // 🚨 STEP 3: Validate tokens BEFORE attempting to send
                console.log(`   🔐 Validating Outlook tokens before sending...`);
                console.log(`      Access Token: ${sender.access_token ? 'PRESENT' : 'MISSING'}`);
                console.log(`      Refresh Token: ${sender.refresh_token ? 'PRESENT' : 'MISSING'}`);
                console.log(`      Token Expiry: ${sender.token_expiry || 'NOT SET'}`);
                console.log(`      Account Status: ${sender.warmupStatus || 'active'}`);

                // 🚨 CRITICAL: Check for basic token validity
                if (!sender.access_token || !sender.access_token.includes('.')) {
                    console.log(`   ❌ INVALID ACCESS TOKEN - Marking for reauth and skipping email`);
                    await tokenManager.markAccountForReauth(pair.senderEmail);
                    return; // STOP PROCESSING - DON'T SEND EMAIL
                }

                if (!sender.refresh_token) {
                    console.log(`   ❌ NO REFRESH TOKEN - Marking for reauth and skipping email`);
                    await tokenManager.markAccountForReauth(pair.senderEmail);
                    return; // STOP PROCESSING - DON'T SEND EMAIL
                }

                // 🚨 STEP 4: Attempt token refresh if needed
                const tokenValidation = await tokenManager.validateAndRefreshOutlookToken(sender);

                if (!tokenValidation || !tokenValidation.access_token) {
                    console.log(`   ❌ TOKEN VALIDATION FAILED - Skipping email`);
                    return; // STOP PROCESSING - Already marked for reauth in token manager
                }

                // 🚨 STEP 5: Only proceed if we have valid tokens
                sender = { ...sender, ...tokenValidation };
                console.log(`   ✅ Outlook account validated - proceeding with email send`);

                // CONTINUE WITH EMAIL SENDING LOGIC
                const receiver = await this.getPoolAccount(pair.receiverEmail);

                if (!receiver) {
                    console.log(`   🗑️ SKIPPING: Receiver account not found`);
                    return;
                }

                console.log(`   📧 Processing: ${pair.senderEmail} → ${pair.receiverEmail} [WARMUP_TO_POOL]`);

                // RECORD THE EXCHANGE BEFORE SENDING
                exchangeRecord = await EmailExchange.create({
                    warmupAccount: warmupAccount,
                    poolAccount: pair.receiverEmail,
                    direction: 'WARMUP_TO_POOL',
                    status: 'scheduled'
                });

                let senderConfig = buildWarmupConfig(sender);
                const safeReplyRate = pair.replyRate || 0.25;

                // 🚨 FORCE GRAPH API FOR OUTLOOK PERSONAL ACCOUNTS
                console.log(`   🔐 FORCING Graph API for Outlook personal account: ${pair.senderEmail}`);
                senderConfig.useGraphApi = true;
                senderConfig.forceSMTP = false;

                // 🚨 EXECUTE EMAIL SENDING WITH GRAPH API
                sendResult = await this.sendEmailWithFallback(
                    senderConfig,
                    receiver,
                    safeReplyRate,
                    true,
                    true,
                    false,
                    'WARMUP_TO_POOL'
                );

                // 🚨 VALIDATE SEND RESULT - USE FALLBACK MESSAGE ID IF NEEDED
                if (!sendResult || !sendResult.messageId) {
                    console.log(`   ⚠️  No messageId returned, using fallback ID`);
                    sendResult = sendResult || {};
                    sendResult.messageId = sendResult.messageId || `graph-fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    sendResult.success = false;
                    sendResult.error = sendResult.error || 'No messageId returned from Graph API';
                }

                // 🚨 FIXED: Ensure ALL required fields are present with proper validation
                const emailData = {
                    senderEmail: pair.senderEmail,
                    senderType: pair.senderType || this.determineAccountType(sender) || 'warmup',
                    receiverEmail: pair.receiverEmail,
                    receiverType: 'pool',
                    subject: sendResult.subject || 'Warmup Email',
                    messageId: sendResult.messageId,
                    emailType: 'warmup_send',
                    direction: 'WARMUP_TO_POOL',
                    warmupDay: warmupAccount.warmupDayCount || 0,
                    replyRate: safeReplyRate,
                    industry: warmupAccount.industry || 'general',
                    isCoordinated: true,
                    graphApiUsed: true // 🚨 TRACK GRAPH API USAGE
                };

                console.log(`📊 Tracking WARMUP email:`, {
                    senderType: emailData.senderType,
                    receiverType: emailData.receiverType,
                    direction: emailData.direction,
                    messageId: emailData.messageId,
                    graphApiUsed: emailData.graphApiUsed
                });

                // 🚨 TRACK EMAIL WITH ERROR HANDLING
                await trackingService.trackEmailSent(emailData);

                // 🚨 CRITICAL: UPDATE THE STATUS BASED ON ACTUAL RESULT
                let finalStatus = sendResult.success ? 'sent' : 'failed';

                if (sendResult.success) {
                    finalStatus = 'delivered';

                    // 🚨 TRACK SUCCESSFUL DELIVERY
                    if (sendResult.deliveredInbox !== undefined) {
                        await trackingService.trackEmailDelivered(sendResult.messageId, {
                            deliveredInbox: sendResult.deliveredInbox,
                            deliveryFolder: sendResult.deliveryFolder || 'INBOX',
                            isSpamFolder: sendResult.deliveryFolder === 'SPAM' || sendResult.deliveryFolder === 'JUNK',
                            graphApiUsed: true
                        }).catch(err => console.error('❌ Error tracking delivery:', err.message));
                    }
                } else {
                    // 🚨 TRACK BOUNCE ON FAILURE
                    await trackingService.trackEmailBounce(sendResult.messageId, {
                        bounceType: 'soft_bounce',
                        bounceCategory: 'transient',
                        bounceReason: sendResult.error || 'Graph API send failed',
                        canRetry: true,
                        senderEmail: pair.senderEmail,
                        receiverEmail: pair.receiverEmail,
                        graphApiError: true
                    }).catch(err => console.error('❌ Error tracking bounce:', err.message));
                }

                // UPDATE EXCHANGE RECORD WITH REAL STATUS
                await exchangeRecord.update({
                    messageId: sendResult.messageId,
                    status: finalStatus,
                    sentAt: new Date(),
                    graphApiUsed: true
                });

                // 🚨 UPDATE DAILY COUNT
                await this.incrementDailySentCount(warmupAccount, 'warmup');

                console.log(`   ✅ WARMUP_TO_POOL email completed: ${pair.senderEmail} → ${pair.receiverEmail} [${finalStatus}]`);

                // 🚨 STORE DAILY ANALYTICS ASYNC
                analyticsService.storeDailyAnalytics(warmupAccount).catch(err => {
                    console.error('❌ Error storing daily analytics:', err.message);
                });

            } catch (tokenError) {
                console.log(`   ❌ OUTLOOK ACCOUNT ERROR: ${tokenError.message} - SKIPPING EMAIL`);
                const tokenManager = require('../utils/token-manager');
                await tokenManager.markAccountForReauth(pair.senderEmail);
                return; // STOP PROCESSING ON ERROR
            }
        } else {
            // Handle non-Outlook accounts normally
            console.log(`   📧 Non-Outlook account - proceeding normally`);

            try {
                // 🚨 GRACEFUL ACCOUNT CHECK
                const accountStatus = await this.checkWarmupAccountStatus(warmupAccount);

                if (accountStatus.status === 'NOT_FOUND') {
                    console.log(`   🗑️ SKIPPING: Warmup account ${warmupAccount} not found in database`);
                    return;
                }

                if (accountStatus.status === 'PAUSED') {
                    console.log(`   ⏸️ SKIPPING: Warmup account ${warmupAccount} is paused`);
                    return;
                }

                // 🚨 CENTRALIZED VOLUME CHECK BEFORE SENDING
                const canSend = await volumeEnforcement.canAccountSendEmail(warmupAccount, 'warmup');
                if (!canSend) {
                    console.log(`   🛑 DAILY LIMIT REACHED: ${warmupAccount} cannot send more emails today`);
                    return;
                }

                let sender = await this.getWarmupAccount(pair.senderType, pair.senderEmail);
                let receiver = await this.getPoolAccount(pair.receiverEmail);

                if (!sender || !receiver) {
                    console.log(`   🗑️ SKIPPING: Sender or receiver account not found`);
                    return;
                }

                console.log(`   📧 Processing: ${pair.senderEmail} → ${pair.receiverEmail} [WARMUP_TO_POOL]`);

                // RECORD THE EXCHANGE BEFORE SENDING
                exchangeRecord = await EmailExchange.create({
                    warmupAccount: warmupAccount,
                    poolAccount: pair.receiverEmail,
                    direction: 'WARMUP_TO_POOL',
                    status: 'scheduled'
                });

                let senderConfig = buildWarmupConfig(sender);
                const safeReplyRate = pair.replyRate || 0.25;

                // 🚨 EXECUTE EMAIL SENDING
                sendResult = await this.sendEmailWithFallback(
                    senderConfig,
                    receiver,
                    safeReplyRate,
                    true,
                    true,
                    false,
                    'WARMUP_TO_POOL'
                );

                // 🚨 VALIDATE SEND RESULT
                if (!sendResult || !sendResult.messageId) {
                    console.log(`   ⚠️  No messageId returned, using fallback ID`);
                    sendResult = sendResult || {};
                    sendResult.messageId = sendResult.messageId || `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    sendResult.success = false;
                    sendResult.error = sendResult.error || 'No messageId returned';
                }

                // 🚨 FIXED: Ensure ALL required fields are present with proper validation
                const emailData = {
                    senderEmail: pair.senderEmail,
                    senderType: pair.senderType || this.determineAccountType(sender) || 'warmup',
                    receiverEmail: pair.receiverEmail,
                    receiverType: 'pool',
                    subject: sendResult.subject || 'Warmup Email',
                    messageId: sendResult.messageId,
                    emailType: 'warmup_send',
                    direction: 'WARMUP_TO_POOL',
                    warmupDay: warmupAccount.warmupDayCount || 0,
                    replyRate: safeReplyRate,
                    industry: warmupAccount.industry || 'general',
                    isCoordinated: true,
                    graphApiUsed: false
                };

                console.log(`📊 Tracking WARMUP email:`, {
                    senderType: emailData.senderType,
                    receiverType: emailData.receiverType,
                    direction: emailData.direction,
                    messageId: emailData.messageId,
                    graphApiUsed: emailData.graphApiUsed
                });

                // 🚨 TRACK EMAIL WITH ERROR HANDLING
                await trackingService.trackEmailSent(emailData);

                // 🚨 CRITICAL: UPDATE THE STATUS BASED ON ACTUAL RESULT
                let finalStatus = sendResult.success ? 'sent' : 'failed';

                if (sendResult.success) {
                    finalStatus = 'delivered';

                    // 🚨 TRACK SUCCESSFUL DELIVERY
                    if (sendResult.deliveredInbox !== undefined) {
                        await trackingService.trackEmailDelivered(sendResult.messageId, {
                            deliveredInbox: sendResult.deliveredInbox,
                            deliveryFolder: sendResult.deliveryFolder || 'INBOX',
                            isSpamFolder: sendResult.deliveryFolder === 'SPAM' || sendResult.deliveryFolder === 'JUNK',
                            graphApiUsed: false
                        }).catch(err => console.error('❌ Error tracking delivery:', err.message));
                    }
                } else {
                    // 🚨 TRACK BOUNCE ON FAILURE
                    await trackingService.trackEmailBounce(sendResult.messageId, {
                        bounceType: 'soft_bounce',
                        bounceCategory: 'transient',
                        bounceReason: sendResult.error || 'Email send failed',
                        canRetry: true,
                        senderEmail: pair.senderEmail,
                        receiverEmail: pair.receiverEmail,
                        graphApiError: false
                    }).catch(err => console.error('❌ Error tracking bounce:', err.message));
                }

                // UPDATE EXCHANGE RECORD WITH REAL STATUS
                await exchangeRecord.update({
                    messageId: sendResult.messageId,
                    status: finalStatus,
                    sentAt: new Date(),
                    graphApiUsed: false
                });

                // 🚨 UPDATE DAILY COUNT
                await this.incrementDailySentCount(warmupAccount, 'warmup');

                console.log(`   ✅ WARMUP_TO_POOL email completed: ${pair.senderEmail} → ${pair.receiverEmail} [${finalStatus}]`);

                // 🚨 STORE DAILY ANALYTICS ASYNC
                analyticsService.storeDailyAnalytics(warmupAccount).catch(err => {
                    console.error('❌ Error storing daily analytics:', err.message);
                });

            } catch (error) {
                console.error(`   ❌ Failed WARMUP_TO_POOL email: ${error.message}`);

                // 🚨 TRACK BOUNCE ON EXCEPTION WITH FALLBACK MESSAGE ID
                const fallbackMessageId = `exception-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                await trackingService.trackEmailBounce(fallbackMessageId, {
                    bounceType: this.determineBounceType(error),
                    bounceCategory: 'permanent',
                    bounceReason: error.message,
                    canRetry: false,
                    senderEmail: pair.senderEmail,
                    receiverEmail: pair.receiverEmail,
                    graphApiError: false,
                    exception: true
                }).catch(err => console.error('❌ Error tracking exception bounce:', err.message));

                // 🚨 MARK AS FAILED ON ERROR
                if (exchangeRecord) {
                    await exchangeRecord.update({
                        status: 'failed',
                        error: error.message.substring(0, 500),
                        graphApiUsed: false
                    }).catch(err => console.error('❌ Error updating exchange record:', err.message));
                }
            }
        }
    }
    // In WarmupWorker class - ADD THIS METHOD

    async shouldSkipOutlookAccount(email, direction) {
        try {
            console.log(`🔍 Checking Outlook account status: ${email}`);

            const tokenManager = require('../utils/token-manager');
            const freshAccount = await tokenManager.getFreshAccountData(email);

            if (!freshAccount) {
                console.log(`❌ Account not found: ${email}`);
                return true;
            }

            // Check if account is already marked for reauth
            if (freshAccount.warmupStatus === 'needs_reauth' || freshAccount.is_connected === false) {
                console.log(`⏸️ Account marked for reauth: ${email}`);
                return true;
            }

            // Validate tokens
            const tokenValidation = await tokenManager.validateAndRefreshOutlookToken(freshAccount);

            if (!tokenValidation || !tokenValidation.access_token) {
                console.log(`❌ Token validation failed: ${email}`);
                return true;
            }

            console.log(`✅ Outlook account ready: ${email}`);
            return false;

        } catch (error) {
            console.error(`❌ Error checking Outlook account ${email}:`, error.message);
            return true; // Skip on error
        }
    }

    // In WarmupWorker class - REPLACE THIS METHOD

    async processSingleJob(channel, msg, job) {
        const jobKey = this.getJobKey(job);

        try {
            console.log(`\n🔨 PROCESSING: ${job.direction}`);
            console.log(`   ${job.pairs[0].senderEmail} → ${job.pairs[0].receiverEmail}`);

            // 🚨 CHECK OUTLOOK ACCOUNTS BEFORE PROCESSING
            const warmupAccount = job.warmupAccount;
            const isOutlookAccount = warmupAccount.includes('@outlook.com') ||
                warmupAccount.includes('@hotmail.com');

            if (isOutlookAccount) {
                const shouldSkip = await this.shouldSkipOutlookAccount(warmupAccount, job.direction);
                if (shouldSkip) {
                    console.log(`⏩ SKIPPING: Outlook account needs reauthentication`);
                    channel.ack(msg);
                    return;
                }
            }

            // 🚨 GRACEFUL VOLUME CHECK
            let canExecute = false;

            try {
                canExecute = await volumeEnforcement.canAccountSendEmail(warmupAccount, 'warmup');
            } catch (volumeError) {
                console.log(`   ⚠️  Volume check failed for ${warmupAccount}: ${volumeError.message}`);
                canExecute = true; // Continue anyway for now
            }

            if (!canExecute) {
                console.log(`💥 EXECUTION BLOCKED: ${warmupAccount} at volume limit - ACKNOWLEDGING JOB`);
                channel.ack(msg);
                return;
            }

            // Process the job
            if (job.individualSchedule) {
                await this.processIndividualEmail(job);
            } else {
                await this.processCoordinatedTimeSlot(job);
            }

            channel.ack(msg);
            console.log(`✅ EXECUTION COMPLETED`);

        } catch (error) {
            console.error(`❌ EXECUTION FAILED:`, error);
            channel.ack(msg);
        }
    }
    // 🚨 UPDATED: Handle Pool to Warmup with Complete Error Handling
    async handlePoolToWarmup(pair, warmupAccount) {
        console.log(`   🔄 HANDLING RECEIVING: ${pair.senderEmail} → ${pair.receiverEmail}`);

        let exchangeRecord;
        let sendResult;

        try {
            // 🚨 GRACEFUL ACCOUNT CHECK
            const accountStatus = await this.checkWarmupAccountStatus(warmupAccount);

            if (accountStatus.status === 'NOT_FOUND') {
                console.log(`   🗑️ SKIPPING: Warmup account ${warmupAccount} not found in database`);
                return;
            }

            if (accountStatus.status === 'PAUSED') {
                console.log(`   ⏸️ SKIPPING: Warmup account ${warmupAccount} is paused`);
                return;
            }

            // 🚨 CENTRALIZED POOL CAPACITY CHECK
            const canPoolSend = await volumeEnforcement.canAccountSendEmail(pair.senderEmail, 'pool');
            if (!canPoolSend) {
                console.log(`   🛑 POOL LIMIT REACHED: ${pair.senderEmail} cannot send more emails today`);
                return;
            }

            let sender = await this.getPoolAccount(pair.senderEmail);
            let receiver = await this.getWarmupAccount(pair.receiverType, pair.receiverEmail);

            if (!sender || !receiver) {
                console.log(`   🗑️ SKIPPING: Sender or receiver account not found`);
                return;
            }

            console.log(`   📧 Processing: ${pair.senderEmail} → ${pair.receiverEmail} [POOL_TO_WARMUP]`);

            // 🚨 ENHANCED OUTLOOK PERSONAL RECEIVER VALIDATION
            const isOutlookPersonalReceiver = pair.receiverEmail.includes('@outlook.com') ||
                pair.receiverEmail.includes('@hotmail.com') ||
                pair.receiverEmail.includes('@live.com');

            if (isOutlookPersonalReceiver) {
                console.log(`\n   🔐 OUTLOOK PERSONAL RECEIVER DETECTED: ${pair.receiverEmail}`);

                try {
                    const tokenManager = require('../utils/token-manager');

                    // 🚨 STEP 1: Check current token status
                    console.log(`   📊 Current token status:`);
                    console.log(`      Access Token: ${receiver.access_token ? 'PRESENT' : 'MISSING'}`);
                    console.log(`      Refresh Token: ${receiver.refresh_token ? 'PRESENT' : 'MISSING'}`);
                    console.log(`      Token Expiry: ${receiver.token_expiry || 'NOT SET'}`);

                    // 🚨 STEP 2: Validate and refresh tokens if needed
                    const tokenValidation = await tokenManager.validateAndRefreshOutlookToken(receiver);

                    if (!tokenValidation || !tokenValidation.access_token) {
                        console.log(`   ❌ OUTLOOK PERSONAL RECEIVER: Account needs reauthentication - skipping`);

                        // Mark for reauth and skip this email
                        await tokenManager.markAccountForReauth(pair.receiverEmail);
                        return;
                    }

                    // 🚨 STEP 3: Update receiver with fresh tokens
                    receiver = { ...receiver, ...tokenValidation };
                    console.log(`   ✅ Outlook personal receiver account validated`);

                } catch (tokenError) {
                    console.log(`   ❌ Outlook personal receiver validation failed: ${tokenError.message}`);
                    await this.markAccountAsNeedsReauth(pair.receiverEmail);
                    return;
                }
            }

            // RECORD THE EXCHANGE BEFORE SENDING
            exchangeRecord = await EmailExchange.create({
                warmupAccount: warmupAccount,
                poolAccount: pair.senderEmail,
                direction: 'POOL_TO_WARMUP',
                status: 'scheduled'
            });

            let senderConfig = buildPoolConfig(sender);
            const safeReplyRate = pair.replyRate || 0.25;

            // Check pool capacity before sending
            if (!await canPoolSendMore(sender)) {
                console.log(`   🛑 POOL CAPACITY: ${pair.senderEmail} has reached daily limit`);
                return;
            }

            // 🚨 EXECUTE EMAIL SENDING
            sendResult = await this.sendEmailWithFallback(
                senderConfig,
                receiver,
                safeReplyRate,
                true,
                false,
                true,
                'POOL_TO_WARMUP'
            );

            // 🚨 VALIDATE SEND RESULT BEFORE TRACKING
            if (!sendResult || !sendResult.messageId) {
                throw new Error('Pool email sending failed - no messageId returned');
            }

            // 🚨 FIXED: Ensure ALL required fields for POOL emails with validation
            const emailData = {
                senderEmail: pair.senderEmail,
                senderType: 'pool', // 🚨 EXPLICITLY SET
                receiverEmail: pair.receiverEmail,
                receiverType: pair.receiverType || this.determineAccountType(receiver) || 'warmup', // 🚨 MULTIPLE FALLBACKS
                subject: sendResult.subject || 'Warmup Email',
                messageId: sendResult.messageId,
                emailType: 'pool_send',
                direction: 'POOL_TO_WARMUP',
                warmupDay: warmupAccount.warmupDayCount || 0,
                replyRate: safeReplyRate,
                industry: warmupAccount.industry || 'general',
                isCoordinated: true,
                graphApiUsed: false // Pool emails typically use SMTP
            };

            console.log(`📊 Tracking POOL email:`, {
                senderType: emailData.senderType,
                receiverType: emailData.receiverType,
                direction: emailData.direction,
                messageId: emailData.messageId,
                graphApiUsed: emailData.graphApiUsed
            });

            // 🚨 TRACK POOL EMAIL WITH ERROR HANDLING
            await trackingService.trackEmailSent(emailData);

            // 🚨 CRITICAL: UPDATE THE STATUS BASED ON ACTUAL RESULT
            let finalStatus = 'sent';

            if (sendResult && sendResult.success) {
                finalStatus = sendResult.messageId ? 'delivered' : 'sent';

                // 🚨 TRACK SUCCESSFUL DELIVERY FOR POOL EMAILS TOO
                if (sendResult.deliveredInbox !== undefined) {
                    await trackingService.trackEmailDelivered(sendResult.messageId, {
                        deliveredInbox: sendResult.deliveredInbox,
                        deliveryFolder: sendResult.deliveryFolder || 'INBOX',
                        isSpamFolder: sendResult.deliveryFolder === 'SPAM' || sendResult.deliveryFolder === 'JUNK',
                        graphApiUsed: false
                    }).catch(err => console.error('❌ Error tracking pool delivery:', err.message));
                }
            } else {
                finalStatus = 'failed';

                // 🚨 TRACK BOUNCE ON FAILURE FOR POOL EMAILS
                if (sendResult && sendResult.messageId) {
                    await trackingService.trackEmailBounce(sendResult.messageId, {
                        bounceType: 'soft_bounce',
                        bounceCategory: 'transient',
                        bounceReason: sendResult.error || 'Pool send failed',
                        canRetry: true,
                        senderEmail: pair.senderEmail,
                        receiverEmail: pair.receiverEmail,
                        graphApiError: false
                    }).catch(err => console.error('❌ Error tracking pool bounce:', err.message));
                }
            }

            // UPDATE EXCHANGE RECORD WITH REAL STATUS
            await exchangeRecord.update({
                messageId: sendResult?.messageId,
                status: finalStatus,
                sentAt: new Date(),
                graphApiUsed: false
            });

            // 🚨 UPDATE DAILY COUNTS
            await this.incrementDailySentCount(pair.senderEmail, 'pool');
            await this.incrementDailyReceivedCount(warmupAccount);

            console.log(`   ✅ POOL_TO_WARMUP email completed: ${pair.senderEmail} → ${pair.receiverEmail} [${finalStatus}]`);

            // 🚨 STORE DAILY ANALYTICS FOR BOTH ACCOUNTS
            analyticsService.storeDailyAnalytics(warmupAccount).catch(err => {
                console.error('❌ Error storing warmup analytics:', err.message);
            });

            analyticsService.storeDailyAnalytics(pair.senderEmail).catch(err => {
                console.error('❌ Error storing pool analytics:', err.message);
            });

        } catch (error) {
            console.error(`   ❌ Failed POOL_TO_WARMUP email: ${error.message}`);

            // 🚨 TRACK BOUNCE ON EXCEPTION FOR POOL EMAILS
            if (sendResult && sendResult.messageId) {
                await trackingService.trackEmailBounce(sendResult.messageId, {
                    bounceType: this.determineBounceType(error),
                    bounceCategory: 'permanent',
                    bounceReason: error.message,
                    canRetry: false,
                    senderEmail: pair.senderEmail,
                    receiverEmail: pair.receiverEmail,
                    graphApiError: false
                }).catch(err => console.error('❌ Error tracking pool exception bounce:', err.message));
            }

            // 🚨 MARK AS FAILED ON ERROR
            if (exchangeRecord) {
                await exchangeRecord.update({
                    status: 'failed',
                    error: error.message.substring(0, 500),
                    graphApiUsed: false
                }).catch(err => console.error('❌ Error updating pool exchange record:', err.message));
            }
        }
    }

    // 🚨 IMPROVED: Account type detection with better Outlook personal detection
    determineAccountType(account) {
        if (!account) return 'unknown';

        const email = account.email ? account.email.toLowerCase() : '';

        // 🚨 CRITICAL: Check for Outlook Personal accounts FIRST
        if (email.includes('@outlook.com') || email.includes('@hotmail.com') || email.includes('@live.com')) {
            console.log(`   🔐 OUTLOOK PERSONAL DETECTED: ${email}`);
            return 'outlook_personal';
        }

        // Check for explicit provider types
        if (account.providerType) {
            const providerType = account.providerType.toLowerCase();
            if (providerType.includes('outlook') || providerType.includes('microsoft_personal')) {
                return 'outlook_personal';
            }
            if (providerType.includes('microsoft_organizational') || providerType.includes('office365')) {
                return 'microsoft_organizational';
            }
        }

        // Check provider fields
        if (account.provider === 'google' || account.roundRobinIndexGoogle !== undefined) {
            return 'google';
        } else if (account.provider === 'microsoft' || account.roundRobinIndexMicrosoft !== undefined) {
            return 'microsoft_organizational';
        } else if (account.smtp_host || account.roundRobinIndexCustom !== undefined) {
            return 'smtp';
        }

        // 🚨 FALLBACK: Check email domain for common providers
        if (email) {
            if (email.includes('@gmail.com') || email.includes('@googlemail.com')) {
                return 'google';
            }
            // Microsoft organizational domains (not personal)
            if (email.includes('.onmicrosoft.com') ||
                email.includes('@') && !email.includes('@outlook.com') &&
                !email.includes('@hotmail.com') && !email.includes('@live.com')) {
                return 'microsoft_organizational';
            }
        }

        return 'smtp';
    }

    // 🚨 NEW: Check if domain is custom (not standard email provider)
    isCustomDomain(email) {
        if (!email) return false;

        const standardProviders = [
            'gmail.com', 'googlemail.com',
            'outlook.com', 'hotmail.com', 'live.com',
            'yahoo.com', 'ymail.com',
            'aol.com', 'icloud.com', 'me.com',
            'protonmail.com', 'proton.me'
        ];

        const domain = email.toLowerCase().split('@')[1];
        return domain && !standardProviders.includes(domain);
    }

    // 🚨 FIXED: Enhanced SMTP configuration for custom domains
    async buildTransporterConfig(senderConfig) {
        console.log(`🔧 Building SMTP config for: ${senderConfig.email}`);

        // 🚨 DETECT CUSTOM DOMAINS AND APPLY SMART CONFIG
        const isCustomDomain = this.isCustomDomain(senderConfig.email);

        let config = {
            host: senderConfig.smtpHost,
            port: senderConfig.smtpPort,
            secure: senderConfig.smtpSecure || false,
            auth: {
                user: senderConfig.smtpUser || senderConfig.email,
                pass: senderConfig.smtpPass
            },
            connectionTimeout: 30000,
            greetingTimeout: 15000,
            socketTimeout: 30000,
            tls: {
                rejectUnauthorized: false
            }
        };

        // 🚨 SMART CONFIGURATION FOR CUSTOM DOMAINS
        if (isCustomDomain && (!senderConfig.smtpHost || !senderConfig.smtpPort)) {
            console.log(`   🔍 Auto-configuring custom domain: ${senderConfig.email}`);

            const domain = senderConfig.email.split('@')[1];

            // Try common SMTP configurations for custom domains
            const commonConfigs = [
                { host: `mail.${domain}`, port: 587, secure: false, requireTLS: true },
                { host: `mail.${domain}`, port: 465, secure: true },
                { host: `smtp.${domain}`, port: 587, secure: false, requireTLS: true },
                { host: `smtp.${domain}`, port: 465, secure: true },
                { host: domain, port: 587, secure: false, requireTLS: true },
                { host: domain, port: 465, secure: true }
            ];

            // Test configurations and use the first working one
            for (const testConfig of commonConfigs) {
                try {
                    console.log(`   🔄 Testing: ${testConfig.host}:${testConfig.port}`);

                    const testTransporter = nodemailer.createTransport({
                        ...testConfig,
                        auth: config.auth,
                        connectionTimeout: 10000,
                        greetingTimeout: 5000
                    });

                    await testTransporter.verify();
                    console.log(`   ✅ Found working config: ${testConfig.host}:${testConfig.port}`);

                    // Use this configuration
                    config.host = testConfig.host;
                    config.port = testConfig.port;
                    config.secure = testConfig.secure;
                    if (testConfig.requireTLS) config.requireTLS = true;

                    break;
                } catch (error) {
                    console.log(`   ❌ Failed: ${testConfig.host}:${testConfig.port} - ${error.message}`);
                    continue;
                }
            }
        }

        // Handle different service types
        if (senderConfig.smtpHost === 'smtp.gmail.com') {
            config.service = 'gmail';
        }

        if (senderConfig.smtpHost === 'smtp.office365.com') {
            config.requireTLS = true;
        }

        console.log(`   📧 Final SMTP config: ${config.host}:${config.port} (secure: ${config.secure})`);

        return config;
    }
    // 🚨 FIXED: Proper token expiry mapping for Outlook personal
    normalizeAccountTokens(account) {
        if (!account) return account;

        const normalized = { ...account };

        // 🚨 HANDLE OUTLOOK PERSONAL ACCOUNTS DIFFERENTLY
        const isOutlookPersonal = account.email &&
            (account.email.includes('@outlook.com') || account.email.includes('@hotmail.com'));

        if (isOutlookPersonal) {
            console.log(`   🔐 Normalizing Outlook personal account tokens`);

            // Outlook personal accounts use Graph API tokens
            if (!normalized.access_token && normalized.accessToken) {
                normalized.access_token = normalized.accessToken;
            }
            if (!normalized.refresh_token && normalized.refreshToken) {
                normalized.refresh_token = normalized.refreshToken;
            }

            // 🚨 CRITICAL FIX: Proper token expiry handling for personal accounts
            if (normalized.expires_at && !normalized.token_expiry) {
                // Convert numeric timestamp to ISO string
                const expiryDate = new Date(Number(normalized.expires_at));
                normalized.token_expiry = expiryDate.toISOString();
                console.log(`   🔄 Converted expires_at to token_expiry: ${normalized.token_expiry}`);
            } else if (normalized.token_expires_at && !normalized.token_expiry) {
                // Handle token_expires_at field
                const expiryDate = new Date(Number(normalized.token_expires_at));
                normalized.token_expiry = expiryDate.toISOString();
                console.log(`   🔄 Converted token_expires_at to token_expiry: ${normalized.token_expiry}`);
            }

            // 🚨 CRITICAL: Check if we have the required tokens
            if (!normalized.access_token) {
                console.log(`   ❌ MISSING ACCESS TOKEN for Outlook personal account`);
            }
            if (!normalized.refresh_token) {
                console.log(`   ⚠️  MISSING REFRESH TOKEN for Outlook personal account - will require reauth`);
            }

        } else {
            // Organizational accounts - existing logic
            if (normalized.token_expires_at && !normalized.token_expiry) {
                const expiryDate = new Date(Number(normalized.token_expires_at));
                normalized.token_expiry = expiryDate.toISOString();
                console.log(`   🔄 Converted token_expires_at to token_expiry: ${normalized.token_expiry}`);
            }
            if (!normalized.access_token && normalized.accessToken) normalized.access_token = normalized.accessToken;
            if (!normalized.refresh_token && normalized.refreshToken) normalized.refresh_token = normalized.refreshToken;
        }

        return normalized;
    }

    // 🚨 FIXED: Get Warmup Account with proper token normalization
    async getWarmupAccount(senderType, email) {
        try {
            console.log(`🔍 Searching for warmup account: ${email} (type: ${senderType})`);

            let sender = null;

            // Try specific model first if type is provided
            if (senderType === 'google') {
                sender = await GoogleUser.findOne({ where: { email } });
            } else if (senderType === 'microsoft') {
                sender = await MicrosoftUser.findOne({ where: { email } });
            } else if (senderType === 'smtp') {
                sender = await SmtpAccount.findOne({ where: { email } });
            }

            // If not found by specific type OR no type provided, search all models
            if (!sender) {
                sender = await GoogleUser.findOne({ where: { email } }) ||
                    await MicrosoftUser.findOne({ where: { email } }) ||
                    await SmtpAccount.findOne({ where: { email } });
            }

            if (!sender) {
                console.log(`❌ Warmup account not found: ${email}`);
                return null;
            }

            const plainSender = this.convertToPlainObject(sender);

            // 🚨 NORMALIZE TOKENS BASED ON ACCOUNT TYPE
            const normalizedSender = this.normalizeAccountTokens(plainSender);

            // 🚨 DETERMINE CORRECT ACCOUNT TYPE
            const accountType = this.determineAccountType(normalizedSender);
            normalizedSender.accountType = accountType; // Add for reference

            console.log(`   ✅ Found warmup account: ${normalizedSender.email}`);
            console.log(`   📊 Type: ${accountType}`);
            console.log(`   📊 Status: ${normalizedSender.warmupStatus || 'unknown'}`);
            console.log(`   🔐 Token Status: ${normalizedSender.access_token ? 'PRESENT' : 'MISSING'}`);

            return normalizedSender;

        } catch (error) {
            console.error(`❌ Error fetching warmup account ${email}:`, error.message);
            return null;
        }
    }
    // 🚨 ADD THIS HELPER METHOD TO YOUR CLASS
    determineBounceType(error) {
        const errorMessage = error.message.toLowerCase();

        // Hard bounces (permanent failures)
        if (errorMessage.includes('permanent') ||
            errorMessage.includes('invalid') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('no such user') ||
            errorMessage.includes('mailbox not found') ||
            errorMessage.includes('does not exist') ||
            errorMessage.includes('rejected') ||
            errorMessage.includes('blacklist')) {
            return 'hard_bounce';
        }

        // Spam/complaint bounces
        if (errorMessage.includes('spam') ||
            errorMessage.includes('complaint') ||
            errorMessage.includes('abuse') ||
            errorMessage.includes('blocked')) {
            return 'spam';
        }

        // Content rejection
        if (errorMessage.includes('content') ||
            errorMessage.includes('policy') ||
            errorMessage.includes('filtered')) {
            return 'blocked';
        }

        // Default to soft bounce (temporary issues)
        return 'soft_bounce';
    }

    // 🚨 ADDED: Graceful Account Status Check
    async checkWarmupAccountStatus(email) {
        try {
            const google = await GoogleUser.findOne({ where: { email } });
            if (google) {
                return {
                    status: google.warmupStatus === 'active' ? 'ACTIVE' : 'PAUSED',
                    account: google,
                    type: 'google'
                };
            }

            const microsoft = await MicrosoftUser.findOne({ where: { email } });
            if (microsoft) {
                return {
                    status: microsoft.warmupStatus === 'active' ? 'ACTIVE' : 'PAUSED',
                    account: microsoft,
                    type: 'microsoft'
                };
            }

            const smtp = await SmtpAccount.findOne({ where: { email } });
            if (smtp) {
                return {
                    status: smtp.warmupStatus === 'active' ? 'ACTIVE' : 'PAUSED',
                    account: smtp,
                    type: 'smtp'
                };
            }

            return { status: 'NOT_FOUND', account: null, type: null };

        } catch (error) {
            console.error(`❌ Error checking account status for ${email}:`, error);
            return { status: 'ERROR', account: null, type: null };
        }
    }

    // 🚨 UPDATED: Get Warmup Account with Token Validation
    async getWarmupAccount(senderType, email) {
        try {
            console.log(`🔍 Searching for warmup account: ${email} (type: ${senderType})`);

            let sender = null;

            // Try specific model first if type is provided
            if (senderType === 'google') {
                sender = await GoogleUser.findOne({ where: { email } });
            } else if (senderType === 'microsoft') {
                sender = await MicrosoftUser.findOne({ where: { email } });
            } else if (senderType === 'smtp') {
                sender = await SmtpAccount.findOne({ where: { email } });
            }

            // If not found by specific type OR no type provided, search all models
            if (!sender) {
                sender = await GoogleUser.findOne({ where: { email } }) ||
                    await MicrosoftUser.findOne({ where: { email } }) ||
                    await SmtpAccount.findOne({ where: { email } });
            }

            if (!sender) {
                console.log(`❌ Warmup account not found: ${email}`);
                return null;
            }

            const plainSender = this.convertToPlainObject(sender);

            // 🚨 VALIDATE MICROSOFT TOKENS FOR OUTLOOK ACCOUNTS
            if ((plainSender.email.includes('@outlook.com') || plainSender.email.includes('@hotmail.com')) &&
                plainSender.access_token) {
                console.log(`   🔐 Outlook personal account: ${plainSender.email}`);
                console.log(`   📊 Token status: ${plainSender.access_token ? 'PRESENT' : 'MISSING'}`);

                // Check token expiry
                if (plainSender.token_expiry && new Date(plainSender.token_expiry) < new Date()) {
                    console.log(`   ⚠️  Token expired: ${plainSender.token_expiry}`);
                }
            }

            console.log(`   ✅ Found warmup account: ${plainSender.email}`);
            console.log(`   📊 Status: ${plainSender.warmupStatus || 'unknown'}`);

            return plainSender;

        } catch (error) {
            console.error(`❌ Error fetching warmup account ${email}:`, error.message);
            return null;
        }
    }

    // 🚨 ADDED: Get Pool Account
    async getPoolAccount(email) {
        try {
            console.log(`🔍 Searching for pool account: ${email}`);

            const poolAccount = await EmailPool.findOne({
                where: { email, isActive: true },
                raw: true
            });

            if (!poolAccount) {
                console.log(`❌ Active pool account not found: ${email}`);
                return null;
            }

            console.log(`📋 POOL ACCOUNT DATA for ${email}:`);
            console.log(`   Provider: ${poolAccount.providerType}`);
            console.log(`   Daily Usage: ${poolAccount.currentDaySent || 0}/${poolAccount.maxEmailsPerDay || 50}`);

            return poolAccount;
        } catch (error) {
            console.error(`❌ Error finding pool account ${email}:`, error.message);
            return null;
        }
    }

    // 🚨 ADDED: Job Failure Handling
    async handleJobFailure(channel, msg, job, error) {
        const maxRetries = 2;
        const retryCount = msg.fields.redeliveryCount || 0;

        // 🚨 DON'T RETRY FOR MISSING/PAUSED ACCOUNTS
        if (error.message.includes('not found') || error.message.includes('paused')) {
            console.log(`🗑️ Non-retryable error, acknowledging job: ${this.getJobKey(job)}`);
            channel.ack(msg);
            return;
        }

        if (this.isTransientError(error) && retryCount < maxRetries) {
            const retryDelay = Math.min(2 * 60 * 1000, 30000 * Math.pow(2, retryCount));
            console.log(`🔄 Retrying job in ${retryDelay / 1000}s (attempt ${retryCount + 1}/${maxRetries})`);

            setTimeout(() => {
                channel.nack(msg, false, true);
            }, retryDelay);
        } else {
            console.error(`❌ Max retries exceeded or permanent error, acknowledging job: ${this.getJobKey(job)}`);
            channel.ack(msg);
        }
    }

    isTransientError(error) {
        const transientErrors = [
            'timeout',
            'connection',
            'network',
            'rate limit',
            'temporary',
            'busy'
        ];

        const nonRetryableErrors = [
            'not found',
            'paused',
            'invalid',
            'permission denied',
            'authentication failed'
        ];

        const errorMessage = error.message.toLowerCase();

        // Check if it's a non-retryable error first
        if (nonRetryableErrors.some(err => errorMessage.includes(err))) {
            return false;
        }

        return transientErrors.some(transientError => errorMessage.includes(transientError));
    }

    // 🚨 ADDED: Job Key Generation
    getJobKey(job) {
        if (job.coordinated && job.pairs && job.pairs.length > 0) {
            const pair = job.pairs[0];
            return `${job.direction}_${pair.senderEmail}_${pair.receiverEmail}_${job.timeSlot}`;
        }

        if (job.pairs && job.pairs.length > 0) {
            const pair = job.pairs[0];
            return `${job.direction}_${pair.senderEmail}_${pair.receiverEmail}_${job.scheduledTime}`;
        }

        return `${job.direction}_${job.senderEmail}_${job.receiverEmail}_${Date.now()}`;
    }

    // 🚨 ADDED: Increment Daily Counts
    async incrementDailySentCount(email, accountType) {
        try {
            if (accountType === 'warmup') {
                let account = await GoogleUser.findOne({ where: { email } });
                if (account) {
                    await GoogleUser.increment('current_day_sent', { where: { email } });
                    return;
                }
                account = await MicrosoftUser.findOne({ where: { email } });
                if (account) {
                    await MicrosoftUser.increment('current_day_sent', { where: { email } });
                    return;
                }
                account = await SmtpAccount.findOne({ where: { email } });
                if (account) {
                    await SmtpAccount.increment('current_day_sent', { where: { email } });
                    return;
                }
            } else {
                await EmailPool.increment('currentDaySent', { where: { email } });
            }
        } catch (error) {
            console.error(`❌ Error incrementing daily count for ${email}:`, error);
        }
    }

    async incrementDailyReceivedCount(email) {
        try {
            console.log(`   📥 Account ${email} received an email`);
        } catch (error) {
            console.error(`❌ Error incrementing received count for ${email}:`, error);
        }
    }

    // 2. Delay Calculation
    calculateDynamicDelay(currentJob, nextJob) {
        let delayMs = 30 * 1000;
        if (currentJob.coordinated || nextJob.coordinated) delayMs = 60 * 1000;
        if (currentJob.warmupAccount === nextJob.warmupAccount) delayMs = 2 * 60 * 1000;
        return delayMs;
    }

    // 3. Coordinated Time Slot Processing
    async processCoordinatedTimeSlot(job) {
        const { timeSlot, pairs, round } = job;
        console.log(`🎯 Executing COORDINATED time slot: ${timeSlot}`);
        console.log(`   Processing ${pairs.length} warmup emails`);

        const sendResults = [];
        let successCount = 0;

        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            console.log(`     📥 Processing (${i + 1}/${pairs.length}): ${pair.senderEmail} → ${pair.receiverEmail} [${pair.direction}]`);

            try {
                let sender, receiver;
                if (pair.direction === 'WARMUP_TO_POOL') {
                    sender = await this.getWarmupAccount(pair.senderType, pair.senderEmail);
                    receiver = await this.getPoolAccount(pair.receiverEmail);
                } else {
                    sender = await this.getPoolAccount(pair.senderEmail);
                    receiver = await this.getWarmupAccount(pair.receiverType, pair.receiverEmail);
                }

                if (!sender || !receiver) {
                    throw new Error('Sender or receiver account not found');
                }

                // Volume checks and email sending logic...
                let senderConfig;
                if (pair.direction === 'POOL_TO_WARMUP') {
                    senderConfig = buildPoolConfig(sender);
                } else {
                    senderConfig = buildWarmupConfig(sender);
                }

                const safeReplyRate = pair.replyRate || 0.25;

                // Add delay between emails for better distribution
                if (i > 0) {
                    await delay(5000);
                }

                const isOutbound = pair.direction === 'WARMUP_TO_POOL';
                const isReply = pair.direction === 'POOL_TO_WARMUP';

                await this.sendEmailWithFallback(
                    senderConfig,
                    receiver,
                    safeReplyRate,
                    true,
                    isOutbound,
                    isReply,
                    pair.direction
                );

                sendResults.push({ pair, success: true });
                successCount++;

                console.log(`     ✅ Email processed: ${pair.senderEmail} → ${pair.receiverEmail} [${pair.direction}]`);

            } catch (error) {
                console.error(`     ❌ Failed: ${pair.senderEmail} → ${pair.receiverEmail}: ${error.message}`);
                sendResults.push({ pair, success: false, error: error.message });
            }
        }

        console.log(`📊 COORDINATED SLOT RESULTS: ${successCount}/${pairs.length} successful`);
    }

    // 4. Email Delivery Verification
    async verifyEmailDelivery(messageId, warmupAccount) {
        if (!messageId || messageId === 'undefined') {
            console.log(`   ⚠️  Cannot verify delivery: messageId is ${messageId}`);
            return;
        }
        try {
            console.log(`   🔍 Verifying delivery for: ${messageId}`);
            const account = await this.getWarmupAccount('microsoft', warmupAccount);
            if (!account) {
                console.log(`   ⚠️  Account not found: ${warmupAccount}`);
                return;
            }
            // [Keep your existing Microsoft Graph API verification logic exactly as is]
        } catch (error) {
            console.log(`   ⚠️  Delivery verification failed: ${error.message}`);
        }
    }

    // 🚨 IMPROVED: Token expiry check
    isTokenExpired(account) {
        if (!account.token_expiry && !account.token_expires_at) {
            console.log(`   ⚠️  No token expiry information available`);
            return true; // Assume expired if no info
        }

        try {
            let expiryTime;

            if (account.token_expiry) {
                expiryTime = new Date(account.token_expiry).getTime();
            } else if (account.token_expires_at) {
                // Handle both string and number formats
                expiryTime = typeof account.token_expires_at === 'string'
                    ? new Date(account.token_expires_at).getTime()
                    : Number(account.token_expires_at);
            }

            const now = Date.now();
            const bufferTime = 10 * 60 * 1000; // 10 minutes buffer

            const isExpired = now >= (expiryTime - bufferTime);

            if (isExpired) {
                console.log(`   ⏰ Token expired or expiring soon`);
                console.log(`      Now: ${new Date(now).toISOString()}`);
                console.log(`      Expiry: ${new Date(expiryTime).toISOString()}`);
            } else {
                const timeLeft = Math.round((expiryTime - now) / 60000); // minutes
                console.log(`   ✅ Token valid for ${timeLeft} minutes`);
            }

            return isExpired;

        } catch (error) {
            console.error(`   ❌ Error checking token expiry:`, error);
            return true; // Assume expired on error
        }
    }

    // 🚨 MARK ACCOUNT FOR REAUTHENTICATION
    async markAccountAsNeedsReauth(email) {
        try {
            const MicrosoftUser = require('../models/MicrosoftUser');

            const updated = await MicrosoftUser.update(
                {
                    warmupStatus: 'needs_reauth',
                    is_connected: false,
                    last_error: 'Graph API authentication failed - requires reauthentication'
                },
                { where: { email } }
            );

            if (updated[0] > 0) {
                console.log(`🔐 MARKED FOR REAUTH: ${email} - Graph API authentication failed`);
            } else {
                console.log(`⚠️  Could not mark ${email} for reauth - account not found in MicrosoftUser`);
            }
        } catch (error) {
            console.error(`❌ Error marking account for reauth:`, error);
        }
    }

    // 6. Microsoft Email Delivery Check
    async checkMicrosoftEmailDelivery(messageId, account) {
        try {
            console.log(`   📁 Checking Microsoft 365 inbox for: ${account.email}`);
            console.log(`   🔍 Searching for message: ${messageId}`);

            if (!account.access_token) {
                console.log(`   ⚠️  No access token available for Microsoft account`);
                return 'NO_TOKEN';
            }

            const graphApiUrl = `https://graph.microsoft.com/v1.0/me/messages`;
            const searchParams = new URLSearchParams({
                $filter: `internetMessageId eq '${messageId}'`,
                $select: 'id,subject,receivedDateTime,isRead',
                $top: '5'
            });

            const response = await fetch(`${graphApiUrl}?${searchParams}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${account.access_token}`, 'Content-Type': 'application/json' },
                timeout: 10000
            });

            if (response.status === 401) {
                console.log(`   🔐 Token expired or invalid for Microsoft account`);
                return 'TOKEN_EXPIRED';
            }

            if (!response.ok) {
                console.log(`   ⚠️  Graph API request failed: ${response.status} ${response.statusText}`);
                return 'API_ERROR';
            }

            const data = await response.json();

            if (data.value && data.value.length > 0) {
                const email = data.value[0];
                console.log(`   ✅ Email found in Microsoft 365 inbox:`);
                console.log(`      Subject: ${email.subject}`);
                console.log(`      Received: ${email.receivedDateTime}`);
                console.log(`      Read: ${email.isRead ? 'Yes' : 'No'}`);
                return 'DELIVERED';
            } else {
                console.log(`   🔍 Email not found in Microsoft 365 inbox`);
                return await this.searchMicrosoftEmailBySubject(account, messageId);
            }

        } catch (error) {
            console.log(`   ⚠️  Microsoft delivery check failed: ${error.message}`);
            if (error.message.includes('token') || error.message.includes('auth') || error.message.includes('401')) {
                return 'TOKEN_EXPIRED';
            }
            return 'CHECK_FAILED';
        }
    }

    // 7. Microsoft Email Search by Subject
    async searchMicrosoftEmailBySubject(account, messageId) {
        try {
            const warmupSubject = 'Warmup Email';
            const graphApiUrl = `https://graph.microsoft.com/v1.0/me/messages`;
            const searchParams = new URLSearchParams({
                $filter: `contains(subject, '${warmupSubject}')`,
                $select: 'id,subject,receivedDateTime,internetMessageId',
                $top: '10',
                $orderby: 'receivedDateTime desc'
            });

            const response = await fetch(`${graphApiUrl}?${searchParams}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${account.access_token}`, 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.value && data.value.length > 0) {
                    console.log(`   📧 Found ${data.value.length} warmup emails in inbox`);
                    return 'LIKELY_DELIVERED';
                }
            }

            console.log(`   🔍 No warmup emails found in Microsoft 365 inbox`);
            return 'NOT_FOUND';

        } catch (error) {
            console.log(`   ⚠️  Subject search failed: ${error.message}`);
            return 'SEARCH_FAILED';
        }
    }

    // 8. Microsoft Token Refresh
    async refreshMicrosoftToken(account) {
        try {
            console.log(`   🔄 Attempting to refresh Microsoft token for: ${account.email}`);
            if (!account.refresh_token) {
                console.log(`   ❌ No refresh token available`);
                return null;
            }

            const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
            const params = new URLSearchParams({
                client_id: process.env.MS_CLIENT_ID,
                client_secret: process.env.MS_CLIENT_SECRET,
                refresh_token: account.refresh_token,
                grant_type: 'refresh_token',
                scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send'
            });

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.log(`   ❌ Token refresh failed: ${response.status} - ${errorText}`);
                return null;
            }

            const tokenData = await response.json();
            console.log(`   ✅ Microsoft token refreshed successfully`);

            return {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || account.refresh_token,
                token_expires_at: Date.now() + (tokenData.expires_in * 1000)
            };

        } catch (error) {
            console.log(`   ❌ Token refresh error: ${error.message}`);
            return null;
        }
    }

    // 9. Job Execution Validation
    async validateJobExecution(sender, receiver, direction) {
        console.log(`   🔍 Pre-execution validation for ${direction}`);
        if (direction === 'WARMUP_TO_POOL') {
            const warmupValid = await this.validateWarmupAccount(sender.email);
            if (!warmupValid) throw new Error(`Warmup account ${sender.email} is no longer valid`);

            if (sender.provider === 'microsoft' || sender.microsoft_id) {
                const microsoftValid = await this.validateMicrosoftAccount(sender);
                if (!microsoftValid) throw new Error(`Microsoft account ${sender.email} needs re-authentication`);
            }
        } else {
            const poolValid = await this.validatePoolAccount(sender.email);
            if (!poolValid) throw new Error(`Pool account ${sender.email} is no longer valid`);
        }
    }

    // 10. Microsoft Account Validation
    async validateMicrosoftAccount(account) {
        try {
            if (account.token_expiry && new Date(account.token_expiry) < new Date()) {
                console.log(`⚠️  Microsoft account has expired token: ${account.email}`);
                if (account.warmupStatus === 'needs_reauth') {
                    console.log(`❌ Microsoft account needs re-authentication: ${account.email}`);
                    return false;
                }
            }
            return true;
        } catch (error) {
            console.error(`❌ Error validating Microsoft account ${account.email}:`, error);
            return false;
        }
    }

    // 11. Warmup Account Validation
    async validateWarmupAccount(email) {
        try {
            const account = await GoogleUser.findOne({ where: { email } }) ||
                await MicrosoftUser.findOne({ where: { email } }) ||
                await SmtpAccount.findOne({ where: { email } });
            return account && account.warmupStatus === 'active' && account.is_connected;
        } catch (error) {
            console.error(`❌ Error validating warmup account ${email}:`, error);
            return false;
        }
    }

    // 12. Pool Account Validation
    async validatePoolAccount(email) {
        try {
            const pool = await EmailPool.findOne({ where: { email, isActive: true } });
            return pool !== null;
        } catch (error) {
            console.error(`❌ Error validating pool account ${email}:`, error);
            return false;
        }
    }

    // 🚨 FIXED: Enhanced email sending with better error handling
    async sendEmailWithFallback(senderConfig, receiver, replyRate, isCoordinatedJob = true, isInitialEmail = true, isReply = false, direction = 'unknown') {
        let retryCount = 0;
        const maxRetries = 2;

        // 🚨 DETERMINE ACCOUNT TYPE PROPERLY
        const accountType = this.determineAccountType(senderConfig);
        console.log(`📧 Account Type: ${accountType} for ${senderConfig.email}`);

        // 🚨 VALIDATE CONFIGURATION BEFORE SENDING
        if (accountType === 'smtp' || accountType === 'unknown') {
            console.log(`🔧 Validating SMTP configuration for ${senderConfig.email}`);

            // Check for required SMTP credentials
            const hasSmtpCredentials = senderConfig.smtpHost && senderConfig.smtpPort &&
                (senderConfig.smtpPass || senderConfig.appPassword);

            if (!hasSmtpCredentials) {
                console.log(`❌ Missing SMTP credentials for ${senderConfig.email}`);

                // Try to auto-configure for custom domains
                if (this.isCustomDomain(senderConfig.email)) {
                    console.log(`🔄 Attempting auto-configuration for custom domain`);
                    // The buildTransporterConfig will handle auto-configuration
                } else {
                    throw new Error(`SMTP account ${senderConfig.email} missing credentials (host, port, and password required)`);
                }
            }
        }

        while (retryCount <= maxRetries) {
            try {
                console.log(`📧 Sending ${direction} email from ${senderConfig.email} to ${receiver.email}`);
                console.log(`   Method: ${accountType === 'microsoft_personal' ? 'Graph API' : 'SMTP'}`);

                const sendResult = await warmupSingleEmail(senderConfig, receiver, replyRate, isReply, isCoordinatedJob, isInitialEmail, direction);

                if (!sendResult || sendResult.success === false) {
                    throw new Error(sendResult?.error || 'Email sending failed');
                }

                return {
                    success: true,
                    messageId: sendResult?.messageId || sendResult?.emailId || `sent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    subject: sendResult?.subject || 'Warmup Email',
                    deliveredInbox: sendResult?.deliveredInbox,
                    deliveryFolder: sendResult?.deliveryFolder,
                    method: accountType === 'microsoft_personal' ? 'graph_api' : 'smtp'
                };

            } catch (error) {
                retryCount++;
                console.log(`❌ Send attempt ${retryCount}/${maxRetries + 1} failed: ${error.message}`);

                // 🚨 SPECIFIC ERROR HANDLING FOR CONNECTION ISSUES
                if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED')) {
                    console.log(`   🌐 Connection issue detected: ${error.message}`);

                    if (accountType === 'smtp' && this.isCustomDomain(senderConfig.email)) {
                        console.log(`   🔄 Custom domain connection failed, might need manual SMTP configuration`);
                    }
                }

                if (retryCount > maxRetries) {
                    console.log(`💥 Max retries exceeded for: ${senderConfig.email}`);

                    return {
                        success: false,
                        messageId: `failed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        error: error.message,
                        subject: 'Warmup Email',
                        requiresManualConfig: error.message.includes('ETIMEDOUT') && this.isCustomDomain(senderConfig.email)
                    };
                }

                await this.delay(2000 * retryCount);
            }
        }
    }

    // Add to your WarmupWorker class

    async checkEmailStatusWithRetry(receiver, messageId, direction = 'WARMUP_TO_POOL', maxRetries = 3) {
        console.log(`🔍 Checking email status with retry: ${messageId}`);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`   🔄 Attempt ${attempt}/${maxRetries}`);

                const result = await checkEmailStatus(receiver, messageId, direction);

                if (result.exists) {
                    console.log(`✅ Email found in folder: ${result.folder}`);
                    return result;
                }

                if (attempt < maxRetries) {
                    const delayMs = Math.min(30000, attempt * 10000); // 10s, 20s, 30s
                    console.log(`   ⏳ Email not found, waiting ${delayMs / 1000}s before retry...`);
                    await this.delay(delayMs);
                }
            } catch (error) {
                console.error(`   ❌ Check attempt ${attempt} failed: ${error.message}`);
                if (attempt === maxRetries) throw error;
            }
        }

        console.log(`❌ Email not found after ${maxRetries} attempts`);
        return {
            success: true,
            folder: 'NOT_FOUND',
            exists: false,
            deliveredInbox: false
        };
    }

    // Add to WarmupWorker class

    async verifyDeliveryWithRetry(receiver, messageId, direction, senderEmail, maxRetries = 3) {
        console.log(`   🔍 Starting delivery verification for: ${messageId}`);

        // Initial delay to allow for email processing
        await this.delay(5000);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`   🔄 Delivery check ${attempt}/${maxRetries}`);

                const status = await checkEmailStatusWithSpamTracking(
                    receiver,
                    messageId,
                    direction,
                    senderEmail
                );

                if (status.exists) {
                    console.log(`   ✅ Email delivered: ${status.folder} (Inbox: ${status.deliveredInbox})`);

                    // Handle spam folder placement
                    if (status.isSpamFolder) {
                        console.log(`   ⚠️  Email in spam folder, attempting recovery...`);
                        await moveEmailToInboxWithTracking(
                            receiver,
                            messageId,
                            status.folder,
                            direction,
                            senderEmail
                        );
                    }

                    return status;
                }

                if (attempt < maxRetries) {
                    const retryDelay = Math.min(60000, attempt * 15000); // 15s, 30s, 60s
                    console.log(`   ⏳ Not found, retrying in ${retryDelay / 1000}s...`);
                    await this.delay(retryDelay);
                }

            } catch (error) {
                console.error(`   ❌ Delivery check error: ${error.message}`);
                if (attempt === maxRetries) throw error;
            }
        }

        console.log(`   ❌ Email not delivered after ${maxRetries} attempts`);
        return {
            success: false,
            exists: false,
            deliveredInbox: false,
            folder: 'NOT_FOUND'
        };
    }

    // 🚨 NEW: Enhanced Delivery Verification with Spam Tracking
    async verifyEmailDeliveryWithSpamTracking(messageId, receiver, direction, senderEmail, sendResult) {
        try {
            console.log(`🔍 Verifying delivery with spam tracking: ${messageId}`);

            // Skip IMAP check for Graph API emails
            if (messageId && messageId.startsWith('graph-')) {
                console.log(`⏩ Skipping IMAP check for Graph API email`);
                return;
            }

            // Skip for pool accounts in inbound direction
            if (direction === 'POOL_TO_WARMUP' && receiver.providerType) {
                console.log(`⏩ Skipping IMAP check for pool account in inbound direction`);
                return;
            }

            // Wait a bit for delivery
            await this.delay(10000);

            // 🚨 USE ENHANCED SPAM TRACKING
            const statusResult = await checkEmailStatusWithSpamTracking(
                receiver,
                messageId,
                direction,
                senderEmail
            );

            // 🚨 HANDLE SPAM FOLDER PLACEMENT
            if (statusResult.isSpamFolder) {
                console.log(`⚠️  Email placed in spam folder: ${statusResult.folder}`);

                // Attempt to move from spam to inbox
                const moveResult = await moveEmailToInboxWithTracking(
                    receiver,
                    messageId,
                    statusResult.folder,
                    direction,
                    senderEmail
                );

                if (moveResult.success && !moveResult.skipped) {
                    console.log(`✅ Successfully moved email from spam to inbox`);
                }
            }

            // Update tracking based on final status
            if (statusResult.success && statusResult.exists) {
                const finalDeliveredInbox = statusResult.deliveredInbox && !statusResult.isSpamFolder;

                await trackingService.trackEmailDelivered(messageId, {
                    deliveredInbox: finalDeliveredInbox,
                    deliveryFolder: statusResult.folder,
                    isSpamFolder: statusResult.isSpamFolder,
                    spamRecoveryAttempted: statusResult.isSpamFolder
                });
            }

        } catch (error) {
            console.error(`❌ Delivery verification failed: ${error.message}`);
            // Don't throw error - this shouldn't break the main email sending flow
        }
    }
    // 14. Message ID Extraction
    extractMessageIdFromResponse(sendResult) {
        if (!sendResult) return null;
        if (typeof sendResult === 'string') {
            const messageIdMatch = sendResult.match(/<([^>]+)>/);
            return messageIdMatch ? messageIdMatch[1] : sendResult;
        }
        if (sendResult.messageId) return sendResult.messageId;
        if (sendResult.emailId) return sendResult.emailId;
        if (sendResult.id) return sendResult.id;
        return null;
    }

    // 15. Token Refresh Capability Check
    async canRefreshMicrosoftToken(senderConfig) {
        try {
            const hasRefreshToken = !!senderConfig.refresh_token;
            const hasClientCredentials = !!process.env.MICROSOFT_CLIENT_ID && !!process.env.MICROSOFT_CLIENT_SECRET;
            if (!hasRefreshToken || !hasClientCredentials) {
                console.log(`❌ Cannot refresh token: missing refresh token or client credentials`);
                return false;
            }
            return true;
        } catch (error) {
            console.error(`❌ Error checking token refresh capability:`, error);
            return false;
        }
    }

    // 16. Mark Account for Re-authentication
    async markAccountAsNeedsReauth(email) {
        try {
            await MicrosoftUser.update(
                { warmupStatus: 'needs_reauth', is_connected: false },
                { where: { email } }
            );
            console.log(`🔐 Marked ${email} as needing re-authentication`);
        } catch (error) {
            console.error(`❌ Error marking account for re-auth:`, error);
        }
    }

    // 🚨 UPDATE THIS METHOD IN WarmupWorker class
    async saveRefreshedTokens(email, tokens) {
        try {
            const MicrosoftUser = require('../models/MicrosoftUser');

            // Update MicrosoftUser table for warmup accounts
            const updated = await MicrosoftUser.update(
                {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expires_at: tokens.token_expires_at,
                    expires_at: tokens.token_expiry // Map to expires_at field
                },
                { where: { email } }
            );

            if (updated[0] > 0) {
                console.log(`✅ Saved refreshed tokens in MicrosoftUser for: ${email}`);
                return true;
            }

            console.log(`❌ Could not save tokens - account not found in MicrosoftUser: ${email}`);
            return false;

        } catch (error) {
            console.error('❌ Error saving refreshed tokens:', error.message);
            return false;
        }
    }

    // 18. Get Sender Account
    async getSenderAccount(senderType, email) {
        try {
            if (senderType === 'pool') {
                let poolAccount = await this.getPoolAccount(email);
                if (!poolAccount) throw new Error(`Pool account not found: ${email}`);
                poolAccount = this.normalizePoolAccountFields(poolAccount);
                console.log(`🔍 NORMALIZED Pool Account ${email}:`);
                console.log(`   Daily Capacity: ${poolAccount.currentDaySent || 0}/${poolAccount.maxEmailsPerDay || 50}`);
                console.log(`   Token Status: ${poolAccount.access_token ? 'VALID' : 'MISSING'}`);
                return poolAccount;
            } else {
                return await this.getWarmupAccount(senderType, email);
            }
        } catch (error) {
            console.error(`❌ Error fetching sender account ${email}:`, error.message);
            return null;
        }
    }

    // 19. Normalize Pool Account Fields
    normalizePoolAccountFields(account) {
        const normalized = { ...account };
        if (normalized.token_expires_at && !normalized.token_expiry) {
            const expiryDate = new Date(Number(normalized.token_expires_at));
            normalized.token_expiry = expiryDate.toISOString();
            console.log(`   🔄 Converted token_expires_at to token_expiry: ${normalized.token_expiry}`);
        }
        if (!normalized.access_token && normalized.accessToken) normalized.access_token = normalized.accessToken;
        if (!normalized.refresh_token && normalized.refreshToken) normalized.refresh_token = normalized.refreshToken;
        if (!normalized.maxEmailsPerDay) normalized.maxEmailsPerDay = 50;
        if (!normalized.currentDaySent) normalized.currentDaySent = 0;
        return normalized;
    }

    // 20. Get Receiver Account
    async getReceiverAccount(receiverType, email) {
        try {
            if (receiverType === 'pool') {
                return await this.getPoolAccount(email);
            } else {
                let account = await GoogleUser.findOne({ where: { email } });
                if (account) return this.convertToPlainObject(account);
                account = await MicrosoftUser.findOne({ where: { email } });
                if (account) return this.convertToPlainObject(account);
                account = await SmtpAccount.findOne({ where: { email } });
                if (account) return this.convertToPlainObject(account);
                console.error(`❌ Receiver account not found: ${email}`);
                return null;
            }
        } catch (error) {
            console.error(`❌ Error fetching receiver account ${email}:`, error.message);
            return null;
        }
    }

    // 21. Convert to Plain Object
    convertToPlainObject(instance) {
        if (!instance) return null;
        return instance.get ? instance.get({ plain: true }) : instance;
    }

    // 22. Process Single Email
    async processSingleEmail(job) {
        const { senderEmail, senderType, receiverEmail, replyRate } = job;
        if (!senderEmail || !senderType || !receiverEmail) {
            console.error('❌ Missing required job fields');
            return;
        }
        const sender = await this.getWarmupAccount(senderType, senderEmail);
        const receiver = await this.getPoolAccount(receiverEmail);
        if (!sender) {
            console.error(`❌ Warmup account not found: ${senderEmail}`);
            return;
        }
        if (!receiver) {
            console.error(`❌ Pool account not found: ${receiverEmail}`);
            return;
        }
        const canSend = await volumeEnforcement.canAccountSendEmail(senderEmail, 'warmup');
        if (!canSend) {
            console.log(`   🛑 DAILY LIMIT REACHED: ${senderEmail} cannot send more emails today`);
            return;
        }
        const senderConfig = buildWarmupConfig(sender);
        const safeReplyRate = Math.min(0.25, replyRate || 0.25);
        await warmupSingleEmail(senderConfig, receiver, safeReplyRate, false, true);
        console.log(`✅ Warmup completed: ${senderEmail} -> ${receiverEmail}`);
    }

    // 23. Delay Utility
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = WarmupWorker;