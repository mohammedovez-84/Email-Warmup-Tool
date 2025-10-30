const getChannel = require('../queues/rabbitConnection');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const EmailPool = require('../models/EmailPool');
const { computeReplyRate } = require('./warmupWorkflow');
const RedisScheduler = require('./redis-scheduler');
const UnifiedWarmupStrategy = require('./unified-strategy');
const { Op } = require('sequelize');

class WarmupScheduler {
    constructor() {
        this.isRunning = false;
        this.scheduledJobs = new Map();
        this.EMAIL_INTERVAL_MS = 15 * 60 * 1000;
        this.TESTING_MODE = process.env.WARMUP_TESTING_MODE === 'true';

        // ADD REDIS PERSISTENCE (only for job recovery, not volume)
        this.redis = new RedisScheduler();
    }

    async scheduleWarmup() {
        if (this.isRunning) {
            console.log('🔄 Warmup scheduler already running...');
            return;
        }

        this.isRunning = true;

        try {
            const channel = await getChannel();
            await channel.assertQueue('warmup_jobs', { durable: true });

            console.log('🚀 Starting BIDIRECTIONAL warmup scheduling...');

            // CRITICAL: Reset daily counts for ALL accounts (warmup + pool)
            await this.resetAllDailyCounts();

            // Recover existing schedules
            await this.recoverScheduledJobs(channel);

            // Schedule new emails with proper volume limits
            await this.scheduleBidirectionalWarmup(channel);

            console.log('✅ Bidirectional warmup scheduling completed');

        } catch (error) {
            console.error('❌ Bidirectional scheduling error:', error);
            this.isRunning = false;
        }
    }

    // NEW: Reset counts for both warmup and pool accounts
    async resetAllDailyCounts() {
        try {
            const today = new Date().toDateString();
            console.log('🔄 Resetting daily counts for all accounts...');

            // Reset pool accounts
            const poolReset = await EmailPool.update(
                {
                    currentDaySent: 0,
                    lastResetDate: new Date()
                },
                {
                    where: {
                        [Op.or]: [
                            { lastResetDate: { [Op.ne]: today } },
                            { lastResetDate: null }
                        ]
                    }
                }
            );
            console.log(`   🏊 Reset ${poolReset[0]} pool accounts`);

            // Reset Google warmup accounts
            const googleReset = await GoogleUser.update(
                {
                    current_day_sent: 0,
                    last_reset_date: new Date()
                },
                {
                    where: {
                        [Op.or]: [
                            { last_reset_date: { [Op.ne]: today } },
                            { last_reset_date: null }
                        ],
                        warmupStatus: 'active'
                    }
                }
            );
            console.log(`   🔵 Reset ${googleReset[0]} Google accounts`);

            // Reset Microsoft warmup accounts
            const microsoftReset = await MicrosoftUser.update(
                {
                    current_day_sent: 0,
                    last_reset_date: new Date()
                },
                {
                    where: {
                        [Op.or]: [
                            { last_reset_date: { [Op.ne]: today } },
                            { last_reset_date: null }
                        ],
                        warmupStatus: 'active'
                    }
                }
            );
            console.log(`   🔴 Reset ${microsoftReset[0]} Microsoft accounts`);

            // Reset SMTP warmup accounts
            const smtpReset = await SmtpAccount.update(
                {
                    current_day_sent: 0,
                    last_reset_date: new Date()
                },
                {
                    where: {
                        [Op.or]: [
                            { last_reset_date: { [Op.ne]: today } },
                            { last_reset_date: null }
                        ],
                        warmupStatus: 'active'
                    }
                }
            );
            console.log(`   ⚡ Reset ${smtpReset[0]} SMTP accounts`);

        } catch (error) {
            console.error('❌ Error resetting daily counts:', error);
        }
    }

    async scheduleBidirectionalWarmup(channel) {
        console.log('📧 Scheduling BIDIRECTIONAL ACCOUNT ↔ POOL exchanges...');

        const activeAccounts = await this.getActiveWarmupAccounts();
        const activePools = await this.getActivePoolAccounts();

        if (activeAccounts.length === 0) {
            console.log('⚠️ No active warmup accounts found');
            this.isRunning = false;
            return;
        }

        if (activePools.length === 0) {
            console.log('⚠️ No active pool accounts found');
            this.isRunning = false;
            return;
        }

        console.log(`📊 Found ${activeAccounts.length} warmup accounts and ${activePools.length} pool accounts`);

        this.clearScheduledJobs();

        for (const warmupAccount of activeAccounts) {
            await this.createAndScheduleBidirectionalPlan(warmupAccount, activePools, channel);
        }

        this.isRunning = false;
    }

    async createAndScheduleBidirectionalPlan(warmupAccount, poolAccounts, channel) {
        console.log(`\n🎯 Creating BIDIRECTIONAL plan for: ${warmupAccount.email}`);

        if (!warmupAccount.email || typeof warmupAccount.email !== 'string') {
            console.error(`❌ SKIPPING: Invalid account data`);
            return;
        }

        try {
            // CHECK WARMUP ACCOUNT VOLUME WITH DAILY TRACKING
            const canWarmupSendMore = await this.canWarmupAccountSendMore(warmupAccount.email);
            const warmupVolume = await this.getWarmupAccountVolume(warmupAccount.email);

            console.log(`   📊 Warmup Volume Check: ${warmupAccount.email}`);
            console.log(`     Daily Limit: ${warmupVolume}, Can Send: ${canWarmupSendMore}`);

            if (!canWarmupSendMore) {
                console.log(`   ⚠️  Daily volume limit reached for ${warmupAccount.email}. Skipping.`);
                return;
            }

            // Filter pools with capacity
            const availablePools = [];
            for (const pool of poolAccounts) {
                const canPoolSendMore = await this.canPoolAccountSendMore(pool.email);
                if (canPoolSendMore) {
                    availablePools.push(pool);
                }
            }

            if (availablePools.length === 0) {
                console.log(`   ⚠️  No pools with capacity available for ${warmupAccount.email}`);
                return;
            }

            console.log(`   🏊 Available pools with capacity: ${availablePools.length}/${poolAccounts.length}`);

            const strategy = new UnifiedWarmupStrategy();
            const replyRate = computeReplyRate(warmupAccount);
            console.log(`   📊 Reply Rate: ${(replyRate * 100).toFixed(1)}%`);

            const plan = await strategy.generateWarmupPlan(warmupAccount, availablePools, replyRate);

            if (plan.error) {
                console.error(`❌ Cannot create plan for ${warmupAccount.email}: ${plan.error}`);
                return;
            }

            if (plan.sequence.length === 0) {
                console.log(`   ⚠️ No emails scheduled for ${warmupAccount.email}`);
                return;
            }

            // ENFORCE WARMUP VOLUME LIMITS with daily tracking
            const remainingWarmupCapacity = await this.getWarmupRemainingCapacity(warmupAccount.email);
            const emailsToSchedule = Math.min(plan.sequence.length, remainingWarmupCapacity);

            if (emailsToSchedule < plan.sequence.length) {
                console.log(`   ⚠️  Reducing schedule from ${plan.sequence.length} to ${emailsToSchedule} emails due to daily limit`);
                plan.sequence = plan.sequence.slice(0, emailsToSchedule);
            }

            console.log(`   📊 Plan: ${emailsToSchedule} emails (${plan.outbound.length} outbound, ${plan.inbound.length} inbound)`);

            // Schedule all emails - FIXED: Call the correct method
            await this.scheduleBidirectionalEmails(plan, channel, warmupAccount.email);

            console.log(`   ✅ ${warmupAccount.email}: ${emailsToSchedule} emails scheduled`);

        } catch (error) {
            console.error(`❌ Error creating plan for ${warmupAccount.email}:`, error.message);
        }
    }

    // ADD THE MISSING METHOD:
    async scheduleBidirectionalEmails(plan, channel, warmupEmail) {
        console.log(`   ⏰ Scheduling ${plan.sequence.length} emails for ${warmupEmail}`);

        for (const emailJob of plan.sequence) {
            await this.scheduleBidirectionalEmail(emailJob, channel, warmupEmail);
        }
    }

    async scheduleBidirectionalEmail(emailJob, channel, warmupEmail) {
        const scheduleTime = new Date(Date.now() + emailJob.scheduleDelay);

        const job = {
            timeSlot: scheduleTime.toISOString(),
            pairs: [{
                ...emailJob,
                replyRate: emailJob.replyRate || 0.25
            }],
            timestamp: new Date().toISOString(),
            coordinated: true,
            individualSchedule: true,
            scheduledTime: scheduleTime.toISOString(),
            warmupAccount: warmupEmail,
            direction: emailJob.direction,
            warmupDay: emailJob.warmupDay,
            isBidirectional: true,
            replyRate: emailJob.replyRate || 0.25
        };

        const jobKey = `${scheduleTime.toISOString()}_${emailJob.senderEmail}_${emailJob.receiverEmail}_${emailJob.direction}`;

        await this.redis.storeScheduledJob(jobKey, job);

        const timeoutId = setTimeout(async () => {
            try {
                console.log(`\n🎯 EXECUTING ${emailJob.direction}: ${scheduleTime.toLocaleTimeString()}`);
                console.log(`   ${emailJob.senderEmail} → ${emailJob.receiverEmail}`);

                // FINAL DATABASE VOLUME CHECK BEFORE EXECUTION
                if (emailJob.direction === 'WARMUP_TO_POOL') {
                    const canWarmupSend = await this.canWarmupAccountSendMore(warmupEmail);
                    if (!canWarmupSend) {
                        console.log(`   ⚠️  WARMUP VOLUME LIMIT REACHED: Skipping execution`);
                        await this.redis.removeScheduledJob(jobKey);
                        return;
                    }
                } else { // POOL_TO_WARMUP
                    const canPoolSend = await this.canPoolAccountSendMore(emailJob.senderEmail);
                    if (!canPoolSend) {
                        console.log(`   ⚠️  POOL CAPACITY EXCEEDED: Skipping execution`);
                        await this.redis.removeScheduledJob(jobKey);
                        return;
                    }
                }

                await channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(job)), {
                    persistent: true,
                    priority: emailJob.direction === 'WARMUP_TO_POOL' ? 4 : 3
                });

                console.log(`   ✅ Bidirectional email queued`);

                // UPDATE USAGE COUNTS
                if (emailJob.direction === 'POOL_TO_WARMUP') {
                    await this.incrementSentCount(emailJob.senderEmail, 1, 'pool');
                } else {
                    await this.incrementSentCount(warmupEmail, 1, 'warmup');
                }

                await this.redis.removeScheduledJob(jobKey);

            } catch (error) {
                console.error('❌ Error queuing bidirectional email:', error);
            }
        }, emailJob.scheduleDelay);

        this.scheduledJobs.set(jobKey, timeoutId);
    }

    // ENHANCED RECOVERY WITH DATABASE VOLUME PROTECTION
    async recoverScheduledJobs(channel) {
        console.log('🔄 Recovering scheduled jobs from Redis...');

        const storedJobs = await this.redis.getAllScheduledJobs();
        const now = new Date();
        let recoveredCount = 0;
        let skippedCount = 0;

        for (const [jobKey, jobData] of Object.entries(storedJobs)) {
            const scheduledTime = new Date(jobData.scheduledTime);

            // Only recover future jobs
            if (scheduledTime > now) {
                const timeUntilExecution = scheduledTime.getTime() - now.getTime();

                if (timeUntilExecution > 0) {
                    // DATABASE VOLUME VALIDATION DURING RECOVERY
                    let canExecute = true;

                    if (jobData.direction === 'WARMUP_TO_POOL') {
                        canExecute = await this.canWarmupAccountSendMore(jobData.warmupAccount);
                        if (!canExecute) {
                            console.log(`   ⚠️  Skipping recovery - warmup volume limit reached: ${jobData.warmupAccount}`);
                        }
                    } else { // POOL_TO_WARMUP
                        const senderEmail = jobData.pairs[0].senderEmail;
                        canExecute = await this.canPoolAccountSendMore(senderEmail);
                        if (!canExecute) {
                            console.log(`   ⚠️  Skipping recovery - pool capacity exceeded: ${senderEmail}`);
                        }
                    }

                    if (!canExecute) {
                        await this.redis.removeScheduledJob(jobKey);
                        skippedCount++;
                        continue;
                    }

                    const timeoutId = setTimeout(async () => {
                        try {
                            console.log(`🎯 RECOVERED EXECUTING ${jobData.direction}: ${scheduledTime.toLocaleTimeString()}`);
                            console.log(`   Processing: ${jobData.pairs[0].senderEmail} → ${jobData.pairs[0].receiverEmail}`);

                            await channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(jobData)), {
                                persistent: true,
                                priority: 5
                            });

                            console.log(`   ✅ Recovered email queued successfully`);

                            // Update pool usage for POOL_TO_WARMUP emails
                            if (jobData.direction === 'POOL_TO_WARMUP') {
                                await this.incrementSentCount(jobData.pairs[0].senderEmail, 1, 'pool');
                            }

                            // Remove from Redis after successful execution
                            await this.redis.removeScheduledJob(jobKey);

                        } catch (error) {
                            console.error('❌ Error queuing recovered email:', error);
                        }
                    }, timeUntilExecution);

                    this.scheduledJobs.set(jobKey, timeoutId);
                    recoveredCount++;
                    console.log(`   ✅ Recovered: ${jobData.pairs[0].senderEmail} → ${jobData.pairs[0].receiverEmail} (${jobData.direction}, in ${Math.round(timeUntilExecution / 60000)}min)`);
                }
            } else {
                // Remove expired jobs
                await this.redis.removeScheduledJob(jobKey);
                console.log(`   🗑️  Removed expired job: ${jobKey}`);
            }
        }

        console.log(`📊 Recovery Complete: ${recoveredCount} recovered, ${skippedCount} skipped (volume limits)`);
    }

    // UPDATED: Get warmup account volume with daily tracking
    async getWarmupAccountVolume(email) {
        try {
            const account = await GoogleUser.findOne({ where: { email } }) ||
                await MicrosoftUser.findOne({ where: { email } }) ||
                await SmtpAccount.findOne({ where: { email } });

            if (!account) return 0;

            // Calculate volume based on warmup progression
            const {
                startEmailsPerDay = 3,
                increaseEmailsPerDay = 3,
                maxEmailsPerDay = 25,
                warmupDayCount = 0
            } = account;

            let volume = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
            volume = Math.min(volume, maxEmailsPerDay);
            volume = Math.max(1, volume);

            return volume;
        } catch (error) {
            console.error(`❌ Error getting warmup volume for ${email}:`, error);
            return 3;
        }
    }

    // NEW: Get remaining capacity for warmup account
    async getWarmupRemainingCapacity(email) {
        try {
            const volume = await this.getWarmupAccountVolume(email);
            const sentToday = await this.getWarmupSentToday(email);
            return Math.max(0, volume - sentToday);
        } catch (error) {
            console.error(`❌ Error getting warmup capacity for ${email}:`, error);
            return 0;
        }
    }

    // NEW: Get how many emails warmup account sent today
    async getWarmupSentToday(email) {
        try {
            const account = await GoogleUser.findOne({ where: { email } }) ||
                await MicrosoftUser.findOne({ where: { email } }) ||
                await SmtpAccount.findOne({ where: { email } });

            return account?.current_day_sent || 0;
        } catch (error) {
            console.error(`❌ Error getting warmup sent count for ${email}:`, error);
            return 0;
        }
    }

    // UPDATED: Check if warmup account can send more
    async canWarmupAccountSendMore(email) {
        const remainingCapacity = await this.getWarmupRemainingCapacity(email);
        return remainingCapacity > 0;
    }

    // UPDATED: Check if pool account can send more
    async canPoolAccountSendMore(email) {
        const capacity = await this.getPoolAccountCapacity(email);
        return capacity > 0;
    }

    async getPoolAccountCapacity(email) {
        try {
            const pool = await EmailPool.findOne({ where: { email, isActive: true } });
            if (!pool) return 0;

            const maxEmailsPerDay = pool.maxEmailsPerDay || 50;
            const currentDaySent = pool.currentDaySent || 0;
            const remaining = maxEmailsPerDay - currentDaySent;

            return Math.max(0, remaining);
        } catch (error) {
            console.error(`❌ Error getting pool capacity for ${email}:`, error);
            return 0;
        }
    }

    // UPDATED: Increment sent count for both warmup and pool accounts
    async incrementSentCount(email, count = 1, accountType = 'pool') {
        try {
            if (accountType === 'pool') {
                const pool = await EmailPool.findOne({ where: { email } });
                if (!pool) return;

                const newCount = (pool.currentDaySent || 0) + count;
                await EmailPool.update(
                    { currentDaySent: newCount },
                    { where: { email } }
                );
            } else {
                // For warmup accounts
                let account = await GoogleUser.findOne({ where: { email } });
                if (account) {
                    const newCount = (account.current_day_sent || 0) + count;
                    await GoogleUser.update(
                        { current_day_sent: newCount },
                        { where: { email } }
                    );
                    return;
                }

                account = await MicrosoftUser.findOne({ where: { email } });
                if (account) {
                    const newCount = (account.current_day_sent || 0) + count;
                    await MicrosoftUser.update(
                        { current_day_sent: newCount },
                        { where: { email } }
                    );
                    return;
                }

                account = await SmtpAccount.findOne({ where: { email } });
                if (account) {
                    const newCount = (account.current_day_sent || 0) + count;
                    await SmtpAccount.update(
                        { current_day_sent: newCount },
                        { where: { email } }
                    );
                    return;
                }
            }
        } catch (error) {
            console.error(`❌ Error incrementing ${accountType} count for ${email}:`, error);
        }
    }

    async initialize() {
        console.log('🚀 Initializing Bidirectional Warmup Scheduler...');
        await this.resetAllDailyCounts(); // Reset counts on startup
    }

    stopScheduler() {
        this.clearScheduledJobs();
        this.isRunning = false;
        console.log('🛑 Bidirectional warmup scheduler stopped');
    }

    ensureNumber(value, defaultValue = 3) {
        if (typeof value === 'number' && !isNaN(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed)) return parsed;
        }
        return defaultValue;
    }

    async triggerImmediateScheduling() {
        try {
            console.log('🚀 TRIGGER: Immediate BIDIRECTIONAL scheduling requested...');
            if (this.isRunning) {
                console.log('🔄 Scheduler already running, waiting for current cycle to complete...');
                return;
            }
            this.clearScheduledJobs();
            await this.scheduleWarmup();
            console.log('✅ TRIGGER: Immediate bidirectional scheduling completed successfully');
        } catch (error) {
            console.error('❌ TRIGGER: Immediate bidirectional scheduling failed:', error);
            throw error;
        }
    }

    async getActiveWarmupAccounts() {
        console.log('🔍 Retrieving active warmup accounts...');

        const googleAccounts = await GoogleUser.findAll({
            where: {
                warmupStatus: 'active',
                is_connected: true
            },
            raw: true
        });

        const smtpAccounts = await SmtpAccount.findAll({
            where: {
                warmupStatus: 'active',
                is_connected: true
            },
            raw: true
        });

        const microsoftAccounts = await MicrosoftUser.findAll({
            where: {
                warmupStatus: 'active',
                is_connected: true
            },
            raw: true
        });

        const allAccounts = [...googleAccounts, ...smtpAccounts, ...microsoftAccounts];

        console.log(`📊 RAW ACCOUNTS FOUND:`);
        console.log(`   Google: ${googleAccounts.length}`);
        console.log(`   SMTP: ${smtpAccounts.length}`);
        console.log(`   Microsoft: ${microsoftAccounts.length}`);
        console.log(`   Total: ${allAccounts.length}`);

        // FILTER OUT INVALID ACCOUNTS
        const validAccounts = allAccounts.filter(account => {
            // Must have email
            if (!account.email || typeof account.email !== 'string') {
                console.log(`   ❌ Filtered out: No valid email - ${JSON.stringify(account)}`);
                return false;
            }

            // Must have proper email format
            if (!account.email.includes('@')) {
                console.log(`   ❌ Filtered out: Invalid email format - ${account.email}`);
                return false;
            }

            // For SMTP accounts, must have required fields
            if (account.smtp_host && (!account.smtp_pass && !account.smtpPassword)) {
                console.log(`   ❌ Filtered out: SMTP account missing password - ${account.email}`);
                return false;
            }

            // For Google accounts, must have app password or OAuth tokens
            if ((account.provider === 'google' || account.email.includes('@gmail.com')) &&
                !account.app_password && !account.access_token) {
                console.log(`   ❌ Filtered out: Google account missing credentials - ${account.email}`);
                return false;
            }

            return true;
        });

        console.log(`✅ VALID ACCOUNTS AFTER FILTERING: ${validAccounts.length}`);

        // Log valid accounts
        validAccounts.forEach(account => {
            console.log(`   ✅ ${account.email} (${account.provider || 'unknown'})`);
        });

        return validAccounts;
    }

    async getActivePoolAccounts() {
        const poolAccounts = await EmailPool.findAll({
            where: { isActive: true }
        });

        console.log(`🏊 Active pool accounts: ${poolAccounts.length}`);
        poolAccounts.forEach(pool => {
            const remainingCapacity = pool.maxEmailsPerDay - (pool.currentDaySent || 0);
            console.log(`   ${pool.email} (${pool.providerType}) - ${pool.currentDaySent || 0}/${pool.maxEmailsPerDay} sent today (${remainingCapacity} remaining)`);
        });

        return poolAccounts;
    }

    async getAvailablePoolsWithCapacity(poolAccounts, warmupAccount = null) {
        const availablePools = [];
        const today = new Date().toDateString();

        for (const pool of poolAccounts) {
            // Reset daily count if it's a new day
            if (pool.lastResetDate && new Date(pool.lastResetDate).toDateString() !== today) {
                pool.currentDaySent = 0;
                pool.lastResetDate = new Date();
                await this.resetPoolDailyCount(pool.email);
            }

            // Check if pool has capacity
            const currentSent = pool.currentDaySent || 0;
            const maxAllowed = pool.maxEmailsPerDay || 50;

            if (currentSent < maxAllowed) {
                availablePools.push(pool);
            }
        }

        // ENHANCEMENT: Sort pools by usage for better distribution
        return this.sortPoolsByUsage(availablePools, warmupAccount);
    }

    sortPoolsByUsage(pools, currentWarmupAccount = null) {
        return pools.sort((a, b) => {
            // Priority 1: Pools with lower daily usage
            const usageA = a.currentDaySent || 0;
            const usageB = b.currentDaySent || 0;

            if (usageA !== usageB) {
                return usageA - usageB; // Lower usage first
            }

            // Priority 2: Round-robin for equal usage
            const indexA = a.roundRobinIndex || 0;
            const indexB = b.roundRobinIndex || 0;
            return indexA - indexB;
        });
    }

    async resetPoolDailyCount(poolEmail) {
        try {
            await EmailPool.update(
                {
                    currentDaySent: 0,
                    lastResetDate: new Date()
                },
                { where: { email: poolEmail } }
            );
        } catch (error) {
            console.error(`❌ Error resetting pool daily count for ${poolEmail}:`, error);
        }
    }

    getSenderType(sender) {
        if (sender.roundRobinIndexGoogle !== undefined || sender.provider === 'google') {
            return 'google';
        } else if (sender.roundRobinIndexMicrosoft !== undefined || sender.provider === 'microsoft') {
            return 'microsoft';
        } else if (sender.roundRobinIndexCustom !== undefined || sender.smtp_host) {
            return 'smtp';
        }
        return 'unknown';
    }

    clearScheduledJobs() {
        for (const [timeString, timeoutId] of this.scheduledJobs) {
            clearTimeout(timeoutId);
        }
        this.scheduledJobs.clear();
    }
}

// Update your existing exports
const schedulerInstance = new WarmupScheduler();

// Initialize when module loads
schedulerInstance.initialize().catch(console.error);

module.exports = {
    scheduleWarmup: () => schedulerInstance.scheduleWarmup(),
    stopScheduler: () => schedulerInstance.stopScheduler(),
    WarmupScheduler,
    triggerImmediateScheduling: () => schedulerInstance.triggerImmediateScheduling(),
};