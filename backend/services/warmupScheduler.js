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
        // --- FETCH SENDERS ---
        const googleSenders = await GoogleUser.findAll({ where: { warmupStatus: 'paused' } });
        const smtpSenders = await SmtpAccount.findAll({ where: { warmupStatus: 'paused' } });
        const microsoftSenders = await MicrosoftUser.findAll({ where: { warmupStatus: 'paused' } });

        console.log(`[${new Date().toISOString()}] Scheduler: ${googleSenders.length + smtpSenders.length} Google/SMTP, ${microsoftSenders.length} Microsoft senders ready`);

        let totalJobsEnqueued = 0;

        // --- GOOGLE + SMTP SENDERS ---
        const googleSmtpSenders = [...googleSenders, ...smtpSenders];
        for (const sender of googleSmtpSenders) {
          totalJobsEnqueued += await enqueueSenderJobs(channel, sender, 'google');
        }

        // --- MICROSOFT SENDERS ---
        for (const sender of microsoftSenders) {
          totalJobsEnqueued += await enqueueSenderJobs(channel, sender, 'microsoft');
        }

        console.log(`[${new Date().toISOString()}] Total warmup jobs enqueued: ${totalJobsEnqueued}`);

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
  let jobsCount = 0;

  while (usedReceivers.size < emailsToSend && attempts < emailsToSend * 3) {
    attempts++;

    let receiver;
    try {
      // --- Get receiver of the same category ---
      receiver = await getNextReceiver(sender);
    } catch (err) {
      console.warn(`⚠️ No active receiver found for ${sender.email}, stopping further jobs.`);
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
    jobsCount++;
    console.log(`Enqueued warmup job: ${sender.email} -> ${receiver.email}`);
  }

  sender.warmupDayCount = (sender.warmupDayCount || 0) + 1;
  sender.emailsSentToday = jobsCount; // Add this field to your model
  await sender.save();

  return jobsCount;
}

module.exports = {
  startWarmupScheduler,
  enqueueSenderJobs
};
