const GoogleUser = require('../../models/GoogleUser');
const SmtpAccount = require('../../models/smtpAccounts');
const MicrosoftUser = require('../../models/MicrosoftUser');
const EmailMetric = require('../../models/EmailMetric');
const EmailExchange = require('../../models/MailExchange');
const User = require("../../models/userModel")

const { getRateLimitStats } = require('../../workflows/warmupWorkflow');
const { Op } = require("sequelize");

exports.getDashboardData = async (req, res) => {
    console.log('✅ Dashboard API hit');
    try {
        const userId = req.user.id;

        // Fetch accounts - only models that have user_id
        const googleUsers = await GoogleUser.findAll({
            where: { user_id: userId },
            attributes: {
                exclude: ["app_password"] // Exclude sensitive data
            }
        });

        const smtpAccounts = await SmtpAccount.findAll({
            where: { user_id: userId },
            attributes: {
                exclude: ["smtp_pass", "imap_pass"] // Exclude sensitive data
            }
        });

        const microsoftUsers = await MicrosoftUser.findAll({
            where: { user_id: userId },
            attributes: {
                exclude: ["access_token", "refresh_token"]
            }
        });

        // Get email exchanges for user's accounts only
        const userAccountEmails = [
            ...googleUsers.map(acc => acc.email),
            ...smtpAccounts.map(acc => acc.email),
            ...microsoftUsers.map(acc => acc.email)
        ];

        const emailExchanges = await EmailExchange.findAll({
            where: {
                [Op.or]: [
                    { warmupAccount: { [Op.in]: userAccountEmails } },
                    { poolAccount: { [Op.in]: userAccountEmails } }
                ]
            },
            order: [['sentAt', 'DESC']],
            limit: 100 // Limit for performance
        });

        console.log(`📊 Accounts Count for user ${userId}:`, {
            google: googleUsers.length,
            smtp: smtpAccounts.length,
            microsoft: microsoftUsers.length,
            exchanges: emailExchanges.length
        });

        // Calculate comprehensive metrics
        const metrics = await this.calculateDashboardMetrics(
            userId,
            googleUsers,
            smtpAccounts,
            microsoftUsers,
            emailExchanges
        );

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

exports.calculateDashboardMetrics = async (userId, googleUsers, smtpAccounts, microsoftUsers, emailExchanges = []) => {
    try {
        const allAccounts = [...googleUsers, ...smtpAccounts, ...microsoftUsers];

        if (allAccounts.length === 0) {
            console.log('⚠️ No accounts found for user, returning empty metrics');
            return this.getFallbackMetrics();
        }

        const accountEmails = allAccounts.map(acc => acc.email);

        // Get email metrics from the last 7 days for user's accounts only
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

        // Filter exchanges to only include user's accounts
        const userExchanges = emailExchanges.filter(exchange =>
            accountEmails.includes(exchange.warmupAccount) ||
            accountEmails.includes(exchange.poolAccount)
        );

        // Calculate comprehensive metrics
        const metrics = {
            overview: this.calculateOverviewMetrics(allAccounts, emailMetrics),
            performance: this.calculatePerformanceMetrics(emailMetrics, userExchanges),
            warmupProgress: this.calculateWarmupProgress(allAccounts),
            dailyLimits: this.calculateDailyLimits(allAccounts),
            recentActivity: this.getRecentActivity(emailMetrics, userExchanges),
            rateLimits: getRateLimitStats(),
            // NEW: Per-email detailed metrics
            accountDetails: this.calculateAccountDetails(allAccounts, emailMetrics, userExchanges)
        };

        return metrics;

    } catch (error) {
        console.error('❌ Error calculating dashboard metrics:', error);
        return this.getFallbackMetrics();
    }
};

// NEW: Calculate detailed metrics per email account
exports.calculateAccountDetails = (accounts, emailMetrics, userExchanges = []) => {
    return accounts.map(account => {
        const accountEmail = account.email;
        const accountMetrics = emailMetrics.filter(metric => metric.senderEmail === accountEmail);
        const accountExchanges = userExchanges.filter(exchange =>
            exchange.warmupAccount === accountEmail || exchange.poolAccount === accountEmail
        );

        const sentEmails = accountMetrics.length;
        const deliveredEmails = accountMetrics.filter(metric => metric.deliveredInbox).length;
        const repliedEmails = accountMetrics.filter(metric => metric.replied).length;

        const deliveryRate = sentEmails > 0 ? (deliveredEmails / sentEmails * 100).toFixed(1) : 0;
        const replyRate = sentEmails > 0 ? (repliedEmails / sentEmails * 100).toFixed(1) : 0;

        // Exchange statistics for this account
        const sentExchanges = accountExchanges.filter(ex => ex.warmupAccount === accountEmail).length;
        const receivedExchanges = accountExchanges.filter(ex => ex.poolAccount === accountEmail).length;
        const successfulExchanges = accountExchanges.filter(ex =>
            ex.status === 'delivered' || ex.status === 'sent'
        ).length;

        return {
            email: accountEmail,
            provider: account.providerType || account.provider || 'unknown',
            warmupStatus: account.warmupStatus || 'inactive',
            warmupDay: account.warmupDayCount || 0,
            sentToday: account.current_day_sent || 0,
            dailyLimit: account.maxEmailsPerDay || 25,
            usagePercent: Math.min(Math.round(((account.current_day_sent || 0) / (account.maxEmailsPerDay || 25)) * 100), 100),

            // Email performance
            totalSent: sentEmails,
            delivered: deliveredEmails,
            replied: repliedEmails,
            deliveryRate: `${deliveryRate}%`,
            replyRate: `${replyRate}%`,

            // Exchange activity
            exchanges: {
                sent: sentExchanges,
                received: receivedExchanges,
                successful: successfulExchanges,
                successRate: accountExchanges.length > 0 ?
                    ((successfulExchanges / accountExchanges.length) * 100).toFixed(1) + '%' : '0%'
            },

            // Recent activity
            lastActivity: this.getLastActivity(accountMetrics, accountExchanges),
            healthScore: this.calculateAccountHealthScore(deliveryRate, replyRate, account)
        };
    });
};

// NEW: Get last activity timestamp
exports.getLastActivity = (metrics, exchanges) => {
    const allActivities = [...metrics, ...exchanges];
    if (allActivities.length === 0) return null;

    const latestActivity = allActivities.reduce((latest, activity) => {
        const activityDate = new Date(activity.sentAt || activity.createdAt);
        return activityDate > latest ? activityDate : latest;
    }, new Date(0));

    return latestActivity;
};

// NEW: Calculate account health score
exports.calculateAccountHealthScore = (deliveryRate, replyRate, account) => {
    const numericDeliveryRate = parseFloat(deliveryRate);
    const numericReplyRate = parseFloat(replyRate);
    const warmupDay = account.warmupDayCount || 0;

    // Base score on delivery and reply rates
    let score = (numericDeliveryRate * 0.7) + (numericReplyRate * 0.3);

    // Adjust for warmup progress
    if (warmupDay > 14) score *= 1.1; // Bonus for advanced warmup
    else if (warmupDay < 3) score *= 0.9; // Penalty for new accounts

    return Math.min(Math.round(score), 100);
};

// UPDATED: Remove pool-related calculations
exports.calculateOverviewMetrics = (accounts, emailMetrics) => {
    const totalAccounts = accounts.length;
    const activeAccounts = accounts.filter(acc => acc.warmupStatus === 'active').length;
    const pausedAccounts = accounts.filter(acc => acc.warmupStatus === 'paused').length;

    const totalEmails = emailMetrics.length;
    const deliveredEmails = emailMetrics.filter(metric => metric.deliveredInbox).length;
    const repliedEmails = emailMetrics.filter(metric => metric.replied).length;

    // Calculate emails sent today
    const todaySent = accounts.reduce((sum, acc) => sum + (acc.current_day_sent || 0), 0);

    const deliveryRate = totalEmails > 0 ? (deliveredEmails / totalEmails * 100).toFixed(1) : 0;
    const replyRate = totalEmails > 0 ? (repliedEmails / totalEmails * 100).toFixed(1) : 0;

    return {
        totalAccounts,
        activeAccounts,
        pausedAccounts,
        totalEmails,
        deliveredEmails,
        repliedEmails,
        todaySent,
        deliveryRate: `${deliveryRate}%`,
        replyRate: `${replyRate}%`,
        overallHealth: this.calculateOverallHealth(deliveryRate, replyRate)
    };
};

// UPDATED: Remove pool limits
exports.calculateDailyLimits = (accounts) => {
    const accountLimits = accounts.map(acc => ({
        email: acc.email,
        provider: acc.providerType || acc.provider || 'custom',
        current: acc.current_day_sent || 0,
        max: acc.maxEmailsPerDay || 25,
        usagePercent: Math.min(Math.round(((acc.current_day_sent || 0) / (acc.maxEmailsPerDay || 25)) * 100), 100),
        warmupStatus: acc.warmupStatus || 'inactive'
    }));

    return {
        accounts: accountLimits,
        totalUsage: accountLimits.reduce((sum, acc) => sum + acc.current, 0),
        accountsAtLimit: accountLimits.filter(acc => acc.usagePercent >= 100).length,
        accountsActive: accountLimits.filter(acc => acc.current > 0).length
    };
};

// UPDATED: Filter exchanges by user accounts only
exports.calculatePerformanceMetrics = (emailMetrics, userExchanges = []) => {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const recentMetrics = emailMetrics.filter(metric =>
        new Date(metric.sentAt) >= last30Days
    );

    // Calculate exchange statistics for user's accounts only
    const exchangeStats = {
        totalExchanges: userExchanges.length,
        successfulExchanges: userExchanges.filter(ex => ex.status === 'delivered' || ex.status === 'sent').length,
        failedExchanges: userExchanges.filter(ex => ex.status === 'failed').length,
        warmupToPool: userExchanges.filter(ex => ex.direction === 'WARMUP_TO_POOL').length,
        poolToWarmup: userExchanges.filter(ex => ex.direction === 'POOL_TO_WARMUP').length
    };

    // Daily performance
    const dailyPerformance = this.calculateDailyPerformance(recentMetrics);

    // Account performance
    const accountPerformance = this.calculateAccountPerformance(recentMetrics);

    return {
        dailyPerformance,
        accountPerformance,
        exchangeStats,
        trends: this.calculateTrends(recentMetrics)
    };
};

// UPDATED: Use filtered exchanges only
exports.getRecentActivity = (emailMetrics, userExchanges = []) => {
    // Combine both metrics and exchanges for recent activity
    const metricActivities = emailMetrics.slice(0, 10).map(metric => ({
        type: 'email',
        id: metric.id,
        sender: metric.senderEmail,
        receiver: metric.receiverEmail,
        subject: metric.subject,
        sentAt: metric.sentAt,
        status: metric.deliveredInbox ? 'delivered' : 'not_delivered',
        replied: metric.replied,
        folder: metric.deliveryFolder
    }));

    const exchangeActivities = userExchanges.slice(0, 10).map(exchange => ({
        type: 'exchange',
        id: exchange.id,
        warmupAccount: exchange.warmupAccount,
        poolAccount: exchange.poolAccount,
        direction: exchange.direction,
        sentAt: exchange.sentAt,
        status: exchange.status
    }));

    // Combine and sort by date
    const allActivities = [...metricActivities, ...exchangeActivities]
        .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
        .slice(0, 15); // Top 15 most recent

    return allActivities;
};

// Rest of the helper methods remain the same...
exports.calculateWarmupProgress = (accounts) => {
    const activeAccounts = accounts.filter(acc => acc.warmupStatus === 'active');

    return {
        totalActive: activeAccounts.length,
        byWarmupDay: this.groupByWarmupDay(activeAccounts),
        averageWarmupDay: this.calculateAverageWarmupDay(activeAccounts),
        progressDistribution: this.calculateProgressDistribution(activeAccounts),
        dailySending: this.calculateDailySendingStats(activeAccounts)
    };
};

exports.calculateDailySendingStats = (accounts) => {
    const stats = {
        totalSentToday: accounts.reduce((sum, acc) => sum + (acc.current_day_sent || 0), 0),
        accountsAtLimit: accounts.filter(acc => (acc.current_day_sent || 0) >= (acc.maxEmailsPerDay || 25)).length,
        accountsActive: accounts.filter(acc => (acc.current_day_sent || 0) > 0).length
    };

    stats.avgSentPerAccount = accounts.length > 0 ? (stats.totalSentToday / accounts.length).toFixed(1) : 0;

    return stats;
};

exports.calculateAccountPerformance = (metrics) => {
    const accountStats = {};

    metrics.forEach(metric => {
        const sender = metric.senderEmail;
        if (!accountStats[sender]) {
            accountStats[sender] = {
                sent: 0,
                delivered: 0,
                replied: 0,
                lastActivity: metric.sentAt
            };
        }

        accountStats[sender].sent++;
        if (metric.deliveredInbox) accountStats[sender].delivered++;
        if (metric.replied) accountStats[sender].replied++;

        if (new Date(metric.sentAt) > new Date(accountStats[sender].lastActivity)) {
            accountStats[sender].lastActivity = metric.sentAt;
        }
    });

    return Object.entries(accountStats).map(([email, stats]) => ({
        email,
        ...stats,
        deliveryRate: stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) + '%' : '0%',
        replyRate: stats.sent > 0 ? ((stats.replied / stats.sent) * 100).toFixed(1) + '%' : '0%',
        warmupScore: this.calculateWarmupScore(stats),
        activityStatus: this.getActivityStatus(stats.lastActivity)
    }));
};

exports.getActivityStatus = (lastActivity) => {
    if (!lastActivity) return 'inactive';

    const daysSinceActivity = (new Date() - new Date(lastActivity)) / (1000 * 60 * 60 * 24);

    if (daysSinceActivity < 1) return 'active_today';
    if (daysSinceActivity < 3) return 'active_recent';
    if (daysSinceActivity < 7) return 'active_week';
    return 'inactive';
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
        deliveryRate: stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) + '%' : '0%',
        replyRate: stats.sent > 0 ? ((stats.replied / stats.sent) * 100).toFixed(1) + '%' : '0%'
    })).slice(0, 7);
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
    if (stats.sent === 0) return 0;

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
            todaySent: 0,
            deliveryRate: '0%',
            replyRate: '0%',
            overallHealth: 'excellent'
        },
        performance: {
            dailyPerformance: [],
            accountPerformance: [],
            exchangeStats: {
                totalExchanges: 0,
                successfulExchanges: 0,
                failedExchanges: 0,
                warmupToPool: 0,
                poolToWarmup: 0
            },
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
            },
            dailySending: {
                totalSentToday: 0,
                accountsAtLimit: 0,
                accountsActive: 0,
                avgSentPerAccount: 0
            }
        },
        dailyLimits: {
            accounts: [],
            totalUsage: 0,
            accountsAtLimit: 0,
            accountsActive: 0
        },
        recentActivity: [],
        rateLimits: getRateLimitStats(),
        accountDetails: [] // NEW: Empty account details array
    };
};

// UPDATED: Only delete from models that have user_id
exports.deleteByEmail = async (req, res) => {
    const { email } = req.params;
    const userId = req.user.id;
    console.log(`🗑️ Delete request for email: ${email} by user ${userId}`);

    try {
        // Check if email belongs to this user (only in models with user_id)
        const googleUserExists = await GoogleUser.findOne({
            where: { email, user_id: userId }
        });
        const smtpUserExists = await SmtpAccount.findOne({
            where: { email, user_id: userId }
        });
        const microsoftUserExists = await MicrosoftUser.findOne({
            where: { email, user_id: userId }
        });

        if (!googleUserExists && !smtpUserExists && !microsoftUserExists) {
            console.log(`⚠️ No account found for ${email} belonging to user ${userId}`);
            return res.status(404).json({ error: `No account records found for ${email}` });
        }

        // Delete from user-specific models only
        const deletedGoogle = await GoogleUser.destroy({
            where: { email, user_id: userId }
        });
        const deletedSmtp = await SmtpAccount.destroy({
            where: { email, user_id: userId }
        });
        const deletedMicrosoft = await MicrosoftUser.destroy({
            where: { email, user_id: userId }
        });

        const deletedMetrics = await EmailMetric.destroy({
            where: { senderEmail: email }
        });

        console.log(`✅ Deleted account(s) for: ${email}`);

        res.json({
            message: `Account(s) for ${email} and user-specific data deleted successfully`,
            stats: {
                accounts: deletedGoogle + deletedSmtp + deletedMicrosoft,
                metrics: deletedMetrics
            }
        });

    } catch (error) {
        console.error('❌ Error deleting by email:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateGoogleUserOnboard = async (req, res) => {
    try {
        const { phone, company, industry, title } = req.body;
        const { email } = req.params;
        const userId = req.user.id;
        const googleUser = await User.findOne({ where: { email, id: userId, isGoogleAccount: true } });

        if (!googleUser) {
            console.log(`⚠️ No Google user found for email: ${email} and user: ${userId}`);
            return res.status(404).json({ error: 'Google user not found' });
        }

        googleUser.phone = phone || googleUser.phone;
        googleUser.company = company || googleUser.company;
        googleUser.industry = industry || googleUser.industry;
        googleUser.title = title || googleUser.title;

        await googleUser.save();
        console.log(`✅ Updated Google user onboard info for email: ${email}`);
        res.json({ message: 'Google user onboard info updated successfully' });
    }
    catch (error) {
        console.error('❌ Error updating google auth user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
