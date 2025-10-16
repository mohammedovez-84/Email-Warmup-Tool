// workers/warmupConsumer.js
require('dotenv').config({ path: '../.env' });

const getChannel = require('../queues/rabbitConnection');
const { warmupSingleEmail } = require('../services/warmupWorkflow');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const Account = require('../models/Account');
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
          console.error('Missing required job fields:', job);
          return channel.ack(msg);
        }

        const senderModel =
          senderType === 'google'
            ? GoogleUser
            : senderType === 'microsoft'
              ? MicrosoftUser
              : SmtpAccount;

        const sender = await senderModel.findOne({ where: { email: senderEmail } });
        const receiver = await Account.findOne({ where: { email: receiverEmail } });

        if (!sender || !receiver) {
          console.error('Sender or receiver not found:', { senderEmail, receiverEmail });
          return channel.ack(msg);
        }

        const senderConfig = buildSenderConfig(sender, senderType);
        await warmupSingleEmail(senderConfig, receiver);

        channel.ack(msg);
      } catch (e) {
        console.error('❌ Error running warmupSingleEmail:', e);
        channel.nack(msg, false, true);
      }
    },
    { noAck: false }
  );
}

module.exports = { consumeWarmupJobs };
