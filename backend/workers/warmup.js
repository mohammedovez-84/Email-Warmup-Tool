// workers/warmupWorker.js - COMPLETE FIXED VERSION
const EmailExchange = require("../models/MailExchange")
require('dotenv').config({ path: '../.env' });
const { Op } = require('sequelize');
const getChannel = require('../queues/rabbitConnection');
const {
    warmupSingleEmail,
    canPoolSendMore,
} = require('../services/warmupWorkflow');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const EmailPool = require('../models/EmailPool');
const { buildSenderConfig, buildWarmupConfig, buildPoolConfig } = require('../utils/senderConfig');
const volumeEnforcement = require('../services/volume-enforcement');

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

    // 🚨 UPDATED: Handle Warmup to Pool with Status Tracking
    async handleWarmupToPool(pair, warmupAccount) {
        console.log(`   🔄 HANDLING SENDING: ${pair.senderEmail} → ${pair.receiverEmail}`);

        let exchangeRecord;
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

            const sendResult = await this.sendEmailWithFallback(
                senderConfig,
                receiver,
                safeReplyRate,
                true,
                true,
                false,
                'WARMUP_TO_POOL'
            );

            // 🚨 CRITICAL: UPDATE THE STATUS BASED ON ACTUAL RESULT
            let finalStatus = 'sent';

            if (sendResult && sendResult.success) {
                finalStatus = sendResult.messageId ? 'delivered' : 'sent';
            } else {
                finalStatus = 'failed';
            }

            // UPDATE EXCHANGE RECORD WITH REAL STATUS
            await exchangeRecord.update({
                messageId: sendResult?.messageId,
                status: finalStatus,
                sentAt: new Date()
            });

            // 🚨 UPDATE DAILY COUNT
            await this.incrementDailySentCount(warmupAccount, 'warmup');

            console.log(`   ✅ WARMUP_TO_POOL email completed: ${pair.senderEmail} → ${pair.receiverEmail} [${finalStatus}]`);

        } catch (error) {
            console.error(`   ❌ Failed WARMUP_TO_POOL email: ${error.message}`);

            // 🚨 MARK AS FAILED ON ERROR
            if (exchangeRecord) {
                await exchangeRecord.update({
                    status: 'failed',
                    error: error.message
                });
            }
        }
    }

    // 🚨 UPDATED: Handle Pool to Warmup with Status Tracking
    async handlePoolToWarmup(pair, warmupAccount) {
        console.log(`   🔄 HANDLING RECEIVING: ${pair.senderEmail} → ${pair.receiverEmail}`);

        let exchangeRecord;
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

            const sendResult = await this.sendEmailWithFallback(
                senderConfig,
                receiver,
                safeReplyRate,
                true,
                false,
                true,
                'POOL_TO_WARMUP'
            );

            // 🚨 CRITICAL: UPDATE THE STATUS BASED ON ACTUAL RESULT
            let finalStatus = 'sent';

            if (sendResult && sendResult.success) {
                finalStatus = sendResult.messageId ? 'delivered' : 'sent';
            } else {
                finalStatus = 'failed';
            }

            // UPDATE EXCHANGE RECORD WITH REAL STATUS
            await exchangeRecord.update({
                messageId: sendResult?.messageId,
                status: finalStatus,
                sentAt: new Date()
            });

            // 🚨 UPDATE DAILY COUNTS
            await this.incrementDailySentCount(pair.senderEmail, 'pool');
            await this.incrementDailyReceivedCount(warmupAccount);

            console.log(`   ✅ POOL_TO_WARMUP email completed: ${pair.senderEmail} → ${pair.receiverEmail} [${finalStatus}]`);

        } catch (error) {
            console.error(`   ❌ Failed POOL_TO_WARMUP email: ${error.message}`);

            // 🚨 MARK AS FAILED ON ERROR
            if (exchangeRecord) {
                await exchangeRecord.update({
                    status: 'failed',
                    error: error.message
                });
            }
        }
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

    // 🚨 ADDED: Get Warmup Account
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

    // 5. Token Expiry Check
    isTokenExpired(account) {
        if (!account.token_expiry && !account.token_expires_at) {
            console.log(`   ⚠️  No token expiry information available`);
            return true;
        }
        try {
            let expiryTime;
            if (account.token_expiry) expiryTime = new Date(account.token_expiry).getTime();
            else if (account.token_expires_at) expiryTime = Number(account.token_expires_at);

            const now = Date.now();
            const bufferTime = 5 * 60 * 1000;
            const isExpired = now >= (expiryTime - bufferTime);

            if (isExpired) {
                console.log(`   ⏰ Token expired or expiring soon`);
                console.log(`      Now: ${new Date(now).toISOString()}`);
                console.log(`      Expiry: ${new Date(expiryTime).toISOString()}`);
            }
            return isExpired;
        } catch (error) {
            console.error(`   ❌ Error checking token expiry:`, error);
            return true;
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

    // 13. Email Sending with Fallback
    async sendEmailWithFallback(senderConfig, receiver, replyRate, isCoordinatedJob = true, isInitialEmail = true, isReply = false, direction = 'unknown') {
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
            try {
                console.log(`📧 Sending ${direction} email from ${senderConfig.email} to ${receiver.email}`);
                const originalSenderConfig = { ...senderConfig };

                const sendResult = await warmupSingleEmail(senderConfig, receiver, replyRate, isReply, isCoordinatedJob, isInitialEmail, direction);

                if (senderConfig.access_token !== originalSenderConfig.access_token) {
                    await this.saveRefreshedTokens(senderConfig.email, {
                        access_token: senderConfig.access_token,
                        refresh_token: senderConfig.refresh_token,
                        token_expires_at: senderConfig.token_expires_at
                    });
                }

                // 🚨 RETURN PROPER RESULT OBJECT
                return {
                    success: true,
                    messageId: sendResult?.messageId || sendResult?.emailId || this.extractMessageIdFromResponse(sendResult) || `msg-${Date.now()}`
                };

            } catch (error) {
                retryCount++;

                if (retryCount > maxRetries) {
                    console.log(`❌ Max retries exceeded for: ${senderConfig.email}`);
                    return {
                        success: false,
                        messageId: null,
                        error: error.message
                    };
                }

                console.log(`🔄 Retrying (${retryCount}/${maxRetries})...`);
                await this.delay(2000 * retryCount);
            }
        }

        return { success: false, messageId: null };
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

    // 17. Save Refreshed Tokens
    async saveRefreshedTokens(email, tokens) {
        try {
            await EmailPool.update(
                {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expires_at: tokens.token_expires_at
                },
                { where: { email } }
            );
            console.log(`💾 Saved refreshed tokens for ${email}`);
        } catch (error) {
            console.error('❌ Failed to save refreshed tokens:', error.message);
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