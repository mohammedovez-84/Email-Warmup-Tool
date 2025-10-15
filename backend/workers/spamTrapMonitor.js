// jobs/spamTrapMonitor.js
const { Op, Sequelize } = require("sequelize");
const Account = require("../models/Account");       // receivers table
const WarmupLog = require("../models/WarmupLog");   // logs table

// thresholds (tune as needed)
const MIN_SENDS = 20;          // only evaluate after 20 sends
const BOUNCE_THRESHOLD = 5;    // if >=5 bounces → trap suspected
const NO_ENGAGEMENT_LIMIT = 30; // if 30+ emails sent but no opens/replies → suspicious

async function analyzeReceiver(account) {
    const stats = await WarmupLog.findAll({
        attributes: [
            [Sequelize.fn("COUNT", Sequelize.col("id")), "total"],
            [Sequelize.fn("SUM", Sequelize.literal("status='opened'")), "opened"],
            [Sequelize.fn("SUM", Sequelize.literal("status='replied'")), "replied"],
            [Sequelize.fn("SUM", Sequelize.literal("status='bounced'")), "bounced"]
        ],
        where: { receiver: account.email },
        raw: true
    });

    const total = parseInt(stats[0].total || 0);
    const opened = parseInt(stats[0].opened || 0);
    const replied = parseInt(stats[0].replied || 0);
    const bounced = parseInt(stats[0].bounced || 0);

    let status = "active";
    let reason = "Healthy";

    if (bounced >= BOUNCE_THRESHOLD) {
        status = "trap_suspected";
        reason = `Hard bounces: ${bounced}`;
    } else if (total >= NO_ENGAGEMENT_LIMIT && opened === 0 && replied === 0) {
        status = "suspicious";
        reason = `No engagement after ${total} sends`;
    }

    return { status, reason, total, opened, replied, bounced };
}

async function runSpamTrapMonitor() {
    try {
        console.log("🚀 Running Spam Trap Monitor...");
        const accounts = await Account.findAll();

        for (const account of accounts) {
            const { status, reason, total, opened, replied, bounced } = await analyzeReceiver(account);

            if (account.health_status !== status) {
                await account.update({
                    health_status: status,
                    last_health_check: new Date()
                });
                console.log(
                    `⚠️ Receiver ${account.email} flagged as ${status} | Reason: ${reason} | stats: total=${total}, opened=${opened}, replied=${replied}, bounced=${bounced}`
                );
            }
        }

        console.log("✅ Spam Trap Monitor finished.");
    } catch (err) {
        console.error("❌ Error in Spam Trap Monitor:", err);
    }
}

module.exports = { runSpamTrapMonitor };
