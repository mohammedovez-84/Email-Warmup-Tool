const EmailMetric = require('../../models/EmailMetric');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/db');

// Safe parsing utilities
const safeParseInt = (value, defaultValue = 0) => {
    if (value === null || value === undefined || value === 'NULL' || value === '') return defaultValue;
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
};

// Helper function to calculate email health based on actual metrics
const calculateEmailHealth = (deliveryRate, inboxRate, spamRate) => {
    let excellent = 0, good = 0, fair = 0, needsImprovement = 0;

    if (deliveryRate >= 95 && inboxRate >= 90 && spamRate <= 2) {
        excellent = 60;
        good = 25;
        fair = 10;
        needsImprovement = 5;
    } else if (deliveryRate >= 90 && inboxRate >= 80 && spamRate <= 5) {
        excellent = 30;
        good = 40;
        fair = 20;
        needsImprovement = 10;
    } else if (deliveryRate >= 80 && inboxRate >= 70 && spamRate <= 10) {
        excellent = 15;
        good = 25;
        fair = 35;
        needsImprovement = 25;
    } else {
        excellent = 5;
        good = 15;
        fair = 30;
        needsImprovement = 50;
    }

    return [
        { level: "Excellent", percentage: excellent },
        { level: "Good", percentage: good },
        { level: "Fair", percentage: fair },
        { level: "Needs Improvement", percentage: needsImprovement }
    ];
};

class AnalyticsController {
    // 🎯 ANALYTICS DASHBOARD - REAL DATA FROM DB
    async getAnalytics(req, res) {
        try {
            const { email, days = 7 } = req.query;

            if (!email) {
                return res.status(400).json({ error: 'Email parameter is required' });
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            // Get real metrics from database
            const metrics = await EmailMetric.findOne({
                where: {
                    senderEmail: email,
                    sentAt: { [Op.gte]: startDate }
                },
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'totalSent'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = "delivered" THEN 1 ELSE 0 END')), 'delivered'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = "bounced" THEN 1 ELSE 0 END')), 'bounced'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN deliveredInbox = true THEN 1 ELSE 0 END')), 'inbox'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN deliveryFolder = "spam" THEN 1 ELSE 0 END')), 'spam']
                ],
                raw: true
            });

            console.log('Raw metrics from DB:', metrics); // Debug log

            // Get previous period for comparison
            const previousStartDate = new Date();
            previousStartDate.setDate(previousStartDate.getDate() - (parseInt(days) * 2));

            const previousMetrics = await EmailMetric.findOne({
                where: {
                    senderEmail: email,
                    sentAt: {
                        [Op.gte]: previousStartDate,
                        [Op.lt]: startDate
                    }
                },
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'totalSent'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = "delivered" THEN 1 ELSE 0 END')), 'delivered'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN deliveredInbox = true THEN 1 ELSE 0 END')), 'inbox']
                ],
                raw: true
            });

            console.log('Previous metrics from DB:', previousMetrics); // Debug log

            // Parse real data with safe defaults
            const totalSent = safeParseInt(metrics?.totalSent, 0);
            const delivered = safeParseInt(metrics?.delivered, 0);
            const bounced = safeParseInt(metrics?.bounced, 0);
            const inbox = safeParseInt(metrics?.inbox, 0);
            const spam = safeParseInt(metrics?.spam, 0);

            const prevTotalSent = safeParseInt(previousMetrics?.totalSent, 0);
            const prevDelivered = safeParseInt(previousMetrics?.delivered, 0);
            const prevInbox = safeParseInt(previousMetrics?.inbox, 0);

            // Calculate percentages
            const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0;
            const inboxRate = delivered > 0 ? (inbox / delivered) * 100 : 0;
            const spamRate = delivered > 0 ? (spam / delivered) * 100 : 0;

            // Calculate trends
            const totalTrend = totalSent > prevTotalSent ? "Increase" : totalSent < prevTotalSent ? "Decrease" : "No change";
            const deliveredTrend = delivered > prevDelivered ? "Increase" : delivered < prevDelivered ? "Decrease" : "No change";
            const inboxTrend = inbox > prevInbox ? "Increase" : inbox < prevInbox ? "Decrease" : "No change";

            const analyticsData = {
                // Sent section - REAL DATA
                sent: {
                    total: totalSent,
                    trend: `${totalTrend} compared to last week`,
                    delivered: {
                        percentage: deliveryRate.toFixed(1) + "%",
                        count: delivered,
                        trend: `${deliveredTrend} compared to last week`
                    },
                    inbox: {
                        percentage: inboxRate.toFixed(1) + "%",
                        count: inbox,
                        trend: `${inboxTrend} compared to last week`
                    },
                    spam: {
                        percentage: spamRate.toFixed(1) + "%",
                        count: spam
                    },
                    credits: "1:30 credits" // This might come from a different model
                },

                // Email Health Overview - Calculate based on actual performance
                emailHealth: calculateEmailHealth(deliveryRate, inboxRate, spamRate),

                // User info (you might want to get this from a User model)
                user: {
                    name: email?.split("@")[0], // This should come from your user model
                    email: email
                }
            };

            console.log('Final analytics data:', analyticsData); // Debug log

            res.json({
                success: true,
                data: analyticsData
            });

        } catch (error) {
            console.error('❌ Analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch analytics data',
                details: error.message
            });
        }
    }

    // 📊 SIMPLE METRICS ONLY - REAL DATA
    async getSimpleMetrics(req, res) {
        try {
            const { email, days = 7 } = req.query;

            if (!email) {
                return res.status(400).json({ error: 'Email parameter is required' });
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            // Get real counts from database
            const result = await EmailMetric.findOne({
                where: {
                    senderEmail: email,
                    sentAt: { [Op.gte]: startDate }
                },
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'totalSent'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = "delivered" THEN 1 ELSE 0 END')), 'delivered'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = "bounced" THEN 1 ELSE 0 END')), 'bounced'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN deliveredInbox = true THEN 1 ELSE 0 END')), 'inbox']
                ],
                raw: true
            });

            const metrics = result || {};

            const totalSent = safeParseInt(metrics.totalSent, 0);
            const delivered = safeParseInt(metrics.delivered, 0);
            const bounced = safeParseInt(metrics.bounced, 0);
            const inbox = safeParseInt(metrics.inbox, 0);

            const simpleData = {
                totalSent,
                delivered,
                bounced,
                inbox,
                deliveryRate: totalSent > 0 ? ((delivered / totalSent) * 100).toFixed(1) : 0,
                bounceRate: totalSent > 0 ? ((bounced / totalSent) * 100).toFixed(1) : 0,
                inboxRate: delivered > 0 ? ((inbox / delivered) * 100).toFixed(1) : 0
            };

            res.json({
                success: true,
                data: simpleData
            });

        } catch (error) {
            console.error('❌ Simple metrics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch simple metrics'
            });
        }
    }
}

module.exports = new AnalyticsController();