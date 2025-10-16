// const { warmupWorkflow } = require('../services/warmupWorkflow');

// exports.startWarmupAll = async (req, res) => {
//     try {
//         const GoogleUser = require('../models/GoogleUser');
//         const SmtpAccount = require('../models/smtpAccounts');
//         const Account = require('../models/Account');

//         const googleUsers = await GoogleUser.findAll({ where: { warmupStatus: 'active' } });
//         const smtpAccounts = await SmtpAccount.findAll({ where: { is_active: true, warmupStatus: 'active' } });


//         // Normalize both sources to a common structure
//         const allSenders = [
//             ...googleUsers.map(user => ({
//                 name: user.name, // ✅ required for nodemailer `from`
//                 email: user.email,
//                 type: 'google',
//                 smtpHost: 'smtp.gmail.com',
//                 smtpPort: 465,
//                 smtpUser: user.email,
//                 smtpPass: user.app_password,
//                 smtpEncryption: 'SSL',
//                 imapHost: 'imap.gmail.com',
//                 imapPort: 993,
//                 imapUser: user.email,
//                 imapPass: user.app_password,
//                 imapEncryption: 'SSL'
//             })),
//             ...smtpAccounts.map(acc => ({
//                 name: acc.sender_name, // ✅ required for nodemailer `from`
//                 email: acc.email,
//                 type: 'custom',
//                 smtpHost: acc.smtp_host,
//                 smtpPort: acc.smtp_port,
//                 smtpUser: acc.email,
//                 smtpPass: acc.smtp_pass,
//                 smtpEncryption: acc.smtp_encryption,
//                 imapHost: acc.imap_host,
//                 imapPort: acc.imap_port,
//                 imapUser: acc.imap_user,
//                 imapPass: acc.imap_pass,
//                 imapEncryption: acc.imap_encryption
//             }))
//         ];

//         if (allSenders.length === 0)
//             return res.status(404).json({ error: 'No sender accounts found' });

//         const warmupAccounts = await Account.findAll();
//         if (warmupAccounts.length === 0)
//             return res.status(404).json({ error: 'No warmup accounts found' });

//         // Process all senders
//         for (const sender of allSenders) {
//             await warmupWorkflow(sender, warmupAccounts);
//         }

//         res.json({ message: `Warmup started for ${allSenders.length} sender(s)` });
//     } catch (err) {
//         console.error('Warmup error:', err);
//         res.status(500).json({ error: 'Failed to start warmup for all' });
//     }
// };


// const GoogleUser = require('../models/GoogleUser');
// const SmtpAccount = require('../models/smtpAccounts');
// const Account = require('../models/Account');

// exports.toggleWarmupStatus = async (req, res) => {
//     try {
//         const { emailAddress } = req.params;
//         const { status } = req.body;

//         console.log(`Toggle request for EMAIL: ${emailAddress} with status: ${status}`);

//         if (!['active', 'paused'].includes(status)) {
//             return res.status(400).json({ error: 'Invalid warmup status' });
//         }

//         // Try updating GoogleUser
//         let account = await GoogleUser.findOne({ where: { email: emailAddress } });
//         if (account) {
//             await GoogleUser.update(
//                 { warmupStatus: status }, // map status to DB field
//                 { where: { email: emailAddress } }
//             );

//             if (status === 'active') {
//                 const warmupAccounts = await Account.findAll();

//                 const sender = {
//                     name: account.name,
//                     email: account.email,
//                     type: 'google',
//                     smtpHost: 'smtp.gmail.com',
//                     smtpPort: 465,
//                     smtpUser: account.email,
//                     smtpPass: account.app_password,
//                     smtpEncryption: 'SSL',
//                     imapHost: 'imap.gmail.com',
//                     imapPort: 993,
//                     imapUser: account.email,
//                     imapPass: account.app_password,
//                     imapEncryption: 'SSL'
//                 };

//                 await warmupWorkflow(sender, warmupAccounts);
//             }

//             return res.json({ message: `Warmup ${status} for Google account (${emailAddress})` });
//         }

//         // Try updating SmtpAccount
//         account = await SmtpAccount.findOne({ where: { email: emailAddress } });
//         if (account) {
//             await SmtpAccount.update(
//                 { warmupStatus: status }, // map status to DB field
//                 { where: { email: emailAddress } }
//             );

//             if (status === 'active') {
//                 const warmupAccounts = await Account.findAll();

//                 const sender = {
//                     name: account.sender_name,
//                     email: account.email,
//                     type: 'custom',
//                     smtpHost: account.smtp_host,
//                     smtpPort: account.smtp_port,
//                     smtpUser: account.email,
//                     smtpPass: account.smtp_pass,
//                     smtpEncryption: account.smtp_encryption,
//                     imapHost: account.imap_host,
//                     imapPort: account.imap_port,
//                     imapUser: account.imap_user,
//                     imapPass: account.imap_pass,
//                     imapEncryption: account.imap_encryption
//                 };

//                 await warmupWorkflow(sender, warmupAccounts);
//             }

//             return res.json({ message: `Warmup ${status} for Custom SMTP account (${emailAddress})` });
//         }

//         return res.status(404).json({ error: 'Account not found' });
//     } catch (error) {
//         console.error('Toggle warmup error:', error);
//         res.status(500).json({ error: 'Failed to update warmup status' });
//     }
// };

// const GoogleUser = require('../models/GoogleUser');
// const SmtpAccount = require('../models/smtpAccounts');
// const MicrosoftUser = require('../models/MicrosoftUser');  
// const Account = require('../models/Account');
// const { warmupWorkflow } = require('../services/warmupWorkflow');

// exports.startWarmupAll = async (req, res) => {
//   try {
//     const googleUsers = await GoogleUser.findAll({ where: { warmupStatus: 'active' } });
//     const smtpAccounts = await SmtpAccount.findAll({ where: { is_active: true, warmupStatus: 'active' } });
//     const microsoftUsers = await MicrosoftUser.findAll({ where: { warmupStatus: 'active' } });

//     const allSenders = [
//       ...googleUsers.map(user => ({
//         name: user.name, // ✅ required for nodemailer `from`
//         email: user.email,
//         type: 'google',
//         smtpHost: 'smtp.gmail.com',
//         smtpPort: 465,
//         smtpUser: user.email,
//         smtpPass: user.app_password,
//         smtpEncryption: 'SSL',
//         imapHost: 'imap.gmail.com',
//         imapPort: 993,
//         imapUser: user.email,
//         imapPass: user.app_password,
//         imapEncryption: 'SSL'
//       })),
//       ...smtpAccounts.map(acc => ({
//         name: acc.sender_name, // ✅ required for nodemailer `from`
//         email: acc.email,
//         type: 'custom',
//         smtpHost: acc.smtp_host,
//         smtpPort: acc.smtp_port,
//         smtpUser: acc.email,
//         smtpPass: acc.smtp_pass,
//         smtpEncryption: acc.smtp_encryption,
//         imapHost: acc.imap_host,
//         imapPort: acc.imap_port,
//         imapUser: acc.imap_user,
//         imapPass: acc.imap_pass,
//         imapEncryption: acc.imap_encryption
//       })),
//       ...microsoftUsers.map(user => ({
//         name: user.name || user.email,
//         email: user.email,
//         type: 'microsoft',
//         smtpHost: 'smtp.office365.com',
//         smtpPort: 587,
//         smtpUser: user.email,
//         smtpPass: null,           // Use OAuth2 tokens instead of password
//         smtpEncryption: 'STARTTLS',
//         imapHost: 'outlook.office365.com',
//         imapPort: 993,
//         imapUser: user.email,
//         imapPass: null,           // Use OAuth2 tokens instead of password
//         imapEncryption: 'SSL',
//         refreshToken: user.refresh_token,
//         accessToken: user.access_token,
//         expiresAt: user.expires_at
//       }))
//     ];

//     if (allSenders.length === 0)
//       return res.status(404).json({ error: 'No sender accounts found' });

//     const warmupAccounts = await Account.findAll();
//     if (warmupAccounts.length === 0)
//       return res.status(404).json({ error: 'No warmup accounts found' });

//     for (const sender of allSenders) {
//       await warmupWorkflow(sender, warmupAccounts);
//     }

//     res.json({ message: `Warmup started for ${allSenders.length} sender(s)` });
//   } catch (err) {
//     console.error('Warmup error:', err);
//     res.status(500).json({ error: 'Failed to start warmup for all' });
//   }
// };

// exports.toggleWarmupStatus = async (req, res) => {
//   try {
//     const { emailAddress } = req.params;
//     const { status } = req.body;

//     console.log(`Toggle request for EMAIL: ${emailAddress} with status: ${status}`);

//     if (!['active', 'paused'].includes(status)) {
//       return res.status(400).json({ error: 'Invalid warmup status' });
//     }

//     let account = await GoogleUser.findOne({ where: { email: emailAddress } });
//     if (account) {
//       await GoogleUser.update(
//         { warmupStatus: status }, // map status to DB field
//         { where: { email: emailAddress } }
//       );

//       if (status === 'active') {
//         const warmupAccounts = await Account.findAll();

//         const sender = {
//           name: account.name,
//           email: account.email,
//           type: 'google',
//           smtpHost: 'smtp.gmail.com',
//           smtpPort: 465,
//           smtpUser: account.email,
//           smtpPass: account.app_password,
//           smtpEncryption: 'SSL',
//           imapHost: 'imap.gmail.com',
//           imapPort: 993,
//           imapUser: account.email,
//           imapPass: account.app_password,
//           imapEncryption: 'SSL'
//         };

//         await warmupWorkflow(sender, warmupAccounts);
//       }

//       return res.json({ message: `Warmup ${status} for Google account (${emailAddress})` });
//     }

//     // Try updating SmtpAccount
//     account = await SmtpAccount.findOne({ where: { email: emailAddress } });
//     if (account) {
//       await SmtpAccount.update(
//         { warmupStatus: status }, // map status to DB field
//         { where: { email: emailAddress } }
//       );

//       if (status === 'active') {
//         const warmupAccounts = await Account.findAll();

//         const sender = {
//           name: account.sender_name,
//           email: account.email,
//           type: 'custom',
//           smtpHost: account.smtp_host,
//           smtpPort: account.smtp_port,
//           smtpUser: account.email,
//           smtpPass: account.smtp_pass,
//           smtpEncryption: account.smtp_encryption,
//           imapHost: account.imap_host,
//           imapPort: account.imap_port,
//           imapUser: account.imap_user,
//           imapPass: account.imap_pass,
//           imapEncryption: account.imap_encryption
//         };

//         await warmupWorkflow(sender, warmupAccounts);
//       }

//       return res.json({ message: `Warmup ${status} for Custom SMTP account (${emailAddress})` });
//     }

//     // Microsoft user toggle
//     account = await MicrosoftUser.findOne({ where: { email: emailAddress } });
//     if (account) {
//       await MicrosoftUser.update({ warmupStatus: status }, { where: { email: emailAddress } });
//       if (status === 'active') {
//         const warmupAccounts = await Account.findAll();
//         const sender = {
//           name: account.name || account.email,
//           email: account.email,
//           type: 'microsoft',
//           smtpHost: 'smtp.office365.com',
//           smtpPort: 587,
//           smtpUser: account.email,
//           smtpPass: null,
//           smtpEncryption: 'STARTTLS',
//           imapHost: 'outlook.office365.com',
//           imapPort: 993,
//           imapUser: account.email,
//           imapPass: null,
//           imapEncryption: 'SSL',
//           refreshToken: account.refresh_token,
//           accessToken: account.access_token,
//           expiresAt: account.expires_at
//         };
//         await warmupWorkflow(sender, warmupAccounts);
//       }
//       return res.json({ message: `Warmup ${status} for Microsoft account (${emailAddress})` });
//     }

//     return res.status(404).json({ error: 'Account not found' });
//   } catch (error) {
//     console.error('Toggle warmup error:', error);
//     res.status(500).json({ error: 'Failed to update warmup status' });
//   }
// };




// const GoogleUser = require('../models/GoogleUser');
// const SmtpAccount = require('../models/smtpAccounts');
// const MicrosoftUser = require('../models/MicrosoftUser');
// const Account = require('../models/Account');
// const { warmupWorkflow } = require('../services/warmupWorkflow');
// const amqp = require('amqplib');

// async function sendToQueue(queueName, data) {
//   const conn = await amqp.connect('amqp://localhost');
//   const channel = await conn.createChannel();
//   await channel.assertQueue(queueName, { durable: true });
//   channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), { persistent: true });
//   setTimeout(() => { channel.close(); conn.close(); }, 500);
// }

// exports.startWarmupAll = async (req, res) => {
//   try {
//     const googleUsers = await GoogleUser.findAll({ where: { warmupStatus: 'active' } });
//     const smtpAccounts = await SmtpAccount.findAll({ where: { is_active: true, warmupStatus: 'active' } });
//     const microsoftUsers = await MicrosoftUser.findAll({ where: { warmupStatus: 'active' } });

//     const allSenders = [
//       ...googleUsers.map(user => ({
//         name: user.name,
//         email: user.email,
//         type: 'google',
//         smtpHost: 'smtp.gmail.com',
//         smtpPort: 465,
//         smtpUser: user.email,
//         smtpPass: user.app_password,
//         smtpEncryption: 'SSL',
//         imapHost: 'imap.gmail.com',
//         imapPort: 993,
//         imapUser: user.email,
//         imapPass: user.app_password,
//         imapEncryption: 'SSL',
//         startEmailsPerDay: user.startEmailsPerDay || 3,
//         increaseEmailsPerDay: user.increaseEmailsPerDay || 3,
//         maxEmailsPerDay: user.maxEmailsPerDay || 25,
//         replyRate: user.replyRate || 1.0,
//         warmupDayCount: user.warmupDayCount || 0
//       })),
//       ...smtpAccounts.map(acc => ({
//         name: acc.sender_name,
//         email: acc.email,
//         type: 'custom',
//         smtpHost: acc.smtp_host,
//         smtpPort: acc.smtp_port,
//         smtpUser: acc.email,
//         smtpPass: acc.smtp_pass,
//         smtpEncryption: acc.smtp_encryption,
//         imapHost: acc.imap_host,
//         imapPort: acc.imap_port,
//         imapUser: acc.imap_user,
//         imapPass: acc.imap_pass,
//         imapEncryption: acc.imap_encryption,
//         startEmailsPerDay: acc.startEmailsPerDay || 3,
//         increaseEmailsPerDay: acc.increaseEmailsPerDay || 3,
//         maxEmailsPerDay: acc.maxEmailsPerDay || 25,
//         replyRate: acc.replyRate || 1.0,
//         warmupDayCount: acc.warmupDayCount || 0
//       })),
//       ...microsoftUsers.map(user => ({
//         name: user.name || user.email,
//         email: user.email,
//         type: 'microsoft',
//         smtpHost: 'smtp.office365.com',
//         smtpPort: 587,
//         smtpUser: user.email,
//         smtpPass: null,
//         smtpEncryption: 'STARTTLS',
//         imapHost: 'outlook.office365.com',
//         imapPort: 993,
//         imapUser: user.email,
//         imapPass: null,
//         imapEncryption: 'SSL',
//         refreshToken: user.refresh_token,
//         accessToken: user.access_token,
//         expiresAt: user.expires_at,
//         startEmailsPerDay: user.startEmailsPerDay || 3,
//         increaseEmailsPerDay: user.increaseEmailsPerDay || 3,
//         maxEmailsPerDay: user.maxEmailsPerDay || 25,
//         replyRate: user.replyRate || 1.0,
//         warmupDayCount: user.warmupDayCount || 0
//       }))
//     ];

//     if (allSenders.length === 0)
//       return res.status(404).json({ error: 'No sender accounts found' });

//     const warmupAccounts = await Account.findAll();
//     if (warmupAccounts.length === 0)
//       return res.status(404).json({ error: 'No warmup accounts found' });

//     for (const sender of allSenders) {
//       await warmupWorkflow(sender, warmupAccounts);
//       // Also send to queue for background processing
//       await sendToQueue('warmup_jobs', {
//         email: sender.email,
//         type: sender.type,
//         startEmailsPerDay: sender.startEmailsPerDay,
//         increaseEmailsPerDay: sender.increaseEmailsPerDay,
//         maxEmailsPerDay: sender.maxEmailsPerDay,
//         replyRate: sender.replyRate,
//         warmupDayCount: sender.warmupDayCount
//       });
//     }

//     res.json({ message: `Warmup started for ${allSenders.length} sender(s)` });
//   } catch (err) {
//     console.error('Warmup error:', err);
//     res.status(500).json({ error: 'Failed to start warmup for all' });
//   }
// };

// 



// controllers/warmupController.js
const GoogleUser = require('../models/GoogleUser');
const SmtpAccount = require('../models/smtpAccounts');
const MicrosoftUser = require('../models/MicrosoftUser');
const { enqueueSenderJobs } = require('../services/warmupScheduler');
const getChannel = require('../queues/rabbitConnection');

exports.toggleWarmupStatus = async (req, res) => {
  try {
    const { emailAddress } = req.params;
    const { status } = req.body;

    const {
      warmupDayCount,
      startEmailsPerDay,
      increaseEmailsPerDay,
      maxEmailsPerDay,
      replyRate,
    } = req.body;

    console.log(`Toggle request for EMAIL: ${emailAddress} with status: ${status}`);

    if (!['active', 'paused'].includes(status)) {
      return res.status(400).json({ error: 'Invalid warmup status' });
    }

    // Find sender in any table
    let sender = await GoogleUser.findOne({ where: { email: emailAddress } });
    let senderType = 'google';

    if (!sender) {
      sender = await MicrosoftUser.findOne({ where: { email: emailAddress } });
      senderType = 'microsoft';
    }
    if (!sender) {
      sender = await SmtpAccount.findOne({ where: { email: emailAddress } });
      senderType = 'custom';
    }
    if (!sender) return res.status(404).json({ error: 'Sender account not found' });

    // Update warmup status
    await sender.update({ warmupStatus: status });
    if (status === 'active') {
      try {
        const channel = await getChannel();
        await channel.assertQueue('warmup_jobs', { durable: true });
        await enqueueSenderJobs(channel, sender, senderType);
        console.log(`✅ Warmup jobs enqueued for ${senderType} sender ${emailAddress}`);
      } catch (err) {
        console.error('❌ Error enqueuing warmup jobs after activation:', err);
      }
    }


    // Update manual warmup config if provided
    const manualConfig = {};
    if (typeof warmupDayCount !== 'undefined') manualConfig.warmupDayCount = warmupDayCount;
    if (typeof startEmailsPerDay !== 'undefined') manualConfig.startEmailsPerDay = startEmailsPerDay;
    if (typeof increaseEmailsPerDay !== 'undefined') manualConfig.increaseEmailsPerDay = increaseEmailsPerDay;
    if (typeof maxEmailsPerDay !== 'undefined') manualConfig.maxEmailsPerDay = maxEmailsPerDay;
    if (typeof replyRate !== 'undefined') manualConfig.replyRate = replyRate;

    if (Object.keys(manualConfig).length > 0) {
      await sender.update(manualConfig);
      await sender.reload();
    }


    return res.json({
      message: `Warmup ${status} for ${senderType} account (${emailAddress})`,
      updatedConfig: sender.toJSON()
    });
  } catch (error) {
    console.error('Toggle warmup error:', error);
    res.status(500).json({ error: 'Failed to update warmup status' });
  }
};
