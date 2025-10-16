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

  channel.consume(
    'warmup_jobs',
    async (msg) => {
      if (!msg) return;

      try {
        const job = JSON.parse(msg.content.toString());
        console.log('Processing warmup job:', job);

        const senderEmail = job.senderEmail || job.email;
        const senderType = job.senderType || job.type;
        const receiverEmail = job.receiverEmail;

        if (!senderEmail || !senderType || !receiverEmail) {
          console.error('❌ Missing required job fields:', job);
          return channel.ack(msg);
        }

        // Get the correct sender model
        const senderModel =
          senderType === 'google'
            ? GoogleUser
            : senderType === 'microsoft'
              ? MicrosoftUser
              : SmtpAccount;

        // Fetch sender
        const sender = await senderModel.findOne({ where: { email: senderEmail } });

        // Fetch receiver from any of the three tables
        const receiver =
          (await GoogleUser.findOne({ where: { email: receiverEmail } })) ||
          (await MicrosoftUser.findOne({ where: { email: receiverEmail } })) ||
          (await SmtpAccount.findOne({ where: { email: receiverEmail } }));

        if (!sender) {
          console.error(`❌ Sender not found: ${senderEmail}`);
          return channel.ack(msg);
        }

        if (!receiver) {
          console.error(`❌ Receiver not found: ${receiverEmail}`);
          return channel.ack(msg);
        }

        // Build config and run warmup
        const senderConfig = buildSenderConfig(sender, senderType);
        await warmupSingleEmail(senderConfig, receiver);

        console.log(`✅ Warmup email sent: ${senderEmail} -> ${receiverEmail}`);

        channel.ack(msg);
      } catch (err) {
        console.error('❌ Error running warmupSingleEmail:', err);
        // Retry the job in case of error
        channel.nack(msg, false, true);
      }
    },
    { noAck: false }
  );
}

module.exports = { consumeWarmupJobs };
