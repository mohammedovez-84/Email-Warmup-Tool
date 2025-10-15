const SenderReceiverMetrics = require('../models/SenderReceiverMetrics');

/**
* Aggregate all metrics per sender for a given user
* @param {number} userId - ID of the user
* @returns {Promise<Object>} - aggregated metrics per sender
*/
async function getPerSenderTotals(userId) {
    const metrics = await SenderReceiverMetrics.findAll({
        where: { user_id: userId },
        raw: true
    });

    const result = {};

    metrics.forEach(m => {
        const email = m.senderEmail;

        if (!result[email]) {
            result[email] = {
                totalSent: 0,
                deliveredInbox: 0,
                repliesReceived: 0,
                landedSpam: 0,
                bounced: 0,
                movedToInbox: 0,
                deliverabilityScoreSum: 0,
                count: 0
            };
        }

        result[email].totalSent += m.totalSent;
        result[email].deliveredInbox += m.deliveredInbox;
        result[email].repliesReceived += m.repliesReceived;
        result[email].landedSpam += m.landedSpam;
        result[email].bounced += m.bounced;
        result[email].movedToInbox += m.movedToInbox;
        result[email].deliverabilityScoreSum += m.deliverabilityScore;
        result[email].count += 1;
    });

    for (const email in result) {
        result[email].deliverabilityScore = Math.round(result[email].deliverabilityScoreSum / result[email].count);
        delete result[email].deliverabilityScoreSum;
        delete result[email].count;
    }

    return result;
}

//  Aggregate overall totals across ALL senders for one user

async function getTotalSenderSummary(userId) {
    const metrics = await SenderReceiverMetrics.findAll({
        where: { user_id: userId },
        raw: true
    });

    const summary = {
        totalSent: 0,
        deliveredInbox: 0,
        repliesReceived: 0,
        landedSpam: 0,
        bounced: 0,
        movedToInbox: 0,
        deliverabilityScoreSum: 0,
        count: 0
    };

    metrics.forEach(m => {
        summary.totalSent += m.totalSent;
        summary.deliveredInbox += m.deliveredInbox;
        summary.repliesReceived += m.repliesReceived;
        summary.landedSpam += m.landedSpam;
        summary.bounced += m.bounced;
        summary.movedToInbox += m.movedToInbox;
        summary.deliverabilityScoreSum += m.deliverabilityScore;
        summary.count += 1;
    });

    summary.deliverabilityScore =
        summary.count > 0
            ? Math.round(summary.deliverabilityScoreSum / summary.count)
            : 0;

    delete summary.deliverabilityScoreSum;
    delete summary.count;

    return summary;
}

module.exports = { getPerSenderTotals, getTotalSenderSummary };

