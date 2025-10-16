const getChannel = require('../queues/rabbitConnection');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const { getNextReceiver, computeReplyRate } = require('./warmupWorkflow');
const { buildSenderConfig } = require('../utils/senderConfig');

async function startWarmupScheduler() {
  try {
    const channel = await getChannel();
    await channel.assertQueue('warmup_jobs', { durable: true });

    const runCycle = async () => {
      try {
        // Senders = warmupStatus 'false' (paused)
        const googleSenders = await GoogleUser.findAll({ where: { warmupStatus: 'paused' } });
        const microsoftSenders = await MicrosoftUser.findAll({ where: { warmupStatus: 'paused' } });
        const smtpSenders = await SmtpAccount.findAll({ where: { warmupStatus: 'paused' } });

        const totalSenders = googleSenders.length + microsoftSenders.length + smtpSenders.length;
        console.log(`[${new Date().toISOString()}] Scheduler: ${totalSenders} active senders`);

        if (totalSenders === 0) {
          console.warn('⚠️ No senders available. Skipping warmup cycle.');
        } else {
          // Enqueue jobs for each sender
          for (const sender of googleSenders) await enqueueSenderJobs(channel, sender, 'google');
          for (const sender of microsoftSenders) await enqueueSenderJobs(channel, sender, 'microsoft');
          for (const sender of smtpSenders) await enqueueSenderJobs(channel, sender, 'custom');
        }

        const nextRunDelay =
          process.env.NODE_ENV === 'production'
            ? 24 * 60 * 60 * 1000 // once per day
            : 5 * 60 * 1000;      // every 5 mins in dev

        setTimeout(runCycle, nextRunDelay);

      } catch (err) {
        console.error('❌ Error in scheduler cycle:', err);
        setTimeout(runCycle, 5 * 60 * 1000);
      }
    };

    runCycle();

  } catch (err) {
    console.error('❌ Scheduler initialization error:', err);
    setTimeout(startWarmupScheduler, 5 * 60 * 1000);
  }
}

async function enqueueSenderJobs(channel, sender, senderType) {
  const senderConfig = buildSenderConfig(sender, senderType);
  const emailsToSend =
    senderConfig.startEmailsPerDay + senderConfig.increaseEmailsPerDay * (sender.warmupDayCount || 0);
  senderConfig.replyRate = computeReplyRate(senderConfig);

  const usedReceivers = new Set();
  let attempts = 0;

  while (usedReceivers.size < emailsToSend && attempts < emailsToSend * 3) {
    attempts++;

    let receiver;
    try {
      receiver = await getNextReceiver(sender.email); // only picks warmupStatus='active' accounts
    } catch (err) {
      console.warn(`⚠️ No receiver found for ${sender.email}, stopping further jobs.`);
      break;
    }

    if (usedReceivers.has(receiver.email)) continue;
    usedReceivers.add(receiver.email);

    const jobPayload = {
      senderEmail: sender.email,
      senderType,
      receiverEmail: receiver.email
    };

    channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(jobPayload)), { persistent: true });
    console.log(`Enqueued warmup job: ${sender.email} -> ${receiver.email}`);
  }

  // Increment warmup day count
  sender.warmupDayCount = (sender.warmupDayCount || 0) + 1;
  await sender.save();
}

module.exports = {
  startWarmupScheduler,
  enqueueSenderJobs
};
