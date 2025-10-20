require('dotenv').config({ path: '../.env' });

const getChannel = require('../queues/rabbitConnection');
const { warmupSingleEmail } = require('../services/warmupWorkflow');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const { buildSenderConfig } = require('../utils/senderConfig');

async function consumeWarmupJobs() {
  const channel = await getChannel();
  await channel.assertQueue('warmup_jobs', { durable: true });

  console.log('📬 Warmup consumer started and waiting for messages...');

  // Set prefetch to 1 to process one job at a time
  channel.prefetch(1);

  let lastProcessedTime = 0;
  const MIN_TIME_BETWEEN_JOBS = 2 * 60 * 1000; // 2 minutes between jobs

  channel.consume(
    'warmup_jobs',
    async (msg) => {
      if (!msg) return;

      // Add delay between job processing
      const now = Date.now();
      const timeSinceLastJob = now - lastProcessedTime;

      if (timeSinceLastJob < MIN_TIME_BETWEEN_JOBS) {
        const delayMs = MIN_TIME_BETWEEN_JOBS - timeSinceLastJob;
        console.log(`⏳ Delaying next job by ${delayMs / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      let job = null;
      try {
        job = JSON.parse(msg.content.toString());
        console.log('🔨 Processing warmup job:', {
          sender: job.senderEmail,
          receiver: job.receiverEmail,
          replyRate: job.replyRate,
          warmupDay: job.warmupDay
        });

        const senderEmail = job.senderEmail;
        const senderType = job.senderType;
        const receiverEmail = job.receiverEmail;
        const replyRate = job.replyRate || 0.25;

        if (!senderEmail || !senderType || !receiverEmail) {
          console.error('❌ Missing required job fields:', job);
          return channel.ack(msg);
        }

        // Get the correct sender model
        const senderModel = getSenderModel(senderType);

        // Fetch sender
        const sender = await senderModel.findOne({ where: { email: senderEmail } });
        if (!sender) {
          console.error(`❌ Sender not found: ${senderEmail}`);
          return channel.ack(msg);
        }

        // Fetch receiver from any of the three tables
        const receiver = await findReceiver(receiverEmail);
        if (!receiver) {
          console.error(`❌ Receiver not found: ${receiverEmail}`);
          return channel.ack(msg);
        }

        // Build config and run warmup
        const senderConfig = buildSenderConfig(sender, senderType);
        await warmupSingleEmail(senderConfig, receiver, replyRate);

        console.log(`✅ Warmup email completed: ${senderEmail} -> ${receiverEmail}`);

        lastProcessedTime = Date.now();
        channel.ack(msg);

      } catch (err) {
        console.error('❌ Error running warmupSingleEmail:', err.message);

        lastProcessedTime = Date.now();

        // Don't retry indefinitely - ack after 2 retries
        if (msg.fields.redelivered && msg.fields.redeliveryCount >= 2) {
          console.error('❌ Max retries exceeded, acknowledging message');
          channel.ack(msg);
        } else {
          // Requeue with longer delay
          setTimeout(() => {
            channel.nack(msg, false, true);
          }, 5 * 60 * 1000); // 5 minute delay before retry
        }
      }
    },
    { noAck: false }
  );
}

function getSenderModel(senderType) {
  switch (senderType) {
    case 'google':
      return GoogleUser;
    case 'microsoft':
      return MicrosoftUser;
    case 'smtp':
      return SmtpAccount;
    default:
      throw new Error(`Unknown sender type: ${senderType}`);
  }
}

async function findReceiver(email) {
  const receiver =
    (await GoogleUser.findOne({ where: { email } })) ||
    (await MicrosoftUser.findOne({ where: { email } })) ||
    (await SmtpAccount.findOne({ where: { email } }));

  return receiver;
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

module.exports = { consumeWarmupJobs };