const EmailMetric = require('../../models/EmailMetric');
const EngagementTracking = require('../../models/EngagementTracking');
const ReplyTracking = require('../../models/ReplyTracking');
const BounceTracking = require('../../models/BounceTracking');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/db');

// Safe parsing utilities
const safeParseInt = (value, defaultValue = 0) => {
    if (value === null || value === undefined || value === 'NULL' || value === '') return defaultValue;
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
};

const safeParseFloat = (value, defaultValue = 0) => {
    if (value === null || value === undefined || value === 'NULL' || value === '') return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
};

// Helper function to calculate email health based on actual metrics
const calculateEmailHealth = (deliveryRate, inboxRate, spamRate, hardBounceRate) => {
    let excellent = 0, good = 0, fair = 0, needsImprovement = 0;

    // Enhanced scoring algorithm considering multiple factors including bounces
    const bouncePenalty = hardBounceRate * 2;
    const overallScore = Math.max(0,
        (deliveryRate * 0.3) +
        (inboxRate * 0.4) +
        ((100 - spamRate) * 0.2) +
        ((100 - hardBounceRate) * 0.1)
    );

    if (overallScore >= 90) {
        excellent = 60;
        good = 25;
        fair = 10;
        needsImprovement = 5;
    } else if (overallScore >= 80) {
        excellent = 30;
        good = 40;
        fair = 20;
        needsImprovement = 10;
    } else if (overallScore >= 70) {
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

// Helper to get daily performance data for the last 7 days
const getDailyPerformance = async (email, startDate) => {
    const dailyData = await EmailMetric.findAll({
        where: {
            senderEmail: email,
            sentAt: { [Op.gte]: startDate }
        },
        attributes: [
            [sequelize.fn('DATE', sequelize.col('sentAt')), 'date'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'totalSent'],
            [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = "delivered" THEN 1 ELSE 0 END')), 'delivered'],
            [sequelize.fn('SUM', sequelize.literal('CASE WHEN deliveredInbox = true THEN 1 ELSE 0 END')), 'inbox'],
            [sequelize.fn('SUM', sequelize.literal('CASE WHEN deliveryFolder = "spam" THEN 1 ELSE 0 END')), 'spam']
        ],
        group: [sequelize.fn('DATE', sequelize.col('sentAt'))],
        raw: true,
        order: [[sequelize.fn('DATE', sequelize.col('sentAt')), 'ASC']]
    });

    // Format for chart display
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const chartData = daysOfWeek.map(day => ({
        day,
        inbox: 0,
        spam: 0
    }));

    dailyData.forEach(day => {
        const date = new Date(day.date);
        const dayIndex = date.getDay();

        if (dayIndex >= 0 && dayIndex < 7) {
            chartData[dayIndex].inbox = safeParseInt(day.inbox);
            chartData[dayIndex].spam = safeParseInt(day.spam);
        }
    });

    return chartData;
};

// Helper to calculate engagement metrics
const getEngagementMetrics = async (email, startDate) => {
    const engagementData = await EngagementTracking.findOne({
        where: {
            senderEmail: email,
            firstOpenedAt: { [Op.gte]: startDate }
        },
        attributes: [
            [sequelize.fn('COUNT', sequelize.col('id')), 'totalTracked'],
            [sequelize.fn('SUM', sequelize.literal('CASE WHEN opened = true THEN 1 ELSE 0 END')), 'opened'],
            [sequelize.fn('SUM', sequelize.literal('CASE WHEN clicked = true THEN 1 ELSE 0 END')), 'clicked'],
            [sequelize.fn('AVG', sequelize.literal('openCount')), 'avgOpens'],
            [sequelize.fn('AVG', sequelize.literal('clickCount')), 'avgClicks']
        ],
        raw: true
    });

    const totalTracked = safeParseInt(engagementData?.totalTracked, 0);
    const opened = safeParseInt(engagementData?.opened, 0);
    const clicked = safeParseInt(engagementData?.clicked, 0);

    return {
        openRate: totalTracked > 0 ? (opened / totalTracked) * 100 : 0,
        clickRate: totalTracked > 0 ? (clicked / totalTracked) * 100 : 0,
        avgOpens: safeParseFloat(engagementData?.avgOpens, 0),
        avgClicks: safeParseFloat(engagementData?.avgClicks, 0)
    };
};

// Helper to calculate bounce metrics
const getBounceMetrics = async (email, startDate) => {
    const bounceData = await BounceTracking.findOne({
        where: {
            senderEmail: email,
            bouncedAt: { [Op.gte]: startDate }
        },
        attributes: [
            [sequelize.fn('COUNT', sequelize.col('id')), 'totalBounces'],
            [sequelize.fn('SUM', sequelize.literal('CASE WHEN bounceType = "hard_bounce" THEN 1 ELSE 0 END')), 'hardBounces'],
            [sequelize.fn('SUM', sequelize.literal('CASE WHEN bounceType = "soft_bounce" THEN 1 ELSE 0 END')), 'softBounces'],
            [sequelize.fn('SUM', sequelize.literal('CASE WHEN bounceType = "spam" THEN 1 ELSE 0 END')), 'spamBounces'],
            [sequelize.fn('SUM', sequelize.literal('CASE WHEN bounceCategory = "permanent" THEN 1 ELSE 0 END')), 'permanentBounces'],
            [sequelize.fn('SUM', sequelize.literal('CASE WHEN bounceCategory = "transient" THEN 1 ELSE 0 END')), 'transientBounces']
        ],
        raw: true
    });

    const totalBounces = safeParseInt(bounceData?.totalBounces, 0);
    const hardBounces = safeParseInt(bounceData?.hardBounces, 0);
    const softBounces = safeParseInt(bounceData?.softBounces, 0);
    const spamBounces = safeParseInt(bounceData?.spamBounces, 0);

    return {
        totalBounces,
        hardBounces,
        softBounces,
        spamBounces,
        hardBounceRate: totalBounces > 0 ? (hardBounces / totalBounces) * 100 : 0,
        softBounceRate: totalBounces > 0 ? (softBounces / totalBounces) * 100 : 0
    };
};

// Helper to calculate reply metrics
const getReplyMetrics = async (email, startDate) => {
    const replyData = await ReplyTracking.findOne({
        where: {
            originalSender: email,
            repliedAt: { [Op.gte]: startDate }
        },
        attributes: [
            [sequelize.fn('COUNT', sequelize.col('id')), 'totalReplies'],
            [sequelize.fn('AVG', sequelize.col('responseTime')), 'avgResponseTime']
        ],
        raw: true
    });

    return {
        totalReplies: safeParseInt(replyData?.totalReplies, 0),
        avgResponseTime: safeParseFloat(replyData?.avgResponseTime, 0)
    };
};

class AnalyticsController {
    // 🎯 COMPREHENSIVE ANALYTICS DASHBOARD - REAL DATA FROM DB
    async getAnalytics(req, res) {
        try {
            const { email, days = 7 } = req.query;

            if (!email) {
                return res.status(400).json({ error: 'Email parameter is required' });
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            // Get previous period for comparison
            const previousStartDate = new Date();
            previousStartDate.setDate(previousStartDate.getDate() - (parseInt(days) * 2));

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

            // Get previous period metrics
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
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN deliveredInbox = true THEN 1 ELSE 0 END')), 'inbox'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN deliveryFolder = "spam" THEN 1 ELSE 0 END')), 'spam']
                ],
                raw: true
            });

            // Get additional metrics
            const engagementMetrics = await getEngagementMetrics(email, startDate);
            const bounceMetrics = await getBounceMetrics(email, startDate);
            const replyMetrics = await getReplyMetrics(email, startDate);
            const dailyPerformance = await getDailyPerformance(email, startDate);

            // Parse real data with safe defaults
            const totalSent = safeParseInt(metrics?.totalSent, 0);
            const delivered = safeParseInt(metrics?.delivered, 0);
            const bounced = safeParseInt(metrics?.bounced, 0);
            const inbox = safeParseInt(metrics?.inbox, 0);
            const spam = safeParseInt(metrics?.spam, 0);

            const prevTotalSent = safeParseInt(previousMetrics?.totalSent, 0);
            const prevDelivered = safeParseInt(previousMetrics?.delivered, 0);
            const prevInbox = safeParseInt(previousMetrics?.inbox, 0);
            const prevSpam = safeParseInt(previousMetrics?.spam, 0);

            // Calculate percentages including bounce data
            const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0;
            const inboxRate = delivered > 0 ? (inbox / delivered) * 100 : 0;
            const spamRate = delivered > 0 ? (spam / delivered) * 100 : 0;
            const totalBounceRate = totalSent > 0 ? (bounceMetrics.totalBounces / totalSent) * 100 : 0;

            // Calculate trends
            const totalTrend = totalSent > prevTotalSent ? "Increase" : totalSent < prevTotalSent ? "Decrease" : "No change";
            const deliveredTrend = delivered > prevDelivered ? "Increase" : delivered < prevDelivered ? "Decrease" : "No change";
            const inboxTrend = inbox > prevInbox ? "Increase" : inbox < prevInbox ? "Decrease" : "No change";
            const spamTrend = spam > prevSpam ? "Increase" : spam < prevSpam ? "Decrease" : "No change";

            // Calculate trend values
            const totalTrendValue = prevTotalSent > 0 ? totalSent - prevTotalSent : totalSent;
            const deliveredTrendValue = prevDelivered > 0 ? delivered - prevDelivered : delivered;
            const inboxTrendValue = prevInbox > 0 ? inbox - prevInbox : inbox;
            const spamTrendValue = prevSpam > 0 ? spam - prevSpam : spam;

            const analyticsData = {
                // Sent section - REAL DATA (matching your UI design)
                sent: {
                    total: totalSent,
                    trend: {
                        type: totalTrend.toLowerCase(),
                        value: Math.abs(totalTrendValue),
                        text: `${totalTrend.toLowerCase()} compared to last week`
                    },
                    delivered: {
                        percentage: deliveryRate.toFixed(1) + "%",
                        count: delivered,
                        trend: {
                            type: deliveredTrend.toLowerCase(),
                            value: Math.abs(deliveredTrendValue),
                            text: `${deliveredTrend.toLowerCase()} compared to last week`
                        }
                    },
                    inbox: {
                        percentage: inboxRate.toFixed(1) + "%",
                        count: inbox,
                        trend: {
                            type: inboxTrend.toLowerCase(),
                            value: Math.abs(inboxTrendValue),
                            text: `${inboxTrend.toLowerCase()} compared to last week`
                        }
                    },
                    spam: {
                        percentage: spamRate.toFixed(1) + "%",
                        count: spam,
                        trend: {
                            type: spamTrend.toLowerCase(),
                            value: Math.abs(spamTrendValue),
                            text: `${spamTrend.toLowerCase()} compared to last week`
                        }
                    },
                    credits: "1:30 credits"
                },

                // Bounce Metrics - Using BounceTracking model
                bounceMetrics: {
                    total: bounceMetrics.totalBounces,
                    hardBounces: bounceMetrics.hardBounces,
                    softBounces: bounceMetrics.softBounces,
                    hardBounceRate: bounceMetrics.hardBounceRate.toFixed(1) + "%",
                    softBounceRate: bounceMetrics.softBounceRate.toFixed(1) + "%",
                    totalBounceRate: totalBounceRate.toFixed(1) + "%"
                },

                // Email Health Overview - Calculate based on actual performance including bounces
                emailHealth: calculateEmailHealth(deliveryRate, inboxRate, spamRate, bounceMetrics.hardBounceRate),

                // Daily Warmup Performance (for the chart)
                dailyPerformance,

                // Additional engagement metrics
                engagement: {
                    openRate: engagementMetrics.openRate.toFixed(1) + "%",
                    clickRate: engagementMetrics.clickRate.toFixed(1) + "%",
                    avgOpens: engagementMetrics.avgOpens.toFixed(1),
                    avgClicks: engagementMetrics.avgClicks.toFixed(1),
                    totalReplies: replyMetrics.totalReplies,
                    avgResponseTime: replyMetrics.avgResponseTime.toFixed(0) + " min",
                    replyRate: totalSent > 0 ? ((replyMetrics.totalReplies / totalSent) * 100).toFixed(1) + "%" : "0%"
                },

                // User info
                user: {
                    name: email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1),
                    email: email
                }
            };

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

            // Get bounce metrics for simple view
            const bounceMetrics = await getBounceMetrics(email, startDate);

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
                inboxRate: delivered > 0 ? ((inbox / delivered) * 100).toFixed(1) : 0,
                hardBounces: bounceMetrics.hardBounces,
                softBounces: bounceMetrics.softBounces
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

    // 📈 DAILY PERFORMANCE DATA FOR CHARTS
    async getDailyPerformance(req, res) {
        try {
            const { email, days = 7 } = req.query;

            if (!email) {
                return res.status(400).json({ error: 'Email parameter is required' });
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            const dailyPerformance = await getDailyPerformance(email, startDate);

            res.json({
                success: true,
                data: dailyPerformance
            });

        } catch (error) {
            console.error('❌ Daily performance error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch daily performance data'
            });
        }
    }

    // 🔍 DETAILED BOUNCE ANALYSIS
    async getBounceAnalysis(req, res) {
        try {
            const { email, days = 30 } = req.query;

            if (!email) {
                return res.status(400).json({ error: 'Email parameter is required' });
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            // Get detailed bounce data
            const bounceDetails = await BounceTracking.findAll({
                where: {
                    senderEmail: email,
                    bouncedAt: { [Op.gte]: startDate }
                },
                attributes: [
                    'bounceType',
                    'bounceCategory',
                    'bounceReason',
                    'bounceCode',
                    'receivingServer',
                    'isp',
                    'bouncedAt'
                ],
                order: [['bouncedAt', 'DESC']],
                limit: 100
            });

            // Group by bounce type for analysis
            const bounceSummary = await BounceTracking.findAll({
                where: {
                    senderEmail: email,
                    bouncedAt: { [Op.gte]: startDate }
                },
                attributes: [
                    'bounceType',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['bounceType'],
                raw: true
            });

            res.json({
                success: true,
                data: {
                    bounceDetails,
                    bounceSummary,
                    totalBounces: bounceDetails.length
                }
            });

        } catch (error) {
            console.error('❌ Bounce analysis error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch bounce analysis'
            });
        }
    }
}

module.exports = new AnalyticsController();