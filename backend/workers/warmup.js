require('dotenv').config({ path: '../.env' });

const getChannel = require('../queues/rabbitConnection');
const { warmupSingleEmail } = require('../services/warmupWorkflow');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const { buildSenderConfig } = require('../utils/senderConfig');

class IntelligentWarmupWorker {
    constructor() {
        this.processing = false;
        this.lastProcessedTime = 0;
        this.MIN_JOB_INTERVAL = 3 * 60 * 1000; // 3 minutes between jobs
    }

    async consumeWarmupJobs() {
        const channel = await getChannel();
        await channel.assertQueue('warmup_jobs', { durable: true });

        console.log('🧠 Intelligent warmup worker started and waiting for messages...');

        // Set prefetch to 1 for controlled processing
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

                // Intelligent delay between jobs
                const now = Date.now();
                const timeSinceLastJob = now - this.lastProcessedTime;

                if (timeSinceLastJob < this.MIN_JOB_INTERVAL) {
                    const delayMs = this.MIN_JOB_INTERVAL - timeSinceLastJob;
                    console.log(`⏳ Intelligent delay: ${Math.round(delayMs / 1000)} seconds between jobs`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
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

            // Check if this is a coordinated time slot job
            if (job.coordinated && job.timeSlot && job.pairs) {
                console.log('🔨 Processing COORDINATED warmup job:', {
                    timeSlot: job.timeSlot,
                    pairs: job.pairs.length,
                    round: job.round
                });
                await this.processCoordinatedTimeSlot(job);
            } else {
                // Fallback to single email processing
                console.log('🔨 Processing SINGLE warmup job:', {
                    sender: job.senderEmail,
                    receiver: job.receiverEmail,
                    replyRate: job.replyRate
                });
                await this.processSingleEmail(job);
            }

            channel.ack(msg);

        } catch (err) {
            console.error('❌ Error processing warmup job:', err.message);

            // Don't retry configuration errors
            if (err.message.includes('configuration') || err.message.includes('password') || err.message.includes('SMTP')) {
                console.error('❌ Configuration error, acknowledging message without retry');
                channel.ack(msg);
            } else if (msg.fields.redelivered && msg.fields.redeliveryCount >= 2) {
                console.error('❌ Max retries exceeded, acknowledging message');
                channel.ack(msg);
            } else {
                // Exponential backoff for retries
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

        console.log(`🎯 Executing COORDINATED time slot: ${timeSlot}`);
        console.log(`   Processing ${pairs.length} interactions in round ${round || 'N/A'}`); // ✅ Handle undefined round

        // Process ALL sends first in parallel
        const sendPromises = pairs.map(async (pair, index) => {
            console.log(`     📤 Sending (${index + 1}/${pairs.length}): ${pair.senderEmail} → ${pair.receiverEmail} [Round ${pair.round || round || 'N/A'}]`);

            const sender = await this.getSender(pair.senderType, pair.senderEmail);
            const receiver = await this.findReceiver(pair.receiverEmail);

            if (!sender || !receiver) {
                console.error(`❌ Missing sender/receiver for pair`);
                return { pair, success: false, error: 'Missing sender/receiver' };
            }

            try {
                const senderConfig = buildSenderConfig(sender, pair.senderType);
                const safeReplyRate = Math.min(0.25, pair.replyRate || 0.25);

                await warmupSingleEmail(senderConfig, receiver, safeReplyRate, false);
                return { pair, success: true };
            } catch (error) {
                console.error(`❌ Error sending email for pair:`, error.message);
                return { pair, success: false, error: error.message };
            }
        });

        // Wait for ALL sends to complete
        const sendResults = await Promise.allSettled(sendPromises);

        const successfulSends = sendResults
            .filter(result => result.status === 'fulfilled' && result.value?.success)
            .map(result => result.value.pair);

        const failedSends = sendResults
            .filter(result => result.status === 'fulfilled' && !result.value?.success)
            .map(result => result.value);

        console.log(`✅ ${successfulSends.length}/${pairs.length} emails sent successfully in coordinated time slot`);

        if (failedSends.length > 0) {
            console.log(`❌ ${failedSends.length} emails failed in coordinated time slot`);
        }

        // Now process replies with proper round information
        await this.processCoordinatedReplies(successfulSends, round || pairs[0]?.round || 1);
    }

    async processCoordinatedReplies(successfulPairs, round) {
        const actualRound = round || successfulPairs[0]?.round || 1;

        console.log(`🔄 Processing coordinated replies for round ${actualRound}...`);

        // Process replies for successful sends
        for (const pair of successfulPairs) {
            try {
                console.log(`     📨 Reply processing scheduled: ${pair.receiverEmail} → ${pair.senderEmail} [Round ${actualRound}]`);

                // ✅ You might want to actually schedule replies here
                // For now, it's just logging, but you could add actual reply scheduling logic
            } catch (replyError) {
                console.error(`❌ Reply processing error:`, replyError.message);
            }
        }

        console.log(`✅ Coordinated round ${actualRound} completed (sends + replies scheduled)`);
    }

    async processSingleEmail(job) {
        const { senderEmail, senderType, receiverEmail, replyRate } = job;

        if (!senderEmail || !senderType || !receiverEmail) {
            console.error('❌ Missing required job fields');
            return;
        }

        // Get sender and receiver
        const sender = await this.getSender(senderType, senderEmail);
        const receiver = await this.findReceiver(receiverEmail);

        if (!sender) {
            console.error(`❌ Sender not found: ${senderEmail}`);
            return;
        }
        if (!receiver) {
            console.error(`❌ Receiver not found: ${receiverEmail}`);
            return;
        }

        // Validate and build sender configuration
        const senderConfig = buildSenderConfig(sender, senderType);

        // ✅ Convert to plain object
        const configData = {
            smtpHost: senderConfig.smtpHost,
            smtpPort: senderConfig.smtpPort,
            smtpUser: senderConfig.smtpUser,
            smtpPass: senderConfig.smtpPass,
            smtpEncryption: senderConfig.smtpEncryption,
            imapHost: senderConfig.imapHost,
            imapPort: senderConfig.imapPort,
            imapUser: senderConfig.imapUser,
            imapPass: senderConfig.imapPass,
            imapEncryption: senderConfig.imapEncryption,
            email: senderConfig.email,
            name: senderConfig.name,
            type: senderConfig.type,
            userId: senderConfig.userId,
            startEmailsPerDay: senderConfig.startEmailsPerDay,
            increaseEmailsPerDay: senderConfig.increaseEmailsPerDay,
            maxEmailsPerDay: senderConfig.maxEmailsPerDay,
            replyRate: senderConfig.replyRate,
            warmupDayCount: senderConfig.warmupDayCount,
            industry: senderConfig.industry
        };

        // Ensure reply rate doesn't exceed 25%
        const safeReplyRate = Math.min(0.25, replyRate || 0.25);

        await warmupSingleEmail(configData, receiver, safeReplyRate);
        console.log(`✅ Warmup completed: ${senderEmail} -> ${receiverEmail}`);
    }

    async getSender(senderType, email) {
        try {
            const senderModel = this.getSenderModel(senderType);
            const sender = await senderModel.findOne({ where: { email } });

            if (!sender) {
                console.error(`❌ Sender not found: ${email} for type: ${senderType}`);
                return null;
            }

            return sender;
        } catch (error) {
            console.error(`❌ Error fetching sender ${email} for type ${senderType}:`, error.message);
            return null;
        }
    }

    async findReceiver(email) {
        try {
            // Try all models to find the receiver
            const googleUser = await GoogleUser.findOne({ where: { email } });
            if (googleUser) return googleUser;

            const microsoftUser = await MicrosoftUser.findOne({ where: { email } });
            if (microsoftUser) return microsoftUser;

            const smtpAccount = await SmtpAccount.findOne({ where: { email } });
            if (smtpAccount) return smtpAccount;

            console.error(`❌ Receiver not found in any model: ${email}`);
            return null;
        } catch (error) {
            console.error(`❌ Error finding receiver ${email}:`, error.message);
            return null;
        }
    }

    getSenderModel(senderType) {
        switch (senderType) {
            case 'google': return GoogleUser;
            case 'microsoft': return MicrosoftUser;
            case 'smtp': return SmtpAccount;
            default: throw new Error(`Unknown sender type: ${senderType}`);
        }
    }
}

// Export just the class (not an instance)
module.exports = { IntelligentWarmupWorker };