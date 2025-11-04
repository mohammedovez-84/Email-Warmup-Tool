//notificationService.js
const { Notification } = require("../models/Notification");

/**
* Create a new notification
* @param {string} email - recipient email
* @param {string} message - notification message
*/
async function createNotification(email, message) {
    return await Notification.create({ email, message });
}

/**
* Fetch all unseen notifications for a user
* @param {string} email
*/
async function getNotifications(email) {
    return await Notification.findAll({ where: { email, seen: false } });
}

/**
* Mark notifications as seen
* @param {number[]} ids - array of notification IDs
*/
async function markNotificationsSeen(ids) {
    return await Notification.update(
        { seen: true },
        { where: { id: ids } }
    );
}

/**
* Generate a summary sentence for a health check result
* @param {string} email
* @param {object} healthResult
*/
function generateHealthCheckSummary(email, healthResult) {
    const {
        domain,
        mxRecords,
        spf,
        dmarc,
        dkim,
        blacklist,
        spamTrapRisk,
        detectedImpersonations,
    } = healthResult;

    const mxCount = mxRecords.length;
    const spfStatus = spf ? "present" : "missing";
    const dmarcStatus = dmarc ? "present" : "missing";
    const dkimStatus = dkim ? "present" : "missing";

    const blacklistCount = blacklist.reduce(
        (acc, item) => acc + item.checks.filter(c => c.listed).length,
        0
    );

    const spamTrapCount = spamTrapRisk.filter(r => r.status === "valid").length;
    const impersonationCount = detectedImpersonations.length;

    return `Health check completed for ${email}: Domain ${domain}, ${mxCount} MX record(s), SPF ${spfStatus}, DMARC ${dmarcStatus}, DKIM ${dkimStatus}, ${blacklistCount} blacklist hit(s), ${impersonationCount} impersonation(s), ${spamTrapCount} valid spam trap risk(es).`;
}

module.exports = {
    createNotification,
    getNotifications,
    markNotificationsSeen,
    generateHealthCheckSummary,
};
