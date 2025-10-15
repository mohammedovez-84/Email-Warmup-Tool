const { replyToEmail } = require('./imapHelper');
/**
* @param {Object} account 
* @param {Object} options 
* @param {number} replyRate
*/
async function maybeReply(account, options, replyRate) {
    const shouldReply = Math.random() <= replyRate;

    if (!shouldReply) {
        console.log(`⏭ Skipped reply to ${options.to}`);
        return { skipped: true };
    }

    const result = await replyToEmail(account, options);
    console.log(`Replied to ${options.to}`);
    return result;
}
module.exports = {
    maybeReply
};

