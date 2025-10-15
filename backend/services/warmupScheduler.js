// const getChannel = require('../rabbitConnection');
// const GoogleUser = require('../models/GoogleUser');
// const MicrosoftUser = require('../models/MicrosoftUser');
// const SmtpAccount = require('../models/smtpAccounts');
// const Account = require('../models/Account');
// const { Op } = require('sequelize');

// async function enqueueWarmupJobs() {
//   const channel = await getChannel();
//   await channel.assertQueue('warmup_jobs', { durable: true });

//   // Fetch all active senders from all tables
//   const googleUsers = await GoogleUser.findAll({ where: { warmupStatus: 'active' } });
//   const microsoftUsers = await MicrosoftUser.findAll({ where: { warmupStatus: 'active' } });
//   const smtpUsers = await SmtpAccount.findAll({ where: { warmupStatus: 'active' } });

//   const allSenders = [
//     ...googleUsers.map(u => ({ ...u.dataValues, type: 'google' })),
//     ...microsoftUsers.map(u => ({ ...u.dataValues, type: 'microsoft' })),
//     ...smtpUsers.map(u => ({ ...u.dataValues, type: 'custom' })),
//   ];

//   for (const sender of allSenders) {
//     const warmupDayCount = sender.warmupDayCount || 0;
//     const startEmailsPerDay = sender.startEmailsPerDay || 3;
//     const increaseEmailsPerDay = sender.increaseEmailsPerDay || 3;
//     const maxEmailsPerDay = sender.maxEmailsPerDay || 25;

//     let emailsToSend = startEmailsPerDay + increaseEmailsPerDay * warmupDayCount;
//     if (emailsToSend > maxEmailsPerDay) emailsToSend = maxEmailsPerDay;

//     // Find receivers (exclude sender)
//     const receivers = await Account.findAll({
//       where: {
//         email: { [Op.ne]: sender.email },
//         warmupStatus: 'active',
//       },
//       limit: emailsToSend,
//     });

//     for (const receiver of receivers) {
//       const jobPayload = {
//         senderEmail: sender.email,
//         senderType: sender.type,
//         receiverEmail: receiver.email,
//         warmupDayCount,
//         startEmailsPerDay,
//         increaseEmailsPerDay,
//         maxEmailsPerDay,
//         replyRate: sender.replyRate || 1.0,
//       };

//       channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(jobPayload)), { persistent: true });
//       console.log(`Enqueued warmup job for sender ${sender.email} -> receiver ${receiver.email}`);
//     }

//     // Increment warmupDayCount once per day per sender
//     sender.warmupDayCount = warmupDayCount + 1;
//     await sender.save();
//   }

//   // Schedule next enqueue in 24 hours (86400000 ms)
//   setTimeout(enqueueWarmupJobs, 86400000);
// }

// // Start first enqueue immediately when scheduler runs
// enqueueWarmupJobs().catch(console.error);

// module.exports = { enqueueWarmupJobs };




// services/warmupScheduler.js
const getChannel = require('../queues/rabbitConnection');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const Account = require('../models/Account');
const { getNextReceiver, computeReplyRate } = require('./warmupWorkflow');
const { buildSenderConfig } = require('../utils/senderConfig');
async function startWarmupScheduler() {
  try {
    const channel = await getChannel();
    await channel.assertQueue('warmup_jobs', { durable: true });

    const runCycle = async () => {
      try {
        // Fetch active accounts
        const googleUsers = await GoogleUser.findAll({ where: { warmupStatus: 'active' } });
        const microsoftUsers = await MicrosoftUser.findAll({ where: { warmupStatus: 'active' } });
        const smtpUsers = await SmtpAccount.findAll({ where: { warmupStatus: 'active' } });
        const totalReceivers = await Account.count();

        const totalSenders = googleUsers.length + microsoftUsers.length + smtpUsers.length;

        console.log(`[${new Date().toISOString()}] Scheduler: ${totalSenders} senders, ${totalReceivers} receivers`);

        if (totalSenders === 0 || totalReceivers === 0) {
          console.warn('⚠️No active senders or receivers available. Skipping warmup cycle okay no problem dude.');
        } else {
          // Instead of computing emails here, let warmupWorkflow handle distribution
          // Instead of: await warmupWorkflow();
          for (const sender of googleUsers) {
            await enqueueSenderJobs(channel, sender, 'google');
          }
          for (const sender of microsoftUsers) {
            await enqueueSenderJobs(channel, sender, 'microsoft');
          }
          for (const sender of smtpUsers) {
            await enqueueSenderJobs(channel, sender, 'custom');
          }

        }

        // Re-run periodically
        const nextRunDelay =
          process.env.NODE_ENV === 'production'
            ? 24 * 60 * 60 * 1000 // once per day
            : 5 * 60 * 1000;      // every 5 mins in dev

        setTimeout(runCycle, nextRunDelay);

      } catch (err) {
        console.error('❌ Error in scheduler cycle:', err);
        setTimeout(runCycle, 5 * 60 * 1000); // retry after 5 min
      }
    };

    runCycle();
  } catch (err) {
    console.error('❌ Scheduler initialization error:', err);
    setTimeout(startWarmupScheduler, 5 * 60 * 1000);
  }
}


// async function enqueueSenderJobs(channel, sender, senderType) {
//     const senderConfig = buildSenderConfig(sender, senderType);
//     const emailsToSend = senderConfig.startEmailsPerDay + senderConfig.increaseEmailsPerDay * (sender.warmupDayCount || 0);
//     senderConfig.replyRate = computeReplyRate(senderConfig);

//     for (let i = 0; i < emailsToSend; i++) {
//         const receiver = await getNextReceiver();
//         if (receiver.email === sender.email) continue; 

//         const jobPayload = {
//             senderEmail: sender.email,
//             senderType,
//             receiverEmail: receiver.email
//         };

//         channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(jobPayload)), { persistent: true });
//         console.log(`Enqueued warmup job: ${sender.email} -> ${receiver.email}`);
//     }

//     // Increment warmup day count for sender
//     sender.warmupDayCount = (sender.warmupDayCount || 0) + 1;
//     await sender.save();
// }

async function enqueueSenderJobs(channel, sender, senderType) {
  const senderConfig = buildSenderConfig(sender, senderType);
  const emailsToSend = senderConfig.startEmailsPerDay + senderConfig.increaseEmailsPerDay * (sender.warmupDayCount || 0);
  senderConfig.replyRate = computeReplyRate(senderConfig);

  const usedReceivers = new Set(); // Track receivers already assigned for this sender

  let attempts = 0;
  while (usedReceivers.size < emailsToSend && attempts < emailsToSend * 3) {
    // attempts limit prevents infinite loop if receivers < emailsToSend
    const receiver = await getNextReceiver();
    attempts++;

    if (receiver.email === sender.email || usedReceivers.has(receiver.email)) continue;

    usedReceivers.add(receiver.email);

    const jobPayload = {
      senderEmail: sender.email,
      senderType,
      receiverEmail: receiver.email
    };

    channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(jobPayload)), { persistent: true });
    console.log(`Enqueued warmup job: ${sender.email} -> ${receiver.email}`);
  }

  // Increment warmup day count for sender
  sender.warmupDayCount = (sender.warmupDayCount || 0) + 1;
  await sender.save();
}


module.exports = {
  startWarmupScheduler,
  enqueueSenderJobs

};
