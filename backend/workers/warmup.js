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
            console.log('🔨 Processing warmup job:', {
                sender: job.senderEmail,
                receiver: job.receiverEmail,
                replyRate: job.replyRate,
                warmupDay: job.warmupDay,
                scheduled: job.scheduled || false
            });

            const { senderEmail, senderType, receiverEmail, replyRate } = job;

            if (!senderEmail || !senderType || !receiverEmail) {
                console.error('❌ Missing required job fields');
                return channel.ack(msg);
            }

            // Get sender and receiver
            const sender = await this.getSender(senderType, senderEmail);
            const receiver = await this.findReceiver(receiverEmail);

            if (!sender) {
                console.error(`❌ Sender not found: ${senderEmail}`);
                return channel.ack(msg);
            }
            if (!receiver) {
                console.error(`❌ Receiver not found: ${receiverEmail}`);
                return channel.ack(msg);
            }

            // Validate and build sender configuration
            const senderConfig = buildSenderConfig(sender, senderType);

            // Ensure reply rate doesn't exceed 25%
            const safeReplyRate = Math.min(0.25, replyRate || 0.25);

            await warmupSingleEmail(senderConfig, receiver, safeReplyRate);
            console.log(`✅ Warmup completed: ${senderEmail} -> ${receiverEmail}`);

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

    async getSender(senderType, email) {
        const senderModel = this.getSenderModel(senderType);
        return await senderModel.findOne({ where: { email } });
    }

    async findReceiver(email) {
        return (await GoogleUser.findOne({ where: { email } })) ||
            (await MicrosoftUser.findOne({ where: { email } })) ||
            (await SmtpAccount.findOne({ where: { email } }));
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

// Start the intelligent worker
const worker = new IntelligentWarmupWorker();
worker.consumeWarmupJobs().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM. Shutting down gracefully...');
    process.exit(0);
});

module.exports = { IntelligentWarmupWorker };