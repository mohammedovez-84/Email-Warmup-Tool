const { replyToEmail } = require('./imapHelper');
/**
* @param {Object} account 
* @param {Object} options 
* @param {number} replyRate
*/
const { sendEmail } = require('./emailSender');
const { buildSenderConfig } = require('../utils/senderConfig');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');

async function maybeReply(replier, emailData, replyRate = 0.25) {
    try {
        console.log(`🔄 Attempting reply from ${replier.email} with ${(replyRate * 100).toFixed(1)}% rate`);

        // Get the actual replier account with proper configuration
        const actualReplier = await getReplierAccount(replier.email);
        if (!actualReplier) {
            console.error(`❌ Replier account not found: ${replier.email}`);
            return { success: false, error: 'Replier account not found' };
        }

        // Build proper sender configuration for the replier
        const replierType = getReplierType(actualReplier);
        const replierConfig = buildSenderConfig(actualReplier, replierType);

        console.log(`📝 Sending reply via ${replierConfig.smtpHost}:${replierConfig.smtpPort}`);

        const replyResult = await sendEmail(replierConfig, emailData);

        if (replyResult.success) {
            console.log(`✅ Reply sent successfully: ${replier.email} -> ${emailData.to}`);
            return { success: true, messageId: replyResult.messageId };
        } else {
            console.error(`❌ Reply sending failed: ${replyResult.error}`);
            return { success: false, error: replyResult.error };
        }

    } catch (error) {
        console.error(`❌ Error in maybeReply:`, error.message);
        return { success: false, error: error.message };
    }
}

async function getReplierAccount(email) {
    try {
        // Try to find the replier in all account types
        let account = await GoogleUser.findOne({ where: { email } });
        if (account) return account;

        account = await MicrosoftUser.findOne({ where: { email } });
        if (account) return account;

        account = await SmtpAccount.findOne({ where: { email } });
        return account;

    } catch (error) {
        console.error(`❌ Error finding replier account ${email}:`, error);
        return null;
    }
}

function getReplierType(account) {
    if (account.roundRobinIndexGoogle !== undefined || account.provider === 'google') {
        return 'google';
    } else if (account.roundRobinIndexMicrosoft !== undefined || account.provider === 'microsoft') {
        return 'microsoft';
    } else if (account.roundRobinIndexCustom !== undefined || account.smtp_host) {
        return 'smtp';
    }
    return 'unknown';
}

module.exports = { maybeReply };
module.exports = {
    maybeReply
};

