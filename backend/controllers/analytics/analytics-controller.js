const EmailMetric = require('../../models/EmailMetric');
const EngagementTracking = require('../../models/EngagementTracking');
const ReplyTracking = require('../../models/ReplyTracking');
const BounceTracking = require('../../models/BounceTracking');
const SpamAnalysis = require('../../models/SpamAnalysis');
const SpamComplaint = require('../../models/SpamComplaint');
const { Op, Sequelize } = require('sequelize');
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

// Helper function to calculate email health
const calculateEmailHealth = (deliveryRate, inboxRate, spamRate, hardBounceRate, spamRiskScore = 0) => {
    let excellent = 0, good = 0, fair = 0, needsImprovement = 0;

    const spamRiskPenalty = Math.min(spamRiskScore * 2, 30);
    const bouncePenalty = hardBounceRate * 2;

    const overallScore = Math.max(0,
        (deliveryRate * 0.25) +
        (inboxRate * 0.35) +
        ((100 - spamRate) * 0.15) +
        ((100 - hardBounceRate) * 0.1) +
        ((100 - spamRiskPenalty) * 0.15)
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

// Helper to get daily performance data
const getDailyPerformance = async (email, startDate) => {
    try {
        const dailyData = await EmailMetric.findAll({
            where: {
                senderEmail: email,
                sentAt: { [Op.gte]: startDate }
            },
            attributes: [
                [Sequelize.fn('DATE', Sequelize.col('sentAt')), 'date'],
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'totalSent'],
                [Sequelize.literal('SUM(CASE WHEN status = "delivered" AND deliveredInbox = true THEN 1 ELSE 0 END)'), 'inbox'],
                [Sequelize.literal('SUM(CASE WHEN status = "delivered" AND deliveryFolder = "spam" THEN 1 ELSE 0 END)'), 'spam']
            ],
            group: [Sequelize.fn('DATE', Sequelize.col('sentAt'))],
            raw: true,
            order: [[Sequelize.fn('DATE', Sequelize.col('sentAt')), 'ASC']]
        });

        // Format for chart display - last 7 days
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const chartData = daysOfWeek.map(day => ({
            day,
            inbox: 0,
            spam: 0
        }));

        dailyData.forEach(day => {
            const date = new Date(day.date);
            const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

            if (dayIndex >= 0 && dayIndex < 7) {
                chartData[dayIndex].inbox = safeParseInt(day.inbox);
                chartData[dayIndex].spam = safeParseInt(day.spam);
            }
        });

        return chartData;
    } catch (error) {
        console.error('Error in getDailyPerformance:', error);
        return [];
    }
};

// Helper to calculate engagement metrics
const getEngagementMetrics = async (email, startDate) => {
    try {
        // Count total tracked emails
        const totalTracked = await EngagementTracking.count({
            where: {
                senderEmail: email,
                createdAt: { [Op.gte]: startDate }
            }
        });

        // Count opened emails
        const opened = await EngagementTracking.count({
            where: {
                senderEmail: email,
                opened: true,
                createdAt: { [Op.gte]: startDate }
            }
        });

        // Count clicked emails
        const clicked = await EngagementTracking.count({
            where: {
                senderEmail: email,
                clicked: true,
                createdAt: { [Op.gte]: startDate }
            }
        });

        // Get average opens and clicks
        const avgData = await EngagementTracking.findOne({
            where: {
                senderEmail: email,
                createdAt: { [Op.gte]: startDate }
            },
            attributes: [
                [Sequelize.fn('AVG', Sequelize.col('openCount')), 'avgOpens'],
                [Sequelize.fn('AVG', Sequelize.col('clickCount')), 'avgClicks']
            ],
            raw: true
        });

        return {
            openRate: totalTracked > 0 ? (opened / totalTracked) * 100 : 0,
            clickRate: totalTracked > 0 ? (clicked / totalTracked) * 100 : 0,
            avgOpens: safeParseFloat(avgData?.avgOpens, 0),
            avgClicks: safeParseFloat(avgData?.avgClicks, 0),
            totalTracked,
            opened,
            clicked
        };
    } catch (error) {
        console.error('Error in getEngagementMetrics:', error);
        return {
            openRate: 0,
            clickRate: 0,
            avgOpens: 0,
            avgClicks: 0,
            totalTracked: 0,
            opened: 0,
            clicked: 0
        };
    }
};

// Helper to calculate bounce metrics
const getBounceMetrics = async (email, startDate) => {
    try {
        // Count bounces by type
        const totalBounces = await BounceTracking.count({
            where: {
                senderEmail: email,
                bouncedAt: { [Op.gte]: startDate }
            }
        });

        const hardBounces = await BounceTracking.count({
            where: {
                senderEmail: email,
                bounceType: 'hard_bounce',
                bouncedAt: { [Op.gte]: startDate }
            }
        });

        const softBounces = await BounceTracking.count({
            where: {
                senderEmail: email,
                bounceType: 'soft_bounce',
                bouncedAt: { [Op.gte]: startDate }
            }
        });

        const spamBounces = await BounceTracking.count({
            where: {
                senderEmail: email,
                bounceType: 'spam',
                bouncedAt: { [Op.gte]: startDate }
            }
        });

        return {
            totalBounces,
            hardBounces,
            softBounces,
            spamBounces,
            hardBounceRate: totalBounces > 0 ? (hardBounces / totalBounces) * 100 : 0,
            softBounceRate: totalBounces > 0 ? (softBounces / totalBounces) * 100 : 0
        };
    } catch (error) {
        console.error('Error in getBounceMetrics:', error);
        return {
            totalBounces: 0,
            hardBounces: 0,
            softBounces: 0,
            spamBounces: 0,
            hardBounceRate: 0,
            softBounceRate: 0
        };
    }
};

// Helper to calculate reply metrics
const getReplyMetrics = async (email, startDate) => {
    try {
        const totalReplies = await ReplyTracking.count({
            where: {
                originalSender: email,
                repliedAt: { [Op.gte]: startDate }
            }
        });

        const avgResponseData = await ReplyTracking.findOne({
            where: {
                originalSender: email,
                repliedAt: { [Op.gte]: startDate }
            },
            attributes: [
                [Sequelize.fn('AVG', Sequelize.col('responseTime')), 'avgResponseTime']
            ],
            raw: true
        });

        return {
            totalReplies,
            avgResponseTime: safeParseFloat(avgResponseData?.avgResponseTime, 0)
        };
    } catch (error) {
        console.error('Error in getReplyMetrics:', error);
        return {
            totalReplies: 0,
            avgResponseTime: 0
        };
    }
};

// Helper to get spam analysis metrics
const getSpamAnalysisMetrics = async (email, startDate) => {
    try {
        const totalAnalyses = await SpamAnalysis.count({
            where: {
                senderEmail: email,
                analyzedAt: { [Op.gte]: startDate }
            }
        });

        // If no analyses found, return defaults
        if (totalAnalyses === 0) {
            return {
                totalAnalyses: 0,
                avgRiskScore: 0,
                riskDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
                criticalCount: 0,
                highCount: 0,
                mediumCount: 0,
                lowCount: 0
            };
        }

        // Get risk level counts
        const criticalCount = await SpamAnalysis.count({
            where: {
                senderEmail: email,
                riskLevel: 'critical',
                analyzedAt: { [Op.gte]: startDate }
            }
        });

        const highCount = await SpamAnalysis.count({
            where: {
                senderEmail: email,
                riskLevel: 'high',
                analyzedAt: { [Op.gte]: startDate }
            }
        });

        const mediumCount = await SpamAnalysis.count({
            where: {
                senderEmail: email,
                riskLevel: 'medium',
                analyzedAt: { [Op.gte]: startDate }
            }
        });

        const lowCount = await SpamAnalysis.count({
            where: {
                senderEmail: email,
                riskLevel: 'low',
                analyzedAt: { [Op.gte]: startDate }
            }
        });

        // Get average risk score
        const riskScoreData = await SpamAnalysis.findOne({
            where: {
                senderEmail: email,
                analyzedAt: { [Op.gte]: startDate }
            },
            attributes: [
                [Sequelize.fn('AVG', Sequelize.col('riskScore')), 'avgRiskScore']
            ],
            raw: true
        });

        const avgRiskScore = safeParseFloat(riskScoreData?.avgRiskScore, 0);

        const riskDistribution = {
            critical: totalAnalyses > 0 ? (criticalCount / totalAnalyses) * 100 : 0,
            high: totalAnalyses > 0 ? (highCount / totalAnalyses) * 100 : 0,
            medium: totalAnalyses > 0 ? (mediumCount / totalAnalyses) * 100 : 0,
            low: totalAnalyses > 0 ? (lowCount / totalAnalyses) * 100 : 0
        };

        return {
            totalAnalyses,
            avgRiskScore,
            riskDistribution,
            criticalCount,
            highCount,
            mediumCount,
            lowCount
        };
    } catch (error) {
        console.error('Error in getSpamAnalysisMetrics:', error);
        return {
            totalAnalyses: 0,
            avgRiskScore: 0,
            riskDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0
        };
    }
};

// Helper to get spam complaints
const getSpamComplaints = async (email, startDate) => {
    try {
        const totalComplaints = await SpamComplaint.count({
            where: {
                senderEmail: email,
                reportedAt: { [Op.gte]: startDate }
            }
        });

        const userComplaints = await SpamComplaint.count({
            where: {
                senderEmail: email,
                complaintType: 'user_complaint',
                reportedAt: { [Op.gte]: startDate }
            }
        });

        const ispComplaints = await SpamComplaint.count({
            where: {
                senderEmail: email,
                complaintType: 'isp_feedback',
                reportedAt: { [Op.gte]: startDate }
            }
        });

        const automatedComplaints = await SpamComplaint.count({
            where: {
                senderEmail: email,
                complaintType: 'automated_filter',
                reportedAt: { [Op.gte]: startDate }
            }
        });

        return {
            totalComplaints,
            userComplaints,
            ispComplaints,
            automatedComplaints,
            complaintRate: totalComplaints > 0 ? (totalComplaints / totalComplaints) * 100 : 0
        };
    } catch (error) {
        console.error('Error in getSpamComplaints:', error);
        return {
            totalComplaints: 0,
            userComplaints: 0,
            ispComplaints: 0,
            automatedComplaints: 0,
            complaintRate: 0
        };
    }
};

// Helper to get top spam warnings and recommendations
const getSpamInsights = async (email, startDate) => {
    try {
        const recentAnalyses = await SpamAnalysis.findAll({
            where: {
                senderEmail: email,
                analyzedAt: { [Op.gte]: startDate }
            },
            attributes: ['warnings', 'recommendations', 'riskLevel', 'analyzedAt'],
            order: [['analyzedAt', 'DESC']],
            limit: 50,
            raw: true
        });

        const warningCounts = {};
        const recommendationCounts = {};

        recentAnalyses.forEach(analysis => {
            if (analysis.warnings && Array.isArray(analysis.warnings)) {
                analysis.warnings.forEach(warning => {
                    warningCounts[warning] = (warningCounts[warning] || 0) + 1;
                });
            }

            if (analysis.recommendations && Array.isArray(analysis.recommendations)) {
                analysis.recommendations.forEach(recommendation => {
                    recommendationCounts[recommendation] = (recommendationCounts[recommendation] || 0) + 1;
                });
            }
        });

        const topWarnings = Object.entries(warningCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([warning, count]) => ({ warning, count }));

        const topRecommendations = Object.entries(recommendationCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([recommendation, count]) => ({ recommendation, count }));

        return {
            topWarnings,
            topRecommendations,
            recentRiskLevels: recentAnalyses.map(a => a.riskLevel)
        };
    } catch (error) {
        console.error('Error in getSpamInsights:', error);
        return {
            topWarnings: [],
            topRecommendations: [],
            recentRiskLevels: []
        };
    }
};

// Helper to get spam risk trends over time
const getSpamRiskTrends = async (email, days = 7) => {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const dailyRiskData = await SpamAnalysis.findAll({
            where: {
                senderEmail: email,
                analyzedAt: { [Op.gte]: startDate }
            },
            attributes: [
                [Sequelize.fn('DATE', Sequelize.col('analyzedAt')), 'date'],
                [Sequelize.fn('AVG', Sequelize.col('riskScore')), 'avgRiskScore'],
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'analysisCount']
            ],
            group: [Sequelize.fn('DATE', Sequelize.col('analyzedAt'))],
            raw: true,
            order: [[Sequelize.fn('DATE', Sequelize.col('analyzedAt')), 'ASC']]
        });

        return dailyRiskData.map(day => ({
            date: day.date,
            avgRiskScore: safeParseFloat(day.avgRiskScore, 0),
            analysisCount: safeParseInt(day.analysisCount, 0)
        }));
    } catch (error) {
        console.error('Error in getSpamRiskTrends:', error);
        return [];
    }
};

class AnalyticsController {
    // 🎯 COMPREHENSIVE ANALYTICS DASHBOARD
    async getAnalytics(req, res) {
        try {
            const { email, days = 7 } = req.query;

            if (!email) {
                return res.status(400).json({ error: 'Email parameter is required' });
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            // Get email metrics using individual counts
            const totalSent = await EmailMetric.count({
                where: {
                    senderEmail: email,
                    sentAt: { [Op.gte]: startDate }
                }
            });

            const delivered = await EmailMetric.count({
                where: {
                    senderEmail: email,
                    status: 'delivered',
                    sentAt: { [Op.gte]: startDate }
                }
            });

            const bounced = await EmailMetric.count({
                where: {
                    senderEmail: email,
                    status: 'bounced',
                    sentAt: { [Op.gte]: startDate }
                }
            });

            const inbox = await EmailMetric.count({
                where: {
                    senderEmail: email,
                    deliveredInbox: true,
                    sentAt: { [Op.gte]: startDate }
                }
            });

            const spam = await EmailMetric.count({
                where: {
                    senderEmail: email,
                    deliveryFolder: 'spam',
                    sentAt: { [Op.gte]: startDate }
                }
            });

            // Get previous period for comparison
            const previousStartDate = new Date();
            previousStartDate.setDate(previousStartDate.getDate() - (parseInt(days) * 2));

            const prevTotalSent = await EmailMetric.count({
                where: {
                    senderEmail: email,
                    sentAt: {
                        [Op.gte]: previousStartDate,
                        [Op.lt]: startDate
                    }
                }
            });

            const prevDelivered = await EmailMetric.count({
                where: {
                    senderEmail: email,
                    status: 'delivered',
                    sentAt: {
                        [Op.gte]: previousStartDate,
                        [Op.lt]: startDate
                    }
                }
            });

            const prevInbox = await EmailMetric.count({
                where: {
                    senderEmail: email,
                    deliveredInbox: true,
                    sentAt: {
                        [Op.gte]: previousStartDate,
                        [Op.lt]: startDate
                    }
                }
            });

            const prevSpam = await EmailMetric.count({
                where: {
                    senderEmail: email,
                    deliveryFolder: 'spam',
                    sentAt: {
                        [Op.gte]: previousStartDate,
                        [Op.lt]: startDate
                    }
                }
            });

            // Get all additional metrics
            const engagementMetrics = await getEngagementMetrics(email, startDate);
            const bounceMetrics = await getBounceMetrics(email, startDate);
            const replyMetrics = await getReplyMetrics(email, startDate);
            const spamAnalysisMetrics = await getSpamAnalysisMetrics(email, startDate);
            const spamComplaints = await getSpamComplaints(email, startDate);
            const spamInsights = await getSpamInsights(email, startDate);
            const spamRiskTrends = await getSpamRiskTrends(email, parseInt(days));
            const dailyPerformance = await getDailyPerformance(email, startDate);

            // Calculate percentages
            const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0;
            const inboxRate = delivered > 0 ? (inbox / delivered) * 100 : 0;
            const spamRate = delivered > 0 ? (spam / delivered) * 100 : 0;
            const totalBounceRate = totalSent > 0 ? (bounceMetrics.totalBounces / totalSent) * 100 : 0;

            // Calculate trends
            const totalTrend = totalSent > prevTotalSent ? "increase" : totalSent < prevTotalSent ? "decrease" : "no change";
            const deliveredTrend = delivered > prevDelivered ? "increase" : delivered < prevDelivered ? "decrease" : "no change";
            const inboxTrend = inbox > prevInbox ? "increase" : inbox < prevInbox ? "decrease" : "no change";
            const spamTrend = spam > prevSpam ? "increase" : spam < prevSpam ? "decrease" : "no change";

            // Calculate trend values
            const totalTrendValue = prevTotalSent > 0 ? totalSent - prevTotalSent : totalSent;
            const deliveredTrendValue = prevDelivered > 0 ? delivered - prevDelivered : delivered;
            const inboxTrendValue = prevInbox > 0 ? inbox - prevInbox : inbox;
            const spamTrendValue = prevSpam > 0 ? spam - prevSpam : spam;

            const analyticsData = {
                // Sent section
                sent: {
                    total: totalSent,
                    trend: {
                        type: totalTrend,
                        value: Math.abs(totalTrendValue),
                        text: `${totalTrend} compared to last period`
                    },
                    delivered: {
                        percentage: deliveryRate.toFixed(1) + "%",
                        count: delivered,
                        trend: {
                            type: deliveredTrend,
                            value: Math.abs(deliveredTrendValue),
                            text: `${deliveredTrend} compared to last period`
                        }
                    },
                    inbox: {
                        percentage: inboxRate.toFixed(1) + "%",
                        count: inbox,
                        trend: {
                            type: inboxTrend,
                            value: Math.abs(inboxTrendValue),
                            text: `${inboxTrend} compared to last period`
                        }
                    },
                    spam: {
                        percentage: spamRate.toFixed(1) + "%",
                        count: spam,
                        trend: {
                            type: spamTrend,
                            value: Math.abs(spamTrendValue),
                            text: `${spamTrend} compared to last period`
                        }
                    }
                },

                // Spam Analysis Section
                spamAnalysis: {
                    totalAnalyses: spamAnalysisMetrics.totalAnalyses,
                    avgRiskScore: spamAnalysisMetrics.avgRiskScore.toFixed(1),
                    riskLevel: spamAnalysisMetrics.avgRiskScore >= 15 ? 'critical' :
                        spamAnalysisMetrics.avgRiskScore >= 10 ? 'high' :
                            spamAnalysisMetrics.avgRiskScore >= 5 ? 'medium' : 'low',
                    riskDistribution: {
                        critical: spamAnalysisMetrics.riskDistribution.critical.toFixed(1) + "%",
                        high: spamAnalysisMetrics.riskDistribution.high.toFixed(1) + "%",
                        medium: spamAnalysisMetrics.riskDistribution.medium.toFixed(1) + "%",
                        low: spamAnalysisMetrics.riskDistribution.low.toFixed(1) + "%"
                    },
                    spamComplaints: {
                        total: spamComplaints.totalComplaints,
                        userComplaints: spamComplaints.userComplaints,
                        ispComplaints: spamComplaints.ispComplaints,
                        automatedComplaints: spamComplaints.automatedComplaints
                    },
                    topWarnings: spamInsights.topWarnings,
                    topRecommendations: spamInsights.topRecommendations,
                    riskTrends: spamRiskTrends
                },

                // Bounce Metrics
                bounceMetrics: {
                    total: bounceMetrics.totalBounces,
                    hardBounces: bounceMetrics.hardBounces,
                    softBounces: bounceMetrics.softBounces,
                    spamBounces: bounceMetrics.spamBounces,
                    hardBounceRate: bounceMetrics.hardBounceRate.toFixed(1) + "%",
                    softBounceRate: bounceMetrics.softBounceRate.toFixed(1) + "%",
                    totalBounceRate: totalBounceRate.toFixed(1) + "%"
                },

                // Email Health Overview
                emailHealth: calculateEmailHealth(
                    deliveryRate,
                    inboxRate,
                    spamRate,
                    bounceMetrics.hardBounceRate,
                    spamAnalysisMetrics.avgRiskScore
                ),

                // Daily Performance
                dailyPerformance,

                // Engagement metrics
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

    // 📊 SIMPLE METRICS ONLY - FIXED VERSION
    async getSimpleMetrics(req, res) {
        try {
            const { email, days = 7 } = req.query;

            if (!email) {
                return res.status(400).json({ error: 'Email parameter is required' });
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            // Get email metrics using individual counts
            const totalSent = await EmailMetric.count({
                where: {
                    senderEmail: email,
                    sentAt: { [Op.gte]: startDate }
                }
            });

            const delivered = await EmailMetric.count({
                where: {
                    senderEmail: email,
                    status: 'delivered',
                    sentAt: { [Op.gte]: startDate }
                }
            });

            const bounced = await EmailMetric.count({
                where: {
                    senderEmail: email,
                    status: 'bounced',
                    sentAt: { [Op.gte]: startDate }
                }
            });

            const inbox = await EmailMetric.count({
                where: {
                    senderEmail: email,
                    deliveredInbox: true,
                    sentAt: { [Op.gte]: startDate }
                }
            });

            // Get additional metrics
            const engagementMetrics = await getEngagementMetrics(email, startDate);
            const bounceMetrics = await getBounceMetrics(email, startDate);
            const spamAnalysisMetrics = await getSpamAnalysisMetrics(email, startDate);

            const simpleData = {
                totalSent,
                delivered,
                bounced,
                inbox,
                deliveryRate: totalSent > 0 ? ((delivered / totalSent) * 100).toFixed(1) : "0.0",
                bounceRate: totalSent > 0 ? ((bounced / totalSent) * 100).toFixed(1) : "0.0",
                inboxRate: delivered > 0 ? ((inbox / delivered) * 100).toFixed(1) : "0.0",
                openRate: engagementMetrics.openRate.toFixed(1),
                clickRate: engagementMetrics.clickRate.toFixed(1),
                hardBounces: bounceMetrics.hardBounces,
                softBounces: bounceMetrics.softBounces,
                spamRiskScore: spamAnalysisMetrics.avgRiskScore.toFixed(1),
                spamRiskLevel: spamAnalysisMetrics.avgRiskScore >= 15 ? 'critical' :
                    spamAnalysisMetrics.avgRiskScore >= 10 ? 'high' :
                        spamAnalysisMetrics.avgRiskScore >= 5 ? 'medium' : 'low'
            };

            console.log('📊 Simple Metrics Debug:', {
                email,
                days,
                totalSent,
                delivered,
                bounced,
                inbox,
                engagement: engagementMetrics,
                bounce: bounceMetrics,
                spam: spamAnalysisMetrics
            });

            res.json({
                success: true,
                data: simpleData
            });

        } catch (error) {
            console.error('❌ Simple metrics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch simple metrics',
                details: error.message
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

    // 🔍 DETAILED SPAM ANALYSIS
    async getSpamAnalysis(req, res) {
        try {
            const { email, days = 30 } = req.query;

            if (!email) {
                return res.status(400).json({ error: 'Email parameter is required' });
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            // Get detailed spam analysis data
            const spamAnalyses = await SpamAnalysis.findAll({
                where: {
                    senderEmail: email,
                    analyzedAt: { [Op.gte]: startDate }
                },
                attributes: [
                    'messageId',
                    'riskScore',
                    'riskLevel',
                    'warnings',
                    'recommendations',
                    'deliveredInbox',
                    'deliveryFolder',
                    'analyzedAt'
                ],
                order: [['analyzedAt', 'DESC']],
                limit: 100,
                raw: true
            });

            // Get spam analysis metrics
            const spamMetrics = await getSpamAnalysisMetrics(email, startDate);
            const spamInsights = await getSpamInsights(email, startDate);
            const spamRiskTrends = await getSpamRiskTrends(email, parseInt(days));
            const spamComplaints = await getSpamComplaints(email, startDate);

            res.json({
                success: true,
                data: {
                    spamAnalyses,
                    spamMetrics,
                    spamInsights,
                    spamRiskTrends,
                    spamComplaints,
                    totalAnalyses: spamAnalyses.length
                }
            });

        } catch (error) {
            console.error('❌ Spam analysis error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch spam analysis'
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
                limit: 100,
                raw: true
            });

            // Group by bounce type for analysis
            const bounceSummary = await BounceTracking.findAll({
                where: {
                    senderEmail: email,
                    bouncedAt: { [Op.gte]: startDate }
                },
                attributes: [
                    'bounceType',
                    [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
                ],
                group: ['bounceType'],
                raw: true
            });

            const bounceMetrics = await getBounceMetrics(email, startDate);

            res.json({
                success: true,
                data: {
                    bounceDetails,
                    bounceSummary,
                    bounceMetrics,
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

    // 🔍 DETAILED ENGAGEMENT ANALYSIS
    async getEngagementAnalysis(req, res) {
        try {
            const { email, days = 30 } = req.query;

            if (!email) {
                return res.status(400).json({ error: 'Email parameter is required' });
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            // Get detailed engagement data
            const engagementDetails = await EngagementTracking.findAll({
                where: {
                    senderEmail: email,
                    firstOpenedAt: { [Op.gte]: startDate }
                },
                attributes: [
                    'receiverEmail',
                    'opened',
                    'clicked',
                    'openCount',
                    'clickCount',
                    'firstOpenedAt',
                    'firstClickedAt',
                    'platform',
                    'clientType'
                ],
                order: [['firstOpenedAt', 'DESC']],
                limit: 100,
                raw: true
            });

            const engagementMetrics = await getEngagementMetrics(email, startDate);

            // Get platform distribution
            const platformDistribution = await EngagementTracking.findAll({
                where: {
                    senderEmail: email,
                    firstOpenedAt: { [Op.gte]: startDate },
                    platform: { [Op.ne]: null }
                },
                attributes: [
                    'platform',
                    [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
                ],
                group: ['platform'],
                raw: true
            });

            res.json({
                success: true,
                data: {
                    engagementDetails,
                    engagementMetrics,
                    platformDistribution,
                    totalEngagements: engagementDetails.length
                }
            });

        } catch (error) {
            console.error('❌ Engagement analysis error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch engagement analysis'
            });
        }
    }

    // 🔍 REPLY ANALYSIS
    async getReplyAnalysis(req, res) {
        try {
            const { email, days = 30 } = req.query;

            if (!email) {
                return res.status(400).json({ error: 'Email parameter is required' });
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            // Get detailed reply data
            const replyDetails = await ReplyTracking.findAll({
                where: {
                    originalSender: email,
                    repliedAt: { [Op.gte]: startDate }
                },
                attributes: [
                    'replySender',
                    'replyReceiver',
                    'responseTime',
                    'repliedAt',
                    'threadDepth',
                    'replyQuality',
                    'isAutomatedReply'
                ],
                order: [['repliedAt', 'DESC']],
                limit: 100,
                raw: true
            });

            const replyMetrics = await getReplyMetrics(email, startDate);

            // Get reply quality distribution
            const qualityDistribution = await ReplyTracking.findAll({
                where: {
                    originalSender: email,
                    repliedAt: { [Op.gte]: startDate },
                    replyQuality: { [Op.ne]: null }
                },
                attributes: [
                    'replyQuality',
                    [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
                ],
                group: ['replyQuality'],
                raw: true
            });

            res.json({
                success: true,
                data: {
                    replyDetails,
                    replyMetrics,
                    qualityDistribution,
                    totalReplies: replyDetails.length
                }
            });

        } catch (error) {
            console.error('❌ Reply analysis error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch reply analysis'
            });
        }
    }
}

module.exports = new AnalyticsController();