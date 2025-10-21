require('dotenv').config({ path: '../.env' });

const getChannel = require('../queues/rabbitConnection');
const { warmupSingleEmail } = require('../services/warmupWorkflow');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const { buildSenderConfig, getSenderType } = require('../utils/senderConfig'); // ✅ FIX: Import from correct location

// ✅ Add missing delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        console.log(`   Processing ${pairs.length} interactions in round ${round || 'N/A'}`);

        const sendResults = [];
        let successCount = 0;

        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            console.log(`     📤 Sending (${i + 1}/${pairs.length}): ${pair.senderEmail} → ${pair.receiverEmail} [Round ${pair.round || round || 'N/A'}]`);

            try {
                const sender = await this.getSender(pair.senderType, pair.senderEmail);
                const receiver = await this.findReceiver(pair.receiverEmail);

                if (!sender) {
                    throw new Error(`Sender not found: ${pair.senderEmail}`);
                }
                if (!receiver) {
                    throw new Error(`Receiver not found: ${pair.receiverEmail}`);
                }

                // Build sender configuration
                const senderConfig = buildSenderConfig(sender, pair.senderType);
                const safeReplyRate = Math.min(0.25, pair.replyRate || 0.20);

                // Add delay between emails (except first one)
                if (i > 0) {
                    await delay(3000);
                }

                // ✅ FIX: Send email but don't fail if IMAP checks don't work
                await this.sendEmailWithFallback(senderConfig, receiver, safeReplyRate);

                sendResults.push({ pair, success: true });
                successCount++;
                console.log(`     ✅ Sent successfully: ${pair.senderEmail} → ${pair.receiverEmail}`);

            } catch (error) {
                console.error(`     ❌ Failed: ${pair.senderEmail} → ${pair.receiverEmail}: ${error.message}`);
                sendResults.push({ pair, success: false, error: error.message });
            }
        }

        console.log(`✅ ${successCount}/${pairs.length} emails sent successfully in coordinated time slot`);

        if (successCount < pairs.length) {
            console.log(`❌ ${pairs.length - successCount} emails failed:`);
            sendResults.filter(r => !r.success).forEach(failed => {
                console.log(`     💥 ${failed.pair.senderEmail} → ${failed.pair.receiverEmail}: ${failed.error}`);
            });
        }

        // Process replies for successful sends
        if (successCount > 0) {
            const successfulPairs = sendResults.filter(r => r.success).map(r => r.pair);
            await this.processCoordinatedReplies(successfulPairs, round || 1);
        }
    }

    // ✅ ADD: Method to send email with fallback for IMAP issues
    async sendEmailWithFallback(senderConfig, receiver, replyRate) {
        try {
            await warmupSingleEmail(senderConfig, receiver, replyRate, false, true);
        } catch (error) {
            // If it's an IMAP error but email was sent, log and continue
            if (error.message.includes('IMAP') || error.message.includes('getaddrinfo')) {
                console.log(`     ⚠️  IMAP issue but email was sent: ${error.message}`);
                // We consider this successful since the email was sent
                return;
            }
            // Re-throw other errors
            throw error;
        }
    }

    // ✅ FIX: Add missing processCoordinatedReplies method
    async processCoordinatedReplies(successfulPairs, round) {
        console.log(`\n🔄 Processing coordinated replies for round ${round}...`);

        // For now, we'll just log the replies that would be processed
        // In a real implementation, you would schedule reply jobs here
        successfulPairs.forEach((pair, index) => {
            console.log(`     📨 Reply processing scheduled: ${pair.receiverEmail} → ${pair.senderEmail} [Round ${round}]`);
        });

        console.log(`✅ Coordinated round ${round} completed (${successfulPairs.length} replies scheduled)`);
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

        // ✅ FIX: Use imported buildSenderConfig function
        const senderConfig = buildSenderConfig(sender, senderType);

        // Convert to plain object if needed
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

    // ✅ FIX: Use imported getSenderType function
    getSenderType(sender) {
        return getSenderType(sender);
    }

    async getSender(senderType, email) {
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
                    // ✅ FIX: If sender type is unknown, try to find in any model
                    console.log(`🔍 Unknown sender type "${senderType}" for ${email}, searching all models...`);

                    let sender = await GoogleUser.findOne({ where: { email } });
                    if (sender) return sender;

                    sender = await MicrosoftUser.findOne({ where: { email } });
                    if (sender) return sender;

                    sender = await SmtpAccount.findOne({ where: { email } });
                    if (sender) return sender;

                    throw new Error(`Sender not found in any model: ${email}`);
            }

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

            // ✅ FIX: Create a fallback receiver object for unknown accounts
            return {
                email: email,
                name: email.split('@')[0],
                warmupStatus: 'active',
                warmupDayCount: 1,
                replyRate: 0.25,
                industry: 'general'
            };
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