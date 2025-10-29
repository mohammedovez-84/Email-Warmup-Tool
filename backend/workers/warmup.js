require('dotenv').config({ path: '../.env' });

const getChannel = require('../queues/rabbitConnection');
const {
    warmupSingleEmail,
    canPoolSendMore,
    updatePoolSentCount,
    getFreshAccountData
} = require('../services/warmupWorkflow');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const EmailPool = require('../models/EmailPool');
const { buildSenderConfig, buildWarmupConfig, buildPoolConfig } = require('../utils/senderConfig');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class WarmupWorker {
    constructor() {
        this.processing = false;
        this.lastProcessedTime = 0;
        this.MIN_JOB_INTERVAL = 3 * 60 * 1000;
    }

    async consumeWarmupJobs() {
        const channel = await getChannel();
        await channel.assertQueue('warmup_jobs', { durable: true });

        channel.prefetch(1);

        channel.consume(
            'warmup_jobs',
            async (msg) => {
                if (!msg) return;

                if (this.processing) {
                    console.log('⏳ Worker busy, requeuing message...');
                    channel.nack(msg, false, true);
                    return;
                }

                this.processing = true;

                const now = Date.now();
                const timeSinceLastJob = now - this.lastProcessedTime;

                if (timeSinceLastJob < this.MIN_JOB_INTERVAL) {
                    const delayMs = this.MIN_JOB_INTERVAL - timeSinceLastJob;
                    console.log(`⏳ Delay: ${Math.round(delayMs / 1000)} seconds between jobs`);
                    await delay(delayMs);
                }

                await this.processJob(channel, msg);

                this.lastProcessedTime = Date.now();
                this.processing = false;
            },
            { noAck: false }
        );
    }

    async processJob(channel, msg) {
        let job = null;

        try {
            job = JSON.parse(msg.content.toString());

            if (job.coordinated && job.timeSlot && job.pairs) {
                console.log('🔨 Processing COORDINATED warmup job:', {
                    timeSlot: job.timeSlot,
                    pairs: job.pairs.length,
                    round: job.round,
                    individualSchedule: job.individualSchedule || false
                });

                if (job.individualSchedule) {
                    await this.processIndividualEmail(job);
                } else {
                    await this.processCoordinatedTimeSlot(job);
                }
            } else {
                console.log('🔨 Processing SINGLE warmup job');
                await this.processSingleEmail(job);
            }

            channel.ack(msg);

        } catch (err) {
            console.error('❌ Error processing warmup job:', err.message);

            // if (err.message.includes('account not found') || err.message.includes('configuration') || err.message.includes('password') || err.message.includes('SMTP')) {
            //     console.error('❌ Configuration or account error, acknowledging message without retry');
            //     channel.ack(msg);
            // } else if (msg.fields.redelivered && msg.fields.redeliveryCount >= 2) {
            //     console.error('❌ Max retries exceeded, acknowledging message');
            //     channel.ack(msg);
            // } else {
            //     const retryDelay = Math.min(5 * 60 * 1000, 1000 * Math.pow(2, msg.fields.redeliveryCount || 1));
            //     console.log(`🔄 Retrying in ${retryDelay / 1000}s...`);
            //     setTimeout(() => {
            //         channel.nack(msg, false, true);
            //     }, retryDelay);
            // }
        }
    }

    async processIndividualEmail(job) {
        const { timeSlot, pairs, scheduledTime, direction } = job;
        const pair = pairs[0];

        console.log(`🎯 Executing ${direction} email: ${scheduledTime}`);

        if (!pairs || pairs.length === 0) {
            console.log('⚠️ No pairs found in individual email job');
            return;
        }

        try {
            let sender, receiver;

            // FIXED: Proper sender/receiver resolution based on direction
            if (direction === 'WARMUP_TO_POOL') {
                // Warmup account → Pool account
                sender = await this.getWarmupAccount(pair.senderType, pair.senderEmail);
                receiver = await this.getPoolAccount(pair.receiverEmail); // Pool account
            } else {
                // Pool account → Warmup account  
                sender = await this.getPoolAccount(pair.senderEmail); // Pool account
                receiver = await this.getWarmupAccount(pair.receiverType, pair.receiverEmail);
            }

            if (!sender) {
                throw new Error(`Sender account not found: ${pair.senderEmail}`);
            }
            if (!receiver) {
                throw new Error(`Receiver account not found: ${pair.receiverEmail}`);
            }

            console.log(`   📧 Processing: ${pair.senderEmail} → ${pair.receiverEmail} [${direction}]`);

            // FIXED: Use appropriate config builder based on account type
            let senderConfig;
            if (direction === 'POOL_TO_WARMUP') {
                senderConfig = buildPoolConfig(sender);
            } else {
                senderConfig = buildWarmupConfig(sender);
            }

            const safeReplyRate = pair.replyRate || 0.25;

            // For pool senders, check capacity before sending
            if (direction === 'POOL_TO_WARMUP') {
                if (!await canPoolSendMore(sender)) {
                    throw new Error(`Pool account ${pair.senderEmail} has reached daily limit`);
                }
            }

            // FIXED: Use unified email sending with direction-specific parameters
            const isOutbound = direction === 'WARMUP_TO_POOL';
            const isReply = direction === 'POOL_TO_WARMUP';

            await this.sendEmailWithFallback(
                senderConfig,
                receiver,
                safeReplyRate,
                true, // isCoordinatedJob
                isOutbound, // isInitialEmail (true for outbound, false for inbound)
                isReply,    // isReply (false for outbound, true for inbound)
                direction   // Pass direction for logging
            );

            console.log(`   ✅ ${direction} email completed: ${pair.senderEmail} → ${pair.receiverEmail}`);

        } catch (error) {
            console.error(`   ❌ Failed ${direction} email: ${error.message}`);
            throw error;
        }
    }

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

                // FIXED: Handle both directions in coordinated slots
                if (pair.direction === 'WARMUP_TO_POOL') {
                    sender = await this.getWarmupAccount(pair.senderType, pair.senderEmail);
                    receiver = await this.getPoolAccount(pair.receiverEmail);
                } else {
                    sender = await this.getPoolAccount(pair.senderEmail);
                    receiver = await this.getWarmupAccount(pair.receiverType, pair.receiverEmail);
                }

                if (!sender) {
                    throw new Error(`Sender account not found: ${pair.senderEmail}`);
                }
                if (!receiver) {
                    throw new Error(`Receiver account not found: ${pair.receiverEmail}`);
                }

                // ENHANCED: Check pool capacity before processing
                if (pair.senderType === 'pool') {
                    if (!await canPoolSendMore(sender)) {
                        console.log(`     ⏩ Skipping: ${pair.senderEmail} reached daily limit`);
                        sendResults.push({ pair, success: false, error: 'Pool daily limit reached' });
                        continue;
                    }
                }

                // FIXED: Use appropriate config builder
                let senderConfig;
                if (pair.direction === 'POOL_TO_WARMUP') {
                    senderConfig = buildPoolConfig(sender);
                } else {
                    senderConfig = buildWarmupConfig(sender);
                }

                const safeReplyRate = pair.replyRate || 0.25;

                // Add delay between emails for better distribution
                if (i > 0) {
                    await delay(5000); // 5 seconds between emails in same slot
                }

                // Determine email type based on direction
                const isOutbound = pair.direction === 'WARMUP_TO_POOL';
                const isReply = pair.direction === 'POOL_TO_WARMUP';

                await this.sendEmailWithFallback(
                    senderConfig,
                    receiver,
                    safeReplyRate,
                    true, // isCoordinatedJob
                    isOutbound, // isInitialEmail
                    isReply,    // isReply
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

        // Log detailed results
        const failedPairs = sendResults.filter(result => !result.success);
        if (failedPairs.length > 0) {
            console.log(`   ❌ Failed emails:`);
            failedPairs.forEach(result => {
                console.log(`     - ${result.pair.senderEmail} → ${result.pair.receiverEmail}: ${result.error}`);
            });
        }
    }

    async sendEmailWithFallback(senderConfig, receiver, replyRate, isCoordinatedJob = true, isInitialEmail = true, isReply = false, direction = 'unknown') {
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
            try {
                console.log(`📧 Sending ${direction} email from ${senderConfig.email} to ${receiver.email}`);
                console.log(`🔧 Email Type: ${isReply ? 'REPLY' : isInitialEmail ? 'INITIATION' : 'UNKNOWN'}`);
                console.log(`🔧 Direction: ${direction}, Coordinated: ${isCoordinatedJob}`);

                // Store original senderConfig for potential updates
                const originalSenderConfig = { ...senderConfig };

                await warmupSingleEmail(
                    senderConfig,
                    receiver,
                    replyRate,
                    isReply,
                    isCoordinatedJob,
                    isInitialEmail,
                    direction
                );

                // If senderConfig was updated with new tokens during the process, save them
                if (senderConfig.access_token !== originalSenderConfig.access_token) {
                    await this.saveRefreshedTokens(senderConfig.email, {
                        access_token: senderConfig.access_token,
                        refresh_token: senderConfig.refresh_token,
                        token_expires_at: senderConfig.token_expires_at
                    });
                }

                return; // Success, exit the retry loop

            } catch (error) {
                retryCount++;

                // Enhanced error handling with retry logic
                if (error.message.includes('IMAP') || error.message.includes('getaddrinfo')) {
                    console.log(`     ⚠️  IMAP issue but email was likely sent: ${error.message}`);
                    return;
                }

                if (error.message.includes('daily limit')) {
                    console.log(`     ⏩ Pool limit reached: ${error.message}`);
                    return; // Don't retry pool limit errors
                }

                if (error.message.includes('rate limit')) {
                    console.log(`     ⏩ Rate limit reached: ${error.message}`);
                    return; // Don't retry rate limit errors
                }

                if (error.message.includes('account not found')) {
                    console.log(`     ❌ Account not found: ${error.message}`);
                    return; // Don't retry account not found errors
                }

                if (error.message.includes('access token') && retryCount <= maxRetries) {
                    console.log(`     🔄 Token error, retrying (${retryCount}/${maxRetries})...`);

                    // Refresh the sender account data and try again
                    try {
                        const freshSender = await this.getSenderAccount(
                            senderConfig.providerType ? 'pool' : 'warmup',
                            senderConfig.email
                        );
                        if (freshSender) {
                            Object.assign(senderConfig, buildSenderConfig(freshSender));
                            await delay(2000 * retryCount); // Exponential backoff
                            continue; // Retry the loop
                        }
                    } catch (refreshError) {
                        console.log(`     ❌ Failed to refresh sender data: ${refreshError.message}`);
                    }
                }

                // If we've exhausted retries or it's not a retryable error, throw
                if (retryCount > maxRetries) {
                    console.log(`     ❌ Max retries exceeded for: ${senderConfig.email}`);
                }

                throw error;
            }
        }
    }

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

    // FIXED: Get warmup account from all tables with better error handling
    async getWarmupAccount(senderType, email) {
        try {
            console.log(`🔍 Searching for warmup account: ${email} (type: ${senderType})`);

            let sender = null;

            // Try specific model first if type is provided
            if (senderType === 'google') {
                sender = await GoogleUser.findOne({ where: { email, warmupStatus: 'active' } });
                console.log(`   🔍 GoogleUser search: ${sender ? 'FOUND' : 'NOT FOUND'}`);
            } else if (senderType === 'microsoft') {
                sender = await MicrosoftUser.findOne({ where: { email, warmupStatus: 'active' } });
                console.log(`   🔍 MicrosoftUser search: ${sender ? 'FOUND' : 'NOT FOUND'}`);
            } else if (senderType === 'smtp') {
                sender = await SmtpAccount.findOne({ where: { email, warmupStatus: 'active' } });
                console.log(`   🔍 SmtpAccount search: ${sender ? 'FOUND' : 'NOT FOUND'}`);
            } else {
                console.log(`   🔍 No specific type provided, searching all models`);
            }

            // If not found by specific type OR no type provided, search all models
            if (!sender) {
                console.log(`   🔄 Comprehensive search for: ${email}`);

                // Search Google accounts
                sender = await GoogleUser.findOne({ where: { email, warmupStatus: 'active' } });
                console.log(`     GoogleUser: ${sender ? 'FOUND' : 'NOT FOUND'}`);

                if (!sender) {
                    // Search Microsoft accounts
                    sender = await MicrosoftUser.findOne({ where: { email, warmupStatus: 'active' } });
                    console.log(`     MicrosoftUser: ${sender ? 'FOUND' : 'NOT FOUND'}`);
                }

                if (!sender) {
                    // Search SMTP accounts
                    sender = await SmtpAccount.findOne({ where: { email, warmupStatus: 'active' } });
                    console.log(`     SmtpAccount: ${sender ? 'FOUND' : 'NOT FOUND'}`);
                }
            }

            if (!sender) {
                console.error(`❌ Active warmup account not found: ${email}`);
                console.error(`   Searched in: GoogleUser, MicrosoftUser, SmtpAccount`);
                console.error(`   Conditions: warmupStatus='active', email='${email}'`);
                return null;
            }

            const plainSender = this.convertToPlainObject(sender);
            console.log(`   ✅ Found warmup account: ${plainSender.email}`);
            console.log(`   📊 Account details: provider=${plainSender.provider || 'unknown'}, type=${senderType}`);

            return plainSender;

        } catch (error) {
            console.error(`❌ Error fetching warmup account ${email} for type ${senderType}:`, error.message);
            return null;
        }
    }

    async getPoolAccount(email) {
        try {
            console.log(`🔍 Searching for pool account: ${email}`);

            const poolAccount = await EmailPool.findOne({
                where: { email, isActive: true },
                raw: true
            });

            if (!poolAccount) {
                console.error(`❌ Active pool account not found: ${email}`);
                return null;
            }

            console.log(`📋 POOL ACCOUNT DATA for ${email}:`);
            console.log(`   Provider: ${poolAccount.providerType}`);
            console.log(`   Daily Usage: ${poolAccount.currentDaySent || 0}/${poolAccount.maxEmailsPerDay || 50}`);
            console.log(`   Last Reset: ${poolAccount.lastResetDate || 'Never'}`);
            console.log(`   Access Token: ${poolAccount.access_token ? 'PRESENT' : 'MISSING'}`);

            return poolAccount;
        } catch (error) {
            console.error(`❌ Error finding pool account ${email}:`, error.message);
            return null;
        }
    }

    async getSenderAccount(senderType, email) {
        try {
            if (senderType === 'pool') {
                let poolAccount = await this.getPoolAccount(email);

                if (!poolAccount) {
                    throw new Error(`Pool account not found: ${email}`);
                }

                // Enhanced normalization for pool accounts
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

    normalizePoolAccountFields(account) {
        const normalized = { ...account };

        // Convert token_expires_at (BIGINT) to token_expiry (Date string)
        if (normalized.token_expires_at && !normalized.token_expiry) {
            const expiryDate = new Date(Number(normalized.token_expires_at));
            normalized.token_expiry = expiryDate.toISOString();
            console.log(`   🔄 Converted token_expires_at to token_expiry: ${normalized.token_expiry}`);
        }

        // Ensure all expected fields are present
        if (!normalized.access_token && normalized.accessToken) {
            normalized.access_token = normalized.accessToken;
        }
        if (!normalized.refresh_token && normalized.refreshToken) {
            normalized.refresh_token = normalized.refreshToken;
        }

        // Ensure pool-specific fields
        if (!normalized.maxEmailsPerDay) {
            normalized.maxEmailsPerDay = 50; // Default pool limit
        }
        if (!normalized.currentDaySent) {
            normalized.currentDaySent = 0;
        }

        return normalized;
    }

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

    // Helper method to convert Sequelize instances to plain objects
    convertToPlainObject(instance) {
        if (!instance) return null;
        return instance.get ? instance.get({ plain: true }) : instance;
    }

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

        const senderConfig = buildWarmupConfig(sender);
        const safeReplyRate = Math.min(0.25, replyRate || 0.25);

        await warmupSingleEmail(senderConfig, receiver, safeReplyRate, false, true);
        console.log(`✅ Warmup completed: ${senderEmail} -> ${receiverEmail}`);
    }
}

module.exports = { WarmupWorker };