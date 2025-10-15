
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

  channel.consume('warmup_jobs', async (msg) => {
    if (!msg) return;

    const job = JSON.parse(msg.content.toString());
    console.log('Processing warmup job:', job);

    const senderEmail = job.senderEmail || job.email;
    const senderType = job.senderType || job.type;
    const receiverEmail = job.receiverEmail;

    if (!senderEmail || !senderType || !receiverEmail) {
      console.error('Missing required job fields:', { senderEmail, senderType, receiverEmail });
      channel.ack(msg);
      return;
    }

    let senderModel;
    if (senderType === 'google') senderModel = GoogleUser;
    else if (senderType === 'microsoft') senderModel = MicrosoftUser;
    else senderModel = SmtpAccount;

    const sender = await senderModel.findOne({ where: { email: senderEmail } });
    const receiver = await Account.findOne({ where: { email: receiverEmail } });

    if (!sender || !receiver) {
      console.error('Sender or receiver not found:', senderEmail, receiverEmail);
      channel.ack(msg);
      return;
    }

    try {
      const senderConfig = buildSenderConfig(sender, senderType);

      // ✅ Pass io to warmupSingleEmail for live metrics updates
      await warmupSingleEmail(senderConfig, receiver);

    } catch (e) {
      console.error('Error running warmupSingleEmail:', e);
      channel.nack(msg, false, true);
    }

    channel.ack(msg);
  }, { noAck: false });
}

consumeWarmupJobs().catch(console.error);

module.exports = { consumeWarmupJobs };