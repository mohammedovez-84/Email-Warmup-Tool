const GoogleUser = require('../models/GoogleUser');
const SmtpAccount = require('../models/smtpAccounts');
const MicrosoftUser = require('../models/MicrosoftUser');
const EmailMetric = require('../models/EmailMetric');
const { getRateLimitStats } = require('../services/warmupWorkflow');
const { Op } = require("sequelize")
exports.getDashboardData = async (req, res) => {
    console.log('✅ Dashboard API hit');
    try {
        const userId = req.user.id;

        // Fetch accounts
        const googleUsers = await GoogleUser.findAll({
            where: { user_id: userId }
        });

        const smtpAccounts = await SmtpAccount.findAll({
            where: { user_id: userId }
        });

        const microsoftUsers = await MicrosoftUser.findAll({
            where: { user_id: userId }
        });

        console.log(`📥 Google Users Count for user ${userId}:`, googleUsers.length);
        console.log(`📥 SMTP Accounts Count for user ${userId}:`, smtpAccounts.length);
        console.log(`📥 Microsoft Accounts Count for user ${userId}:`, microsoftUsers.length);

        // Calculate comprehensive metrics
        const metrics = await this.calculateDashboardMetrics(userId, googleUsers, smtpAccounts, microsoftUsers);

        res.json({
            googleUsers,
            smtpAccounts,
            microsoftUsers,
            metrics
        });
    } catch (error) {
        console.error('❌ Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.calculateDashboardMetrics = async (userId, googleUsers, smtpAccounts, microsoftUsers) => {
    try {
        const allAccounts = [...googleUsers, ...smtpAccounts, ...microsoftUsers];
        const accountEmails = allAccounts.map(acc => acc.email);

        // Get email metrics from the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const emailMetrics = await EmailMetric.findAll({
            where: {
                senderEmail: accountEmails,
                sentAt: {
                    [Op.gte]: sevenDaysAgo
                }
            },
            order: [['sentAt', 'DESC']]
        });

        // Calculate comprehensive metrics
        const metrics = {
            overview: this.calculateOverviewMetrics(allAccounts, emailMetrics),
            performance: this.calculatePerformanceMetrics(emailMetrics),
            warmupProgress: this.calculateWarmupProgress(allAccounts),
            recentActivity: this.getRecentActivity(emailMetrics),
            rateLimits: getRateLimitStats()
        };

        return metrics;

    } catch (error) {
        console.error('❌ Error calculating dashboard metrics:', error);
        return this.getFallbackMetrics();
    }
};

exports.calculateOverviewMetrics = (accounts, emailMetrics) => {
    const totalAccounts = accounts.length;
    const activeAccounts = accounts.filter(acc => acc.warmupStatus === 'active').length;
    const pausedAccounts = accounts.filter(acc => acc.warmupStatus === 'paused').length;

    const totalEmails = emailMetrics.length;
    const deliveredEmails = emailMetrics.filter(metric => metric.deliveredInbox).length;
    const repliedEmails = emailMetrics.filter(metric => metric.replied).length;

    const deliveryRate = totalEmails > 0 ? (deliveredEmails / totalEmails * 100).toFixed(1) : 0;
    const replyRate = totalEmails > 0 ? (repliedEmails / totalEmails * 100).toFixed(1) : 0;

    return {
        totalAccounts,
        activeAccounts,
        pausedAccounts,
        totalEmails,
        deliveredEmails,
        repliedEmails,
        deliveryRate: `${deliveryRate}%`,
        replyRate: `${replyRate}%`,
        overallHealth: this.calculateOverallHealth(deliveryRate, replyRate)
    };
};

exports.calculatePerformanceMetrics = (emailMetrics) => {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const recentMetrics = emailMetrics.filter(metric =>
        new Date(metric.sentAt) >= last30Days
    );

    // Daily performance
    const dailyPerformance = this.calculateDailyPerformance(recentMetrics);

    // Account performance
    const accountPerformance = this.calculateAccountPerformance(recentMetrics);

    return {
        dailyPerformance,
        accountPerformance,
        trends: this.calculateTrends(recentMetrics)
    };
};

exports.calculateDailyPerformance = (metrics) => {
    const dailyStats = {};

    metrics.forEach(metric => {
        const date = new Date(metric.sentAt).toDateString();
        if (!dailyStats[date]) {
            dailyStats[date] = { sent: 0, delivered: 0, replied: 0 };
        }

        dailyStats[date].sent++;
        if (metric.deliveredInbox) dailyStats[date].delivered++;
        if (metric.replied) dailyStats[date].replied++;
    });

    return Object.entries(dailyStats).map(([date, stats]) => ({
        date,
        ...stats,
        deliveryRate: ((stats.delivered / stats.sent) * 100).toFixed(1) + '%',
        replyRate: ((stats.replied / stats.sent) * 100).toFixed(1) + '%'
    })).slice(0, 7); // Last 7 days
};

exports.calculateAccountPerformance = (metrics) => {
    const accountStats = {};

    metrics.forEach(metric => {
        const sender = metric.senderEmail;
        if (!accountStats[sender]) {
            accountStats[sender] = { sent: 0, delivered: 0, replied: 0 };
        }

        accountStats[sender].sent++;
        if (metric.deliveredInbox) accountStats[sender].delivered++;
        if (metric.replied) accountStats[sender].replied++;
    });

    return Object.entries(accountStats).map(([email, stats]) => ({
        email,
        ...stats,
        deliveryRate: ((stats.delivered / stats.sent) * 100).toFixed(1) + '%',
        replyRate: ((stats.replied / stats.sent) * 100).toFixed(1) + '%',
        warmupScore: this.calculateWarmupScore(stats)
    }));
};

exports.calculateWarmupProgress = (accounts) => {
    const activeAccounts = accounts.filter(acc => acc.warmupStatus === 'active');

    return {
        totalActive: activeAccounts.length,
        byWarmupDay: this.groupByWarmupDay(activeAccounts),
        averageWarmupDay: this.calculateAverageWarmupDay(activeAccounts),
        progressDistribution: this.calculateProgressDistribution(activeAccounts)
    };
};

exports.groupByWarmupDay = (accounts) => {
    const groups = {};

    accounts.forEach(account => {
        const day = account.warmupDayCount || 0;
        if (!groups[day]) groups[day] = 0;
        groups[day]++;
    });

    return Object.entries(groups).map(([day, count]) => ({
        day: parseInt(day),
        accounts: count
    })).sort((a, b) => a.day - b.day);
};

exports.calculateAverageWarmupDay = (accounts) => {
    if (accounts.length === 0) return 0;

    const totalDays = accounts.reduce((sum, acc) => sum + (acc.warmupDayCount || 0), 0);
    return (totalDays / accounts.length).toFixed(1);
};

exports.calculateProgressDistribution = (accounts) => {
    const total = accounts.length;
    if (total === 0) return { beginners: 0, intermediate: 0, advanced: 0 };

    const beginners = accounts.filter(acc => (acc.warmupDayCount || 0) <= 3).length;
    const intermediate = accounts.filter(acc => (acc.warmupDayCount || 0) > 3 && (acc.warmupDayCount || 0) <= 10).length;
    const advanced = accounts.filter(acc => (acc.warmupDayCount || 0) > 10).length;

    return {
        beginners: Math.round((beginners / total) * 100),
        intermediate: Math.round((intermediate / total) * 100),
        advanced: Math.round((advanced / total) * 100)
    };
};

exports.getRecentActivity = (metrics) => {
    const recent = metrics.slice(0, 10); // Last 10 activities

    return recent.map(metric => ({
        id: metric.id,
        sender: metric.senderEmail,
        receiver: metric.receiverEmail,
        subject: metric.subject,
        sentAt: metric.sentAt,
        status: metric.deliveredInbox ? 'delivered' : 'not_delivered',
        replied: metric.replied,
        folder: metric.deliveryFolder
    }));
};

exports.calculateTrends = (metrics) => {
    if (metrics.length === 0) return { deliveryTrend: 'stable', replyTrend: 'stable' };

    const lastWeek = metrics.filter(metric =>
        new Date(metric.sentAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    const previousWeek = metrics.filter(metric => {
        const date = new Date(metric.sentAt);
        return date >= new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) &&
            date < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    });

    const currentDeliveryRate = this.calculateDeliveryRate(lastWeek);
    const previousDeliveryRate = this.calculateDeliveryRate(previousWeek);

    const currentReplyRate = this.calculateReplyRate(lastWeek);
    const previousReplyRate = this.calculateReplyRate(previousWeek);

    return {
        deliveryTrend: this.calculateTrend(currentDeliveryRate, previousDeliveryRate),
        replyTrend: this.calculateTrend(currentReplyRate, previousReplyRate),
        deliveryChange: (currentDeliveryRate - previousDeliveryRate).toFixed(1),
        replyChange: (currentReplyRate - previousReplyRate).toFixed(1)
    };
};

exports.calculateDeliveryRate = (metrics) => {
    if (metrics.length === 0) return 0;
    const delivered = metrics.filter(metric => metric.deliveredInbox).length;
    return (delivered / metrics.length) * 100;
};

exports.calculateReplyRate = (metrics) => {
    if (metrics.length === 0) return 0;
    const replied = metrics.filter(metric => metric.replied).length;
    return (replied / metrics.length) * 100;
};

exports.calculateTrend = (current, previous) => {
    if (previous === 0) return 'improving';
    const change = ((current - previous) / previous) * 100;

    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
};

exports.calculateOverallHealth = (deliveryRate, replyRate) => {
    const numericDeliveryRate = parseFloat(deliveryRate);
    const numericReplyRate = parseFloat(replyRate);

    if (numericDeliveryRate >= 80 && numericReplyRate >= 20) return 'excellent';
    if (numericDeliveryRate >= 70 && numericReplyRate >= 15) return 'good';
    if (numericDeliveryRate >= 60 && numericReplyRate >= 10) return 'fair';
    return 'needs_attention';
};

exports.calculateWarmupScore = (stats) => {
    const deliveryWeight = 0.6;
    const replyWeight = 0.4;

    const deliveryScore = (stats.delivered / stats.sent) * 100;
    const replyScore = (stats.replied / stats.sent) * 100;

    return Math.round((deliveryScore * deliveryWeight) + (replyScore * replyWeight));
};

exports.getFallbackMetrics = () => {
    return {
        overview: {
            totalAccounts: 0,
            activeAccounts: 0,
            pausedAccounts: 0,
            totalEmails: 0,
            deliveredEmails: 0,
            repliedEmails: 0,
            deliveryRate: '0%',
            replyRate: '0%',
            overallHealth: 'excellent'
        },
        performance: {
            dailyPerformance: [],
            accountPerformance: [],
            trends: {
                deliveryTrend: 'stable',
                replyTrend: 'stable',
                deliveryChange: '0.0',
                replyChange: '0.0'
            }
        },
        warmupProgress: {
            totalActive: 0,
            byWarmupDay: [],
            averageWarmupDay: 0,
            progressDistribution: {
                beginners: 0,
                intermediate: 0,
                advanced: 0
            }
        },
        recentActivity: [],
        rateLimits: getRateLimitStats()
    };
};
// ✅ Delete an email account + related warmup logs for logged-in user
exports.deleteByEmail = async (req, res) => {
    const { email } = req.params;
    const userId = req.user.id;
    console.log(`🗑️ Delete request for email: ${email} by user ${userId}`);

    try {
        // Check if email belongs to this user
        const googleUserExists = await GoogleUser.findOne({
            where: { email, user_id: userId }
        });
        const smtpUserExists = await SmtpAccount.findOne({
            where: { email, user_id: userId }
        });

        if (!googleUserExists && !smtpUserExists) {
            console.log(`⚠️ No account found for ${email} belonging to user ${userId}`);
            return res.status(404).json({ error: `No account records found for ${email}` });
        }

        // Delete from GoogleUser & SMTPAccount
        const deletedGoogle = await GoogleUser.destroy({
            where: { email, user_id: userId }
        });
        const deletedSmtp = await SmtpAccount.destroy({
            where: { email, user_id: userId }
        });

        // Delete related warmup logs
        const deletedLogs = await WarmupLog.destroy({
            where: { sender: email }
        });

        console.log(`✅ Deleted account(s) for: ${email}`);
        console.log(`📊 Deleted ${deletedLogs} warmup logs for sender: ${email}`);

        res.json({
            message: `Account(s) for ${email} and ${deletedLogs} related warmup log(s) deleted successfully`
        });

    } catch (error) {
        console.error('❌ Error deleting by email:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};





// const GoogleUser = require('../models/GoogleUser');
// const SmtpAccount = require('../models/smtpAccounts');

// exports.getDashboardData = async (req, res) => {
//     console.log('✅ Dashboard API hit');
//     try {
//         const googleUsers = await GoogleUser.findAll();
//         const smtpAccounts = await SmtpAccount.findAll();

//         console.log('📥 Google Users Count:', googleUsers.length);
//         console.log('📥 SMTP Accounts Count:', smtpAccounts.length);

//         res.json({ googleUsers, smtpAccounts });
//     } catch (error) {
//         console.error('❌ Error fetching dashboard data:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };

// exports.deleteDashboardData = async (req, res) => {
//     console.log('🗑️ Delete ALL dashboard data request received');
//     try {
//         await GoogleUser.destroy({ where: {} });
//         await SmtpAccount.destroy({ where: {} });

//         console.log('✅ All Google users and SMTP accounts deleted');
//         res.json({ message: 'All dashboard data deleted successfully' });
//     } catch (error) {
//         console.error('❌ Error deleting dashboard data:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };

// exports.deleteByEmail = async (req, res) => {
//     const { email } = req.params;
//     console.log(`🗑️ Delete request for email: ${email}`);
//     try {
//         const deletedGoogle = await GoogleUser.destroy({ where: { email } });
//         const deletedSmtp = await SmtpAccount.destroy({ where: { email } });

//         if (deletedGoogle || deletedSmtp) {
//             console.log(`✅ Deleted records for email: ${email}`);
//             res.json({ message: `Record(s) for ${email} deleted successfully` });
//         } else {
//             console.log(`⚠️ No records found for email: ${email}`);
//             res.status(404).json({ error: `No records found for ${email}` });
//         }
//     } catch (error) {
//         console.error('❌ Error deleting by email:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };
