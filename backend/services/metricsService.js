
const SenderReceiverMetrics = require('../models/SenderReceiverMetrics');
const { getPerSenderTotals, getTotalSenderSummary } = require('./getPerSendertotals');

/**
* Update metrics for sender/receiver
* @param {Object} sender - full sender instance (should have userId + email)
* @param {Object} receiver - { email }
* @param {Object} status - { sent, deliveredInbox, landedSpam, bounced, movedToInbox, replied }
* @param {Object} io - optional WebSocket instance
*/
async function updateMetrics(sender, receiver, status, io) {
    if (!sender.userId) {
        console.error(`❌ updateMetrics: sender.userId missing for ${sender.email}`);
        throw new Error("Sender userId is required for metrics");
    }

    // Find or create by sender, receiver, and user_id
    const record = await SenderReceiverMetrics.findOne({
        where: {
            senderEmail: sender.email,
            receiverEmail: receiver.email,
            user_id: sender.userId,
        }
    }) || await SenderReceiverMetrics.create({
        senderEmail: sender.email,
        receiverEmail: receiver.email,
        user_id: sender.userId,
        totalSent: 0,
        deliveredInbox: 0,
        landedSpam: 0,
        bounced: 0,
        movedToInbox: 0,
        repliesReceived: 0,
        receiverReplied: false,
        deliverabilityScore: 0,
        replyRate: 0,
        deliveryRate: 0,
    });

    // Update counts
    record.totalSent += status.sent ? 1 : 0;
    record.deliveredInbox += status.deliveredInbox ? 1 : 0;
    record.landedSpam += status.landedSpam ? 1 : 0;
    record.bounced += status.bounced ? 1 : 0;
    record.movedToInbox += status.movedToInbox ? 1 : 0;
    record.repliesReceived += status.replied ? 1 : 0;
    record.receiverReplied = status.replied ? true : record.receiverReplied;

    // Reputation score
    let score = 0;

    const replyRate = record.totalSent > 0 ? (record.repliesReceived / record.totalSent) : 0;
    score += replyRate * 50;

    const deliveredRate = record.totalSent > 0
        ? ((record.deliveredInbox + record.movedToInbox) / record.totalSent)
        : 0;
    score += deliveredRate * 30;

    const negativeFactor = 20 -
        (record.landedSpam * 0.1 * 20) -
        (record.bounced * 0.2 * 20);
    score += Math.max(0, negativeFactor);

    score += record.movedToInbox * 0.5;

    record.deliverabilityScore = Math.max(0, Math.min(100, Math.round(score)));

    record.replyRate = record.totalSent > 0
        ? (record.repliesReceived / record.totalSent) * 100
        : 0;
    record.deliveryRate = record.totalSent > 0
        ? ((record.deliveredInbox + record.movedToInbox) / record.totalSent) * 100
        : 0;

    record.lastChecked = new Date();
    await record.save();

    if (io) {
        // Emit per-receiver update
        io.emit('metricsUpdate', record);

        // Emit aggregated per-sender totals for dashboard
        const perSenderTotals = await getPerSenderTotals(sender.userId);

        const suggestions = {};
        for (const email in perSenderTotals) {
            const s = perSenderTotals[email];
            suggestions[email] = [];
            if (s.deliverabilityScore < 70) suggestions[email].push("Reduce sending speed by 15% for next 3 days");
        }
        io.emit('perSenderTotalsUpdate', { totals: perSenderTotals, recommendations: suggestions });

        // ✅ Global user summary (ALL senders combined)
        const totalSummary = await getTotalSenderSummary(sender.userId);
        io.emit('totalSenderSummaryUpdate', totalSummary);

    }
    return record;
}

module.exports = { updateMetrics };
