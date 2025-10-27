require('dotenv').config({ path: '../.env' });

const getChannel = require('../queues/rabbitConnection');
const { warmupSingleEmail } = require('../services/warmupWorkflow');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const EmailPool = require('../models/EmailPool');
const { buildSenderConfig } = require('../utils/senderConfig');

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
                console.log('🔨 Processing coordinated warmup job:', {
                    timeSlot: job.timeSlot,
                    pairs: job.pairs.length,
                    round: job.round
                });
                await this.processCoordinatedTimeSlot(job);
            } else {
                console.log('🔨 Processing single warmup job');
                await this.processSingleEmail(job);
            }

            channel.ack(msg);

        } catch (err) {
            console.error('❌ Error processing warmup job:', err.message);

            if (err.message.includes('configuration') || err.message.includes('password') || err.message.includes('SMTP')) {
                console.error('❌ Configuration error, acknowledging message without retry');
                channel.ack(msg);
            } else if (msg.fields.redelivered && msg.fields.redeliveryCount >= 2) {
                console.error('❌ Max retries exceeded, acknowledging message');
                channel.ack(msg);
            } else {
                const retryDelay = Math.min(5 * 60 * 1000, 1000 * Math.pow(2, msg.fields.redeliveryCount || 1));
                console.log(`🔄 Retrying in ${retryDelay / 1000}s...`);
                setTimeout(() => {
                    channel.nack(msg, false, true);
                }, retryDelay);
            }
        }
    }

    async processCoordinatedTimeSlot(job) {
        const { timeSlot, pairs, round } = job;

        console.log(`🎯 Executing time slot: ${timeSlot}`);
        console.log(`   Processing ${pairs.length} warmup emails`);

        const sendResults = [];
        let successCount = 0;

        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];

            console.log(`     📥 Processing (${i + 1}/${pairs.length}): ${pair.senderEmail} → ${pair.receiverEmail} [${pair.direction}]`);

            try {
                const sender = await this.getSenderAccount(pair.senderType, pair.senderEmail);
                const receiver = await this.getReceiverAccount(pair.receiverType, pair.receiverEmail);

                if (!sender) {
                    throw new Error(`Sender account not found: ${pair.senderEmail}`);
                }
                if (!receiver) {
                    throw new Error(`Receiver account not found: ${pair.receiverEmail}`);
                }

                // Use buildSenderConfig without second parameter
                const senderConfig = buildSenderConfig(sender);
                const safeReplyRate = pair.replyRate || 0.25;

                // Add delay between emails
                if (i > 0) {
                    await delay(3000);
                }

                // Determine email type based on direction
                const isInitialEmail = pair.direction === 'POOL_TO_WARMUP' || pair.direction === 'WARMUP_TO_POOL';
                const isReply = pair.direction === 'WARMUP_REPLY';

                await this.sendEmailWithFallback(
                    senderConfig,
                    receiver,
                    safeReplyRate,
                    true,
                    isInitialEmail,
                    isReply
                );

                sendResults.push({ pair, success: true });
                successCount++;

                console.log(`     ✅ Email processed: ${pair.senderEmail} → ${pair.receiverEmail} [${pair.direction}]`);

            } catch (error) {
                console.error(`     ❌ Failed: ${pair.senderEmail} → ${pair.receiverEmail}: ${error.message}`);
                sendResults.push({ pair, success: false, error: error.message });
            }
        }

        console.log(`✅ ${successCount}/${pairs.length} warmup emails processed successfully`);
    }

    async sendEmailWithFallback(senderConfig, receiver, replyRate, isCoordinatedJob = true, isInitialEmail = true, isReply = false) {
        try {
            console.log(`📧 Sending email from ${senderConfig.email} to ${receiver.email}`);
            console.log(`🔧 Email Type: ${isReply ? 'REPLY' : isInitialEmail ? 'INITIATION' : 'UNKNOWN'}`);

            // Store original senderConfig for potential updates
            const originalSenderConfig = { ...senderConfig };

            await warmupSingleEmail(senderConfig, receiver, replyRate, isReply, isCoordinatedJob, isInitialEmail);

            // If senderConfig was updated with new tokens during the process, save them
            if (senderConfig.access_token !== originalSenderConfig.access_token) {
                await this.saveRefreshedTokens(senderConfig.email, {
                    access_token: senderConfig.access_token,
                    refresh_token: senderConfig.refresh_token,
                    token_expires_at: senderConfig.token_expires_at
                });
            }

        } catch (error) {
            if (error.message.includes('IMAP') || error.message.includes('getaddrinfo')) {
                console.log(`     ⚠️  IMAP issue but email was sent: ${error.message}`);
                return;
            }
            throw error;
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

        const senderConfig = buildSenderConfig(sender);
        const safeReplyRate = Math.min(0.25, replyRate || 0.25);

        await warmupSingleEmail(senderConfig, receiver, safeReplyRate, false, true);
        console.log(`✅ Warmup completed: ${senderEmail} -> ${receiverEmail}`);
    }

    async getWarmupAccount(senderType, email) {
        try {
            let senderModel;
            switch (senderType) {
                case 'google':
                    senderModel = GoogleUser;
                    break;
                case 'microsoft':
                    senderModel = MicrosoftUser;
                    break;
                case 'smtp':
                    senderModel = SmtpAccount;
                    break;
                default:
                    // Search all models
                    let sender = await GoogleUser.findOne({ where: { email, warmupStatus: 'active' } });
                    if (sender) return this.convertToPlainObject(sender);

                    sender = await MicrosoftUser.findOne({ where: { email, warmupStatus: 'active' } });
                    if (sender) return this.convertToPlainObject(sender);

                    sender = await SmtpAccount.findOne({ where: { email, warmupStatus: 'active' } });
                    if (sender) return this.convertToPlainObject(sender);

                    throw new Error(`Active warmup account not found: ${email}`);
            }

            const sender = await senderModel.findOne({ where: { email, warmupStatus: 'active' } });
            if (!sender) {
                console.error(`❌ Active warmup account not found: ${email} for type: ${senderType}`);
                return null;
            }

            return this.convertToPlainObject(sender);
        } catch (error) {
            console.error(`❌ Error fetching warmup account ${email} for type ${senderType}:`, error.message);
            return null;
        }
    }

    async getPoolAccount(email) {
        try {
            const poolAccount = await EmailPool.findOne({
                where: { email, isActive: true },
                raw: true
            });

            if (!poolAccount) {
                console.error(`❌ Active pool account not found: ${email}`);
                return null;
            }

            console.log(`📋 RAW DATABASE FIELDS for ${email}:`);
            console.log(`   access_token: ${poolAccount.access_token ? 'PRESENT' : 'MISSING'}`);
            console.log(`   refresh_token: ${poolAccount.refresh_token ? 'PRESENT' : 'MISSING'}`);
            console.log(`   token_expires_at: ${poolAccount.token_expires_at || 'NOT SET'}`);
            console.log(`   providerType: ${poolAccount.providerType}`);

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

                // **FIX: Convert field names to match buildSenderConfig expectations**
                poolAccount = this.normalizePoolAccountFields(poolAccount);

                console.log(`🔍 NORMALIZED Pool Account ${email}:`);
                console.log(`   access_token: ${poolAccount.access_token ? 'PRESENT' : 'MISSING'}`);
                console.log(`   refresh_token: ${poolAccount.refresh_token ? 'PRESENT' : 'MISSING'}`);
                console.log(`   token_expiry: ${poolAccount.token_expiry || 'NOT SET'}`);
                console.log(`   token_expires_at (original): ${poolAccount.token_expires_at || 'NOT SET'}`);

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
            // Convert from milliseconds timestamp to Date string
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
}

module.exports = { WarmupWorker }; 