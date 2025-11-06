const getChannel = require('../../queues/rabbitConnection');
const GoogleUser = require('../../models/GoogleUser');
const MicrosoftUser = require('../../models/MicrosoftUser');
const SmtpAccount = require('../../models/smtpAccounts');
const EmailPool = require('../../models/EmailPool');
const { computeReplyRate } = require('../../workflows/warmupWorkflow');
const RedisScheduler = require('../redis/redis-scheduler');
const UnifiedWarmupStrategy = require('./unified-strategy');

const VolumeEnforcement = require('../volume/volume-enforcement');
const EmailExchange = require('../../models/MailExchange');

class WarmupScheduler {
    constructor() {
        this.isRunning = false;
        this.scheduledJobs = new Map();
        this.EMAIL_INTERVAL_MS = 15 * 60 * 1000;
        this.TESTING_MODE = process.env.WARMUP_TESTING_MODE === 'true';

        // Track server startup to prevent duplicate scheduling
        this.serverStartTime = new Date();
        this.recoveryCompleted = false;
        this.lastSchedulingTime = 0;
        this.SCHEDULING_COOLDOWN_MS = 5 * 60 * 1000;

        // Redis persistence
        this.redis = new RedisScheduler();


        this.volumeEnforcement = new VolumeEnforcement();
    }

    async initialize() {
        console.log('🚀 Initializing Bidirectional Warmup Scheduler...');

        try {
            // 🚨 FIRST: Initialize volume enforcement with retry logic
            await this.volumeEnforcement.initialize(); // ✅ FIX: Use this.volumeEnforcement

            // 🚨 SECOND: Wait a bit for everything to stabilize
            await this.delay(2000);

            // 🚨 THIRD: Sync volume with database
            await this.syncVolumeWithDatabase();

            // 🚨 FOURTH: Clear any stale jobs from previous server runs
            await this.cleanupStaleJobs();

            console.log('✅ Warmup scheduler started successfully');
        } catch (error) {
            console.error('❌ Warmup scheduler initialization failed:', error);
        }
    }
    // 🚨 NEW: Utility delay function
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 🚨 IMPROVED: Safe volume sync
    async syncVolumeWithDatabase() {
        try {
            console.log('🔄 Syncing volume counts with database...');

            // Add a small delay to ensure tables are ready
            await this.delay(1000);

            const activeAccounts = await this.getActiveWarmupAccounts();
            const activePools = await this.getActivePoolAccounts();

            let syncedCount = 0;

            for (const account of activeAccounts) {
                try {
                    const summary = await this.volumeEnforcement.getDailySummary(account.email, 'warmup');
                    console.log(`   📊 ${account.email}: ${summary.sentToday}/${summary.volumeLimit} (${summary.percentage}%)`);
                    syncedCount++;
                } catch (error) {
                    console.log(`   ⚠️ Could not sync ${account.email}: ${error.message}`);
                }
            }

            for (const pool of activePools) {
                try {
                    const summary = await this.volumeEnforcement.getDailySummary(pool.email, 'pool');
                    console.log(`   🏊 ${pool.email}: ${summary.sentToday}/${summary.volumeLimit} (${summary.percentage}%)`);
                    syncedCount++;
                } catch (error) {
                    console.log(`   ⚠️ Could not sync pool ${pool.email}: ${error.message}`);
                }
            }

            console.log(`✅ Volume sync completed: ${syncedCount} accounts synchronized`);

        } catch (error) {
            console.error('❌ Volume sync error:', error);
        }
    }


    async scheduleBidirectionalWarmup(channel) {
        // Check cooldown period
        const timeSinceLastScheduling = Date.now() - this.lastSchedulingTime;
        if (timeSinceLastScheduling < this.SCHEDULING_COOLDOWN_MS) {
            console.log(`⏸️ Skipping scheduling - in cooldown period`);
            this.isRunning = false;


            return 0;
        }

        console.log('📧 GLOBAL SCHEDULING: Finding accounts needing emails...');

        const activeAccounts = await this.getActiveWarmupAccounts();
        const activePools = await this.getActivePoolAccounts();

        if (activeAccounts.length === 0 || activePools.length === 0) {
            console.log('⚠️ No active accounts or pools found');
            this.isRunning = false;


            return 0;
        }

        console.log(`📊 Found ${activeAccounts.length} warmup accounts and ${activePools.length} pool accounts`);

        this.clearScheduledJobs();

        // 🚨 GET VOLUME STATUS BEFORE SCHEDULING
        console.log('\n🔍 PRE-SCHEDULING VOLUME CHECK:');
        const accountsWithCapacity = await this.filterAccountsWithCapacity(activeAccounts, activePools);

        if (accountsWithCapacity.length === 0) {
            console.log('🚫 No accounts with capacity available for scheduling');
            this.isRunning = false;


            return 0;
        }

        // Filter out recently incremental accounts
        const accountsForGlobalScheduling = await this.filterOutRecentlyIncrementalAccounts(accountsWithCapacity);

        if (accountsForGlobalScheduling.length === 0) {
            console.log('💤 All capable accounts were recently handled by incremental scheduling');
            this.isRunning = false;


            return 0;
        }

        console.log(`🎯 Global scheduling: ${accountsForGlobalScheduling.length} accounts`);

        let totalScheduled = 0;
        let scheduledPerAccount = new Map();

        // 🚨 SCHEDULE FOR EACH ACCOUNT
        for (const warmupAccount of accountsForGlobalScheduling) {
            const scheduledCount = await this.createAndScheduleBidirectionalPlan(warmupAccount, activePools, channel);
            totalScheduled += scheduledCount;
            scheduledPerAccount.set(warmupAccount.email, scheduledCount);

            console.log(`   📝 ${warmupAccount.email}: ${scheduledCount} emails scheduled`);
        }

        this.lastSchedulingTime = Date.now();
        this.isRunning = false;

        // 🚨 COMPREHENSIVE VOLUME ACKNOWLEDGEMENT AFTER SCHEDULING
        console.log(`\n🎉 SCHEDULING COMPLETED: ${totalScheduled} total emails scheduled`);

        // Log per-account breakdown
        if (scheduledPerAccount.size > 0) {
            console.log('📋 PER-ACCOUNT SCHEDULING BREAKDOWN:');
            for (const [email, count] of scheduledPerAccount) {
                console.log(`   ├── ${email}: ${count} emails`);
            }
        }




        return totalScheduled;
    }

    async getAccountVolumeLimit(email, accountType = 'warmup') {
        try {
            const limit = await this.getAccountVolumeLimitInternal(email, accountType);

            // Only run debug if there's a count mismatch (optional - can be removed)
            const sentToday = await this.getSentTodayCount(email, accountType);
            if (sentToday > limit) {
                console.log(`🚨 COUNT MISMATCH: ${email} has ${sentToday} sent but limit is ${limit}`);
                // You can call debug here if needed, but it might break the flow
            }

            return limit;

        } catch (error) {
            console.error(`❌ Volume calculation error for ${email}:`, error);
            return 3; // Safe default
        }
    }

    // In your WarmupScheduler - replace the current volume calculation
    async getAccountVolumeLimitInternal(email, accountType = 'warmup') {
        try {
            if (accountType === 'pool') {
                const pool = await EmailPool.findOne({ where: { email } });
                const limit = pool?.maxEmailsPerDay || 50;
                console.log(`📊 POOL LIMIT: ${email} - ${limit}`);
                return limit;
            }

            const account = await GoogleUser.findOne({ where: { email } }) ||
                await MicrosoftUser.findOne({ where: { email } }) ||
                await SmtpAccount.findOne({ where: { email } });

            if (!account) {
                console.log(`❌ Account not found: ${email}`);
                return 3;
            }

            // 🎯 GET ACTUAL REPLY METRICS FROM REPLY_TRACKING TABLE
            const replyMetrics = await this.getReplyMetrics(email);

            // 🎯 CALCULATE BASE VOLUME (your existing logic)
            const startEmailsPerDay = this.ensureNumber(
                account.startEmailsPerDay || account.start_emails_per_day || 3,
                3
            );
            const increaseEmailsPerDay = this.ensureNumber(
                account.increaseEmailsPerDay || account.increase_emails_per_day || 3,
                3
            );
            const maxEmailsPerDay = this.ensureNumber(
                account.maxEmailsPerDay || account.max_emails_per_day || 25,
                25
            );
            const warmupDayCount = this.ensureNumber(
                account.warmupDayCount || account.warmup_day_count || 0,
                0
            );

            let volume = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
            volume = Math.min(volume, maxEmailsPerDay);
            volume = Math.min(volume, 25);
            volume = Math.max(1, volume);

            // 🎯 APPLY REPLY-BASED ADJUSTMENTS
            const adjustedVolume = this.applyReplyBasedAdjustments(volume, replyMetrics, warmupDayCount);

            console.log(`📈 REPLY-DRIVEN VOLUME for ${email}:`);
            console.log(`   ├── Base Volume: ${volume} (day ${warmupDayCount})`);
            console.log(`   ├── Actual Reply Rate: ${(replyMetrics.replyRate * 100).toFixed(1)}%`);
            console.log(`   ├── Total Replies: ${replyMetrics.totalReplies}`);
            console.log(`   ├── Adjustment: ${replyMetrics.adjustment > 0 ? '+' : ''}${replyMetrics.adjustment}`);
            console.log(`   └── Final Volume: ${adjustedVolume}`);

            return adjustedVolume;

        } catch (error) {
            console.error(`❌ Internal volume calculation error for ${email}:`, error);
            return 3;
        }
    }

    // 🎯 NEW: Get actual reply metrics from database
    async getReplyMetrics(email, days = 3) {
        try {
            const { Op } = require('sequelize');
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // Count emails sent in last X days
            const sentEmails = await EmailExchange.count({
                where: {
                    warmupAccount: email,
                    sentAt: { [Op.gte]: startDate },
                    direction: 'WARMUP_TO_POOL'
                }
            });

            // Count replies received in last X days
            const replies = await ReplyTracking.count({
                where: {
                    originalSender: email,
                    repliedAt: { [Op.gte]: startDate }
                }
            });

            const replyRate = sentEmails > 0 ? replies / sentEmails : 0;

            return {
                totalReplies: replies,
                totalSent: sentEmails,
                replyRate: replyRate,
                adjustment: this.calculateReplyAdjustment(replyRate, replies)
            };

        } catch (error) {
            console.error(`❌ Error getting reply metrics for ${email}:`, error);
            return { totalReplies: 0, totalSent: 0, replyRate: 0, adjustment: 0 };
        }
    }

    // 🎯 NEW: Calculate volume adjustment based on replies
    calculateReplyAdjustment(replyRate, totalReplies) {
        let adjustment = 0;

        // 🎯 BASED ON REPLY RATE
        if (replyRate > 0.4) {
            adjustment += 3; // High engagement - boost volume
        } else if (replyRate > 0.25) {
            adjustment += 2; // Good engagement
        } else if (replyRate > 0.15) {
            adjustment += 1; // Average engagement
        } else if (replyRate > 0.05) {
            adjustment += 0; // Neutral
        } else {
            adjustment -= 1; // Low engagement - reduce volume
        }

        // 🎯 BASED ON TOTAL REPLY COUNT (confidence)
        if (totalReplies >= 10) {
            adjustment += 2; // High confidence
        } else if (totalReplies >= 5) {
            adjustment += 1; // Medium confidence
        } else if (totalReplies === 0) {
            adjustment -= 1; // No data - be conservative
        }

        return adjustment;
    }

    // 🎯 NEW: Apply adjustments to volume
    applyReplyBasedAdjustments(baseVolume, replyMetrics, warmupDayCount) {
        let adjustedVolume = baseVolume + replyMetrics.adjustment;

        // 🎯 DIFFERENT STRATEGIES BASED ON WARMUP STAGE
        if (warmupDayCount <= 2) {
            // Early stage: Be more conservative with adjustments
            adjustedVolume = Math.max(1, Math.min(8, adjustedVolume));
        } else if (warmupDayCount <= 7) {
            // Mid stage: Moderate adjustments
            adjustedVolume = Math.max(3, Math.min(20, adjustedVolume));
        } else {
            // Established: Full adjustments
            adjustedVolume = Math.max(5, Math.min(25, adjustedVolume));
        }

        // Ensure we don't go below minimum or above maximum reasonable limits
        adjustedVolume = Math.max(1, Math.min(25, adjustedVolume));

        return adjustedVolume;
    }


    async cleanupStaleJobs() {
        try {
            console.log('🧹 Cleaning up stale jobs from previous server runs...');
            const storedJobs = await this.redis.getAllScheduledJobs();
            const now = new Date();
            let cleanedCount = 0;
            let keptCount = 0;

            for (const [jobKey, jobData] of Object.entries(storedJobs)) {
                const scheduledTime = new Date(jobData.scheduledTime);
                const isFutureJob = scheduledTime > now;
                const isRecentJob = (now - scheduledTime) < (24 * 60 * 60 * 1000);

                if (isFutureJob && isRecentJob) {
                    keptCount++;
                } else {
                    await this.redis.removeScheduledJob(jobKey);
                    cleanedCount++;
                }
            }

            console.log(`📊 Stale job cleanup: ${cleanedCount} removed, ${keptCount} kept`);
        } catch (error) {
            console.error('❌ Error cleaning up stale jobs:', error);
        }
    }

    clearScheduledJobs() {
        for (const [timeString, timeoutId] of this.scheduledJobs) {
            clearTimeout(timeoutId);
        }
        this.scheduledJobs.clear();
    }

    async cleanupScheduledJobsForAccount(email) {
        try {
            console.log(`🧹 Cleaning up scheduled jobs for: ${email}`);
            let removedCount = 0;

            const storedJobs = await this.redis.getAllScheduledJobs();
            for (const [jobKey, jobData] of Object.entries(storedJobs)) {
                if (jobData.warmupAccount === email) {
                    await this.redis.removeScheduledJob(jobKey);
                    removedCount++;
                }
            }

            for (const [jobKey, timeoutId] of this.scheduledJobs) {
                if (jobKey.includes(email)) {
                    clearTimeout(timeoutId);
                    this.scheduledJobs.delete(jobKey);
                    removedCount++;
                }
            }

            console.log(`✅ Cleanup complete: Removed ${removedCount} jobs for ${email}`);
            return removedCount;
        } catch (error) {
            console.error(`❌ Error cleaning up jobs for ${email}:`, error);
            return 0;
        }
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

            // 🚨 RECOVER EXISTING JOBS FIRST (only if not already recovered)
            if (!this.recoveryCompleted) {
                await this.recoverScheduledJobs(channel);
                this.recoveryCompleted = true;
            }

            // Schedule new emails with proper volume limits
            await this.scheduleBidirectionalWarmup(channel);

            console.log('✅ Bidirectional warmup scheduling completed');

        } catch (error) {
            console.error('❌ Bidirectional scheduling error:', error);
            this.isRunning = false;
        }
    }



    // 🚨 NEW: Filter out accounts that were recently scheduled incrementally
    async filterOutRecentlyIncrementalAccounts(accountsWithCapacity) {
        const recentlyScheduled = await this.getRecentlyIncrementallyScheduledAccounts();
        const filteredAccounts = [];

        for (const account of accountsWithCapacity) {
            // Check if this account was scheduled incrementally in the last 2 hours
            const wasRecentlyIncremental = recentlyScheduled.has(account.email);

            if (wasRecentlyIncremental) {
                console.log(`   ⏩ ${account.email} - Skipped (recently incremental)`);
            } else {
                filteredAccounts.push(account);
                console.log(`   ✅ ${account.email} - Available for global scheduling`);
            }
        }

        return filteredAccounts;
    }


    async getRecentlyIncrementallyScheduledAccounts() {
        const recentlyScheduled = new Set();
        try {
            const allJobs = await this.redis.getAllScheduledJobs();

            for (const [jobKey, jobData] of Object.entries(allJobs)) {
                if (jobKey.startsWith('incremental:') && jobData.email) {
                    const markedAt = new Date(jobData.scheduledAt || jobData.markedAt);
                    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

                    if (markedAt > twoHoursAgo) {
                        recentlyScheduled.add(jobData.email);
                    } else {
                        await this.redis.removeScheduledJob(jobKey);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error getting incremental accounts:', error);
        }

        return recentlyScheduled;
    }

    // Update the markAccountAsIncrementallyScheduled method
    async markAccountAsIncrementallyScheduled(email) {
        try {
            // 🚨 DON'T mark as incremental if it's a first-time warmup
            const account = await this.getAccountByEmail(email);
            const isFirstTimeWarmup = (account.warmupDayCount || 0) <= 1;

            if (isFirstTimeWarmup) {
                console.log(`🎯 First-time warmup ${email} - skipping incremental marking`);
                return true;
            }

            const key = `incremental:${email}`;
            const incrementalData = {
                email: email,
                scheduledAt: new Date().toISOString(),
                type: 'incremental',
                markedAt: Date.now(),
                warmupDayCount: account.warmupDayCount || 0 // Store day count for reference
            };

            await this.redis.storeScheduledJob(key, incrementalData);
            console.log(`📝 Marked ${email} as incrementally scheduled (day ${account.warmupDayCount || 0})`);
            return true;
        } catch (error) {
            console.error(`❌ Error marking incremental scheduling for ${email}:`, error);
            return false;
        }
    }

    // Add helper method to get account by email
    async getAccountByEmail(email) {
        // Check all account types
        const [google, smtp, microsoft] = await Promise.all([
            GoogleUser.findOne({ where: { email } }),
            SmtpAccount.findOne({ where: { email } }),
            MicrosoftUser.findOne({ where: { email } })
        ]);

        return google || smtp || microsoft;
    }

    async filterAccountsWithCapacity(warmupAccounts, poolAccounts) {
        const accountsWithCapacity = [];

        for (const warmupAccount of warmupAccounts) {
            const warmupSummary = await this.volumeEnforcement.getDailySummary(warmupAccount.email, 'warmup');

            if (warmupSummary.canSendMore) {
                // Check if there are any pools that can send to this warmup account
                const availablePools = await this.getAvailablePoolsForWarmup(poolAccounts, warmupAccount.email);

                if (availablePools.length > 0) {
                    accountsWithCapacity.push(warmupAccount);
                    console.log(`✅ ${warmupAccount.email} - Capacity: ${warmupSummary.remaining} emails, Available pools: ${availablePools.length}`);
                } else {
                    console.log(`⚠️ ${warmupAccount.email} - Has capacity but no available pools`);
                }
            } else {
                console.log(`🚫 ${warmupAccount.email} - No capacity (${warmupSummary.sentToday}/${warmupSummary.volumeLimit})`);
            }
        }

        return accountsWithCapacity;
    }

    async getAvailablePoolsForWarmup(poolAccounts, warmupEmail) {
        const availablePools = [];

        for (const pool of poolAccounts) {
            const poolSummary = await this.volumeEnforcement.getDailySummary(pool.email, 'pool');

            if (poolSummary.canSendMore) {
                // Also check if warmup account can receive (hasn't hit inbound limit)
                const warmupInboundSummary = await this.volumeEnforcement.getDailySummary(warmupEmail, 'warmup');
                if (warmupInboundSummary.canSendMore) {
                    availablePools.push(pool);
                }
            }
        }

        return availablePools;
    }

    async createAndScheduleBidirectionalPlan(warmupAccount, poolAccounts, channel) {
        console.log(`\n🎯 CREATING BIDIRECTIONAL PLAN FOR: ${warmupAccount.email}`);

        try {
            // Get current volume status
            const warmupSummary = await this.volumeEnforcement.getDailySummary(warmupAccount.email, 'warmup');

            if (!warmupSummary.canSendMore) {
                console.log(`   🚫 WARMUP BLOCKED: ${warmupAccount.email} has NO capacity`);
                await this.cleanupScheduledJobsForAccount(warmupAccount.email);
                return 0;
            }

            // Get available pools
            const availablePools = await this.getAvailablePoolsForWarmup(poolAccounts, warmupAccount.email);

            if (availablePools.length === 0) {
                console.log(`   ⚠️  NO AVAILABLE POOLS`);
                return 0;
            }

            console.log(`   🏊 AVAILABLE POOLS: ${availablePools.length}`);

            // Generate plan
            const strategy = new UnifiedWarmupStrategy();
            const replyRate = computeReplyRate(warmupAccount);
            const plan = await strategy.generateWarmupPlan(warmupAccount, availablePools, replyRate);

            if (plan.error || !plan.sequence || plan.sequence.length === 0) {
                console.log(`   ⚠️  NO VALID PLAN: ${plan.error || 'Empty sequence'}`);
                return 0;
            }

            console.log(`   📧 PLAN GENERATED: ${plan.sequence.length} emails total`);

            // 🎯 FIX: Use the already randomized sequence from the strategy
            const randomizedSequence = plan.sequence;

            // Separate emails by direction for logging only
            const outboundEmails = randomizedSequence.filter(job => job.direction === 'WARMUP_TO_POOL');
            const inboundEmails = randomizedSequence.filter(job => job.direction === 'POOL_TO_WARMUP');

            console.log(`   🔄 RANDOMIZED BIDIRECTIONAL BREAKDOWN:`);
            console.log(`      ├── Outbound (WARMUP→POOL): ${outboundEmails.length}`);
            console.log(`      └── Inbound (POOL→WARMUP): ${inboundEmails.length}`);

            // Apply volume limits to the randomized sequence
            const warmupMaxToSchedule = await this.volumeEnforcement.getMaxEmailsToSchedule(warmupAccount.email, 'warmup');

            let totalInboundCapacity = 0;
            const poolCapacities = new Map();

            for (const pool of availablePools) {
                const poolCapacity = await this.volumeEnforcement.getMaxEmailsToSchedule(pool.email, 'pool');
                poolCapacities.set(pool.email, poolCapacity);
                totalInboundCapacity += poolCapacity;
            }

            console.log(`   📊 CAPACITY ANALYSIS:`);
            console.log(`      ├── Warmup can send: ${warmupMaxToSchedule} emails`);
            console.log(`      └── Pools can send: ${totalInboundCapacity} emails total`);

            // 🎯 FIX: Apply volume limits while preserving randomization
            const volumeLimitedSequence = this.applyVolumeLimitsToRandomizedSequence(
                randomizedSequence,
                warmupMaxToSchedule,
                poolCapacities
            );

            console.log(`   📦 VOLUME LIMITED RANDOMIZED SEQUENCE: ${volumeLimitedSequence.length} emails`);

            // 🎯 FIX: Schedule emails in the randomized order
            let totalScheduled = 0;
            const poolUsage = new Map();

            console.log(`   🚀 SCHEDULING RANDOMIZED EMAIL SEQUENCE...`);
            for (const emailJob of volumeLimitedSequence) {
                const scheduled = await this.scheduleSingleEmailWithEnforcement(emailJob, channel, warmupAccount.email);
                if (scheduled) {
                    totalScheduled++;

                    // Track pool usage for inbound emails
                    if (emailJob.direction === 'POOL_TO_WARMUP') {
                        const poolEmail = emailJob.senderEmail;
                        const currentUsage = poolUsage.get(poolEmail) || 0;
                        poolUsage.set(poolEmail, currentUsage + 1);
                    }
                }
            }

            console.log(`   ✅ FINAL SCHEDULED: ${totalScheduled} randomized bidirectional exchanges`);
            console.log(`   📊 Pool usage:`, Object.fromEntries(poolUsage));

            return totalScheduled;

        } catch (error) {
            console.error(`❌ BIDIRECTIONAL SCHEDULING FAILED for ${warmupAccount.email}:`, error.message);
            return 0;
        }
    }

    // In WarmupScheduler - REPLACE applyVolumeLimitsToRandomizedSequence
    applyVolumeLimitsToRandomizedSequence(randomizedSequence, warmupMaxToSchedule, poolCapacities) {
        const limitedSequence = [];
        let outboundScheduled = 0;
        const poolUsage = new Map();

        console.log(`   🎯 Applying volume limits to INTERLEAVED sequence...`);

        // 🎯 NEW: Preserve the interleaved pattern while applying limits
        for (const emailJob of randomizedSequence) {
            if (emailJob.direction === 'WARMUP_TO_POOL') {
                // Check warmup outbound limit
                if (outboundScheduled < warmupMaxToSchedule) {
                    limitedSequence.push(emailJob);
                    outboundScheduled++;
                } else {
                    console.log(`   🚫 Outbound limit reached: ${outboundScheduled}/${warmupMaxToSchedule}`);
                }
            } else if (emailJob.direction === 'POOL_TO_WARMUP') {
                // Check pool inbound limit
                const poolEmail = emailJob.senderEmail;
                const currentUsage = poolUsage.get(poolEmail) || 0;
                const poolCapacity = poolCapacities.get(poolEmail) || 0;

                if (currentUsage < poolCapacity) {
                    limitedSequence.push(emailJob);
                    poolUsage.set(poolEmail, currentUsage + 1);
                } else {
                    console.log(`   🚫 Pool ${poolEmail} limit reached: ${currentUsage}/${poolCapacity}`);
                }
            }
        }

        // 🎯 NEW: Log the final interleaved pattern
        const finalOutbound = limitedSequence.filter(job => job.direction === 'WARMUP_TO_POOL').length;
        const finalInbound = limitedSequence.filter(job => job.direction === 'POOL_TO_WARMUP').length;

        console.log(`   ✅ Volume-limited INTERLEAVED sequence: ${limitedSequence.length} emails`);
        console.log(`      ├── Outbound: ${finalOutbound}/${warmupMaxToSchedule}`);
        console.log(`      └── Inbound: ${finalInbound} from ${poolUsage.size} pools`);
        console.log(`      📊 Pattern: ${this.getSequencePattern(limitedSequence)}`);

        return limitedSequence;
    }

    // 🎯 NEW: Helper to visualize the sequence pattern
    getSequencePattern(sequence) {
        if (sequence.length === 0) return "Empty";

        const pattern = sequence.map(job =>
            job.direction === 'WARMUP_TO_POOL' ? 'OUT' : 'IN'
        ).join(' → ');

        return pattern;
    }
    async scheduleSingleEmailWithEnforcement(emailJob, channel, warmupEmail) {
        try {
            const targetEmail = emailJob.direction === 'WARMUP_TO_POOL' ? warmupEmail : emailJob.senderEmail;
            const targetType = emailJob.direction === 'WARMUP_TO_POOL' ? 'warmup' : 'pool';

            // 🚨 CRITICAL: Check capacity before scheduling
            const canSchedule = await this.volumeEnforcement.canAccountSendEmail(targetEmail, targetType);

            if (!canSchedule) {
                console.log(`   🚫 SCHEDULING BLOCKED: ${targetEmail} has no capacity`);
                return false;
            }

            const scheduleTime = new Date(Date.now() + emailJob.scheduleDelay);
            const jobKey = `${scheduleTime.toISOString()}_${emailJob.senderEmail}_${emailJob.receiverEmail}_${emailJob.direction}`;

            const job = {
                timeSlot: scheduleTime.toISOString(),
                pairs: [emailJob],
                timestamp: new Date().toISOString(),
                scheduledTime: scheduleTime.toISOString(),
                warmupAccount: warmupEmail,
                direction: emailJob.direction,
                serverInstance: process.env.SERVER_INSTANCE_ID || `server-${this.serverStartTime.getTime()}`,
                scheduledAfter: this.serverStartTime.toISOString(),
                volumeInfo: {
                    targetEmail,
                    targetType,
                    scheduledAt: new Date().toISOString()
                }
            };

            await this.redis.storeScheduledJob(jobKey, job);

            const timeoutId = setTimeout(async () => {
                await this.executeScheduledJob(jobKey, job, channel);
            }, emailJob.scheduleDelay);

            this.scheduledJobs.set(jobKey, timeoutId);
            console.log(`   ⏰ SCHEDULED: ${emailJob.direction} in ${Math.round(emailJob.scheduleDelay / 60000)}min`);
            return true;

        } catch (error) {
            console.error(`❌ SCHEDULING ERROR:`, error);
            return false;
        }
    }

    async executeScheduledJob(jobKey, job, channel) {
        try {
            console.log(`\n🎯 EXECUTING: ${job.direction}`);
            console.log(`   ${job.pairs[0].senderEmail} → ${job.pairs[0].receiverEmail}`);

            const { targetEmail, targetType } = job.volumeInfo;

            // 🚨 FIX: Use this.volumeEnforcement
            const currentSummary = await this.volumeEnforcement.getDailySummary(targetEmail, targetType);
            console.log(`   📊 Pre-execution volume: ${targetEmail} - ${currentSummary.sentToday}/${currentSummary.volumeLimit}`);

            const canExecute = await this.volumeEnforcement.canAccountSendEmail(targetEmail, targetType);

            if (!canExecute) {
                console.log(`   💥 EXECUTION BLOCKED: ${targetEmail} hit volume limit (${currentSummary.sentToday}/${currentSummary.volumeLimit})`);
                await this.redis.removeScheduledJob(jobKey);
                return;
            }

            // 🚨 FIX: Use this.volumeEnforcement
            const newCount = await this.volumeEnforcement.incrementSentCount(targetEmail, 1, targetType);
            console.log(`   📈 Volume incremented: ${targetEmail} - ${newCount}/${currentSummary.volumeLimit}`);

            await channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(job)), {
                persistent: true
            });

            console.log(`   ✅ EXECUTION QUEUED`);
            await this.redis.removeScheduledJob(jobKey);

        } catch (error) {
            console.error('❌ EXECUTION ERROR:', error);
            // 🚨 FIX: Use this.volumeEnforcement
            if (job.volumeInfo) {
                await this.volumeEnforcement.reverseScheduledEmail(job.volumeInfo.targetEmail, job.direction);
            }
            await this.redis.removeScheduledJob(jobKey);
        }
    }

    async trackWorkerExecution(email, accountType, success = true) {
        try {
            if (success) {
                // Email was successfully processed by worker
                console.log(`📊 Worker confirmed execution for ${email}`);
                // Volume was already incremented when queued, so no need to increment again
            } else {
                // Worker failed to process - reverse the count
                await this.volumeEnforcement.reverseScheduledEmail(email, accountType);
                console.log(`🔄 Reversed volume count for failed worker job: ${email}`);
            }
        } catch (error) {
            console.error(`❌ Error tracking worker execution:`, error);
        }
    }

    async getActiveWarmupAccounts() {
        console.log('🔍 Retrieving ACTIVE warmup accounts from DATABASE...');

        const [googleAccounts, smtpAccounts, microsoftAccounts] = await Promise.all([
            GoogleUser.findAll({ where: { warmupStatus: 'active', is_connected: true } }),
            SmtpAccount.findAll({ where: { warmupStatus: 'active', is_connected: true } }),
            MicrosoftUser.findAll({ where: { warmupStatus: 'active', is_connected: true } })
        ]);

        const allAccounts = [...googleAccounts, ...smtpAccounts, ...microsoftAccounts];

        console.log(`📊 DATABASE ACTIVE ACCOUNTS:`);
        console.log(`   Google: ${googleAccounts.length}`);
        console.log(`   SMTP: ${smtpAccounts.length}`);
        console.log(`   Microsoft: ${microsoftAccounts.length}`);

        const verifiedAccounts = [];
        for (const account of allAccounts) {
            if (account && account.email) {
                console.log(`   ✅ ${account.email} (${account.provider || 'smtp'})`);
                verifiedAccounts.push(account);
            }
        }

        console.log(`✅ FINAL VERIFIED ACCOUNTS: ${verifiedAccounts.length}`);
        return verifiedAccounts;
    }

    async getActivePoolAccounts() {
        try {
            const poolAccounts = await EmailPool.findAll({
                where: { isActive: true }
            });

            console.log(`🏊 Active pool accounts: ${poolAccounts.length}`);

            for (const pool of poolAccounts) {
                try {
                    // 🚨 FIX: Use this.volumeEnforcement
                    const poolSummary = await this.volumeEnforcement.getDailySummary(pool.email, 'pool');
                    console.log(`   ${pool.email} (${pool.providerType}) - ${poolSummary.sentToday}/${poolSummary.volumeLimit} sent today (${poolSummary.remaining} remaining)`);
                } catch (error) {
                    console.log(`   ${pool.email} (${pool.providerType}) - Error getting volume status: ${error.message}`);
                }
            }

            return poolAccounts;
        } catch (error) {
            console.error('❌ Error getting active pool accounts:', error);
            return [];
        }
    }
    // 🚨 SAFE APPROACH: Volume-aware job recovery
    async recoverScheduledJobs(channel) {
        // 🚨 DON'T RECOVER IF WE ALREADY DID IT
        if (this.recoveryCompleted) {
            console.log('⏩ Skipping recovery - already completed');
            return;
        }

        const storedJobs = await this.redis.getAllScheduledJobs();
        const now = new Date();
        let recoveredCount = 0;
        let skippedDueToVolume = 0;
        let removedCount = 0;

        console.log(`🔍 Checking ${Object.keys(storedJobs).length} stored jobs for recovery...`);

        for (const [jobKey, jobData] of Object.entries(storedJobs)) {
            const scheduledTime = new Date(jobData.scheduledTime);

            // 🚨 ENHANCED: Only recover jobs scheduled AFTER server startup
            const scheduledAfterStartup = jobData.scheduledAfter ?
                new Date(jobData.scheduledAfter) > this.serverStartTime :
                scheduledTime > this.serverStartTime;

            // Only recover future jobs that were scheduled after this server instance started
            if (scheduledTime > now && scheduledAfterStartup) {
                const timeUntilExecution = scheduledTime.getTime() - now.getTime();

                if (timeUntilExecution > 0) {
                    // 🚨 SAFE VOLUME CHECK: Validate EACH job before recovery
                    const canRecover = await this.canRecoverJob(jobData);

                    if (!canRecover) {
                        console.log(`   🚫 SKIPPING RECOVERY - Volume limit reached: ${this.getJobDescription(jobData)}`);
                        await this.redis.removeScheduledJob(jobKey);
                        skippedDueToVolume++;
                        continue;
                    }

                    // 🚨 DO NOT INCREMENT COUNTS DURING RECOVERY - wait for actual execution
                    const timeoutId = setTimeout(async () => {
                        await this.executeRecoveredJob(jobKey, jobData, channel);
                    }, timeUntilExecution);

                    this.scheduledJobs.set(jobKey, timeoutId);
                    recoveredCount++;
                    console.log(`   ✅ Recovered: ${this.getJobDescription(jobData)} (in ${Math.round(timeUntilExecution / 60000)}min)`);
                }
            } else {
                // Remove expired or pre-startup jobs
                await this.redis.removeScheduledJob(jobKey);
                removedCount++;
                console.log(`   🗑️ Removed expired/pre-startup job: ${jobKey}`);
            }
        }

        console.log(`📊 Recovery Complete: ${recoveredCount} recovered, ${skippedDueToVolume} skipped (volume limits), ${removedCount} removed`);
        this.recoveryCompleted = true;
    }

    async canRecoverJob(jobData) {
        try {
            let targetEmail, targetType;

            if (jobData.direction === 'WARMUP_TO_POOL') {
                targetEmail = jobData.warmupAccount;
                targetType = 'warmup';
            } else if (jobData.direction === 'POOL_TO_WARMUP' && jobData.pairs && jobData.pairs[0]) {
                targetEmail = jobData.pairs[0].senderEmail;
                targetType = 'pool';
            } else {
                return false;
            }

            // 🚨 FIX: Use this.volumeEnforcement
            const currentSummary = await this.volumeEnforcement.getDailySummary(targetEmail, targetType);

            if (!currentSummary.canSendMore) {
                console.log(`   💥 VOLUME LIMIT: ${targetEmail} at ${currentSummary.sentToday}/${currentSummary.volumeLimit}`);
                return false;
            }

            return true;
        } catch (error) {
            console.error(`❌ Error checking job recovery:`, error);
            return false;
        }
    }

    async executeRecoveredJob(jobKey, jobData, channel) {
        try {
            console.log(`🎯 EXECUTING RECOVERED JOB: ${this.getJobDescription(jobData)}`);

            let targetEmail, targetType;
            if (jobData.direction === 'WARMUP_TO_POOL') {
                targetEmail = jobData.warmupAccount;
                targetType = 'warmup';
            } else {
                targetEmail = jobData.pairs[0].senderEmail;
                targetType = 'pool';
            }

            // 🚨 FIX: Use this.volumeEnforcement
            const canExecute = await this.volumeEnforcement.canAccountSendEmail(targetEmail, targetType);

            if (!canExecute) {
                console.log(`   💥 EXECUTION BLOCKED: ${targetEmail} hit volume limit`);
                await this.redis.removeScheduledJob(jobKey);
                return;
            }

            // 🚨 FIX: Use this.volumeEnforcement
            await this.volumeEnforcement.incrementSentCount(targetEmail, 1, targetType);

            await channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(jobData)), {
                persistent: true
            });

            console.log(`   ✅ Recovered job queued for execution`);
            await this.redis.removeScheduledJob(jobKey);

        } catch (error) {
            console.error(`❌ Recovered job execution failed:`, error);
            await this.redis.removeScheduledJob(jobKey);
        }
    }

    enforceBidirectionalRatios(outboundEmails, inboundEmails, warmupAccount) {
        const warmupDay = warmupAccount.warmupDayCount || 0;
        const totalAvailable = outboundEmails.length + inboundEmails.length;

        let targetOutboundRatio, targetInboundRatio;

        if (warmupDay === 0) {
            targetOutboundRatio = 0.7;
            targetInboundRatio = 0.3;
        } else if (warmupDay === 1) {
            targetOutboundRatio = 0.6;
            targetInboundRatio = 0.4;
        } else if (warmupDay >= 2 && warmupDay <= 7) {
            targetOutboundRatio = 0.5;
            targetInboundRatio = 0.5;
        } else {
            targetOutboundRatio = 0.4;
            targetInboundRatio = 0.6;
        }

        let targetOutboundCount = Math.round(totalAvailable * targetOutboundRatio);
        let targetInboundCount = Math.round(totalAvailable * targetInboundRatio);

        const currentTotal = targetOutboundCount + targetInboundCount;
        if (currentTotal < totalAvailable) {
            const remaining = totalAvailable - currentTotal;
            if (targetOutboundRatio >= targetInboundRatio) {
                targetOutboundCount += remaining;
            } else {
                targetInboundCount += remaining;
            }
        }

        targetOutboundCount = Math.min(targetOutboundCount, outboundEmails.length);
        targetInboundCount = Math.min(targetInboundCount, inboundEmails.length);

        const finalTotal = targetOutboundCount + targetInboundCount;
        if (finalTotal < totalAvailable) {
            const remaining = totalAvailable - finalTotal;
            if (outboundEmails.length - targetOutboundCount >= remaining) {
                targetOutboundCount += remaining;
            } else if (inboundEmails.length - targetInboundCount >= remaining) {
                targetInboundCount += remaining;
            }
        }

        console.log(`   ⚖️  FINAL RATIOS: Day ${warmupDay}`);
        console.log(`      ├── Outbound: ${targetOutboundCount} emails`);
        console.log(`      └── Inbound: ${targetInboundCount} emails`);
        console.log(`      📊 TOTAL PRESERVED: ${targetOutboundCount + targetInboundCount}/${totalAvailable}`);

        const finalOutbound = outboundEmails.slice(0, targetOutboundCount);
        const finalInbound = inboundEmails.slice(0, targetInboundCount);

        return { finalOutbound, finalInbound };
    }

    async filterOutRecentlyIncrementalAccounts(accountsWithCapacity) {
        const recentlyScheduled = await this.getRecentlyIncrementallyScheduledAccounts();
        const filteredAccounts = [];

        for (const account of accountsWithCapacity) {
            const wasRecentlyIncremental = recentlyScheduled.has(account.email);
            if (wasRecentlyIncremental) {
                console.log(`   ⏩ ${account.email} - Skipped (recently incremental)`);
            } else {
                filteredAccounts.push(account);
                console.log(`   ✅ ${account.email} - Available for global scheduling`);
            }
        }

        return filteredAccounts;
    }

    async getActualReplyRate(warmupEmail, daysToCheck = 3) {
        try {
            const EmailMetric = require('../../models/EmailMetric');
            const { Op } = require('sequelize');

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - daysToCheck);

            // Use only existing columns in your database
            const metrics = await EmailMetric.findAll({
                where: {
                    senderEmail: warmupEmail,
                    sentAt: {
                        [Op.gte]: startDate
                    }
                },
                attributes: ['id', 'sentAt'] // Remove 'replied' if it doesn't exist
            });

            if (metrics.length === 0) {
                console.log(`   📊 No recent email data for reply rate calculation`);
                return null;
            }

            // If you don't have replied tracking, return null to use configured rate
            console.log(`   📊 Using configured reply rate (no replied data available)`);
            return null;

        } catch (error) {
            console.error(`❌ Error calculating actual reply rate:`, error.message);
            return null; // Fall back to configured rate
        }
    }




    // 🚨 Get active warmup accounts
    async getActiveWarmupAccounts() {
        console.log('🔍 Retrieving ACTIVE warmup accounts from DATABASE...');

        const [googleAccounts, smtpAccounts, microsoftAccounts] = await Promise.all([
            GoogleUser.findAll({ where: { warmupStatus: 'active', is_connected: true } }),
            SmtpAccount.findAll({ where: { warmupStatus: 'active', is_connected: true } }),
            MicrosoftUser.findAll({ where: { warmupStatus: 'active', is_connected: true } })
        ]);

        const allAccounts = [...googleAccounts, ...smtpAccounts, ...microsoftAccounts];

        console.log(`📊 DATABASE ACTIVE ACCOUNTS:`);
        console.log(`   Google: ${googleAccounts.length}`);
        console.log(`   SMTP: ${smtpAccounts.length}`);
        console.log(`   Microsoft: ${microsoftAccounts.length}`);

        // VERIFY each account exists in database
        const verifiedAccounts = [];
        for (const account of allAccounts) {
            if (account && account.email) {
                console.log(`   ✅ ${account.email} (${account.provider || 'smtp'})`);
                verifiedAccounts.push(account);
            }
        }

        console.log(`✅ FINAL VERIFIED ACCOUNTS: ${verifiedAccounts.length}`);
        return verifiedAccounts;
    }

    // 🚨 Get active pool accounts
    async getActivePoolAccounts() {
        try {
            const poolAccounts = await EmailPool.findAll({
                where: { isActive: true }
            });

            console.log(`🏊 Active pool accounts: ${poolAccounts.length}`);

            // Get volume status for each pool account using getDailySummary
            for (const pool of poolAccounts) {
                try {
                    const poolSummary = await this.volumeEnforcement.getDailySummary(pool.email, 'pool');
                    console.log(`   ${pool.email} (${pool.providerType}) - ${poolSummary.sentToday}/${poolSummary.volumeLimit} sent today (${poolSummary.remaining} remaining)`);
                } catch (error) {
                    console.log(`   ${pool.email} (${pool.providerType}) - Error getting volume status: ${error.message}`);
                }
            }

            return poolAccounts;
        } catch (error) {
            console.error('❌ Error getting active pool accounts:', error);
            return [];
        }
    }

    // 🚨 Trigger immediate scheduling
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

    // 🚨 Stop scheduler
    stopScheduler() {
        this.clearScheduledJobs();
        this.isRunning = false;
        console.log('🛑 Bidirectional warmup scheduler stopped');
    }

    // 🚨 Clear scheduled jobs
    clearScheduledJobs() {
        for (const [timeString, timeoutId] of this.scheduledJobs) {
            clearTimeout(timeoutId);
        }
        this.scheduledJobs.clear();
    }

    // 🚨 HELPER: Get job description for logging
    getJobDescription(jobData) {
        if (jobData.pairs && jobData.pairs[0]) {
            const pair = jobData.pairs[0];
            return `${pair.senderEmail} → ${pair.receiverEmail} (${jobData.direction})`;
        }
        return `${jobData.direction} job`;
    }

    // 🚨 Utility methods
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





    async canRecoverJobWithVolumeCheck(jobData) {
        try {
            let targetEmail, targetType;

            if (jobData.direction === 'WARMUP_TO_POOL') {
                targetEmail = jobData.warmupAccount;
                targetType = 'warmup';
            } else if (jobData.direction === 'POOL_TO_WARMUP' && jobData.pairs && jobData.pairs[0]) {
                targetEmail = jobData.pairs[0].senderEmail;
                targetType = 'pool';
            } else {
                return false;
            }

            // 🚨 FIX: Use this.volumeEnforcement
            const currentSummary = await this.volumeEnforcement.getDailySummary(targetEmail, targetType);

            console.log(`   📊 Volume check for ${targetEmail}: ${currentSummary.sentToday}/${currentSummary.volumeLimit} (${targetType})`);

            if (!currentSummary.canSendMore) {
                console.log(`   💥 VOLUME LIMIT REACHED: ${targetEmail} at ${currentSummary.sentToday}/${currentSummary.volumeLimit}`);
                return false;
            }

            return true;
        } catch (error) {
            console.error(`❌ Error checking job recovery volume:`, error);
            return false;
        }
    }

    // 🚨 UPDATE: Enhanced scheduling with volume validation
    async scheduleSingleEmailWithEnforcement(emailJob, channel, warmupEmail) {
        try {
            const targetEmail = emailJob.direction === 'WARMUP_TO_POOL' ? warmupEmail : emailJob.senderEmail;
            const targetType = emailJob.direction === 'WARMUP_TO_POOL' ? 'warmup' : 'pool';

            // 🚨 ENHANCED CAPACITY CHECK WITH DATABASE
            const currentSummary = await this.volumeEnforcement.getDailySummary(targetEmail, targetType)

            console.log(`   📊 Scheduling check for ${targetEmail}: ${currentSummary.sentToday}/${currentSummary.volumeLimit} (${targetType})`);

            if (!currentSummary.canSendMore) {
                console.log(`   🚫 SCHEDULING BLOCKED: ${targetEmail} has no capacity (${currentSummary.sentToday}/${currentSummary.volumeLimit})`);
                return false;
            }

            const scheduleTime = new Date(Date.now() + emailJob.scheduleDelay);
            const jobKey = `${scheduleTime.toISOString()}_${emailJob.senderEmail}_${emailJob.receiverEmail}_${emailJob.direction}`;

            const job = {
                timeSlot: scheduleTime.toISOString(),
                pairs: [emailJob],
                timestamp: new Date().toISOString(),
                scheduledTime: scheduleTime.toISOString(),
                warmupAccount: warmupEmail,
                direction: emailJob.direction,
                // 🚨 ADD SERVER INSTANCE INFO TO PREVENT DUPLICATES
                serverInstance: process.env.SERVER_INSTANCE_ID || `server-${this.serverStartTime.getTime()}`,
                scheduledAfter: this.serverStartTime.toISOString(),
                // 🚨 ENHANCED VOLUME INFO FOR SAFE RECOVERY
                volumeInfo: {
                    targetEmail,
                    targetType,
                    scheduledAtVolume: currentSummary.sentToday,
                    volumeLimit: currentSummary.volumeLimit,
                    remainingCapacity: currentSummary.remaining,
                    syncTimestamp: new Date().toISOString()
                }
            };

            await this.redis.storeScheduledJob(jobKey, job);

            const timeoutId = setTimeout(async () => {
                await this.executeScheduledJob(jobKey, job, channel);
            }, emailJob.scheduleDelay);

            this.scheduledJobs.set(jobKey, timeoutId);
            console.log(`   ⏰ SCHEDULED: ${emailJob.direction} in ${Math.round(emailJob.scheduleDelay / 60000)}min (Volume: ${currentSummary.sentToday + 1}/${currentSummary.volumeLimit})`);
            return true;

        } catch (error) {
            console.error(`❌ SCHEDULING ERROR:`, error);
            return false;
        }
    }

    // 🚨 UPDATE: Enhanced execution with volume verification
    async executeScheduledJob(jobKey, job, channel) {
        try {
            console.log(`\n🎯 EXECUTING: ${job.direction}`);
            console.log(`   ${job.pairs[0].senderEmail} → ${job.pairs[0].receiverEmail}`);

            const { targetEmail, targetType } = job.volumeInfo;

            // 🚨 ENHANCED FINAL VOLUME CHECK
            const currentSummary = await this.volumeEnforcement.getDailySummary(targetEmail, targetType);
            console.log(`   📊 Pre-execution volume: ${targetEmail} - ${currentSummary.sentToday}/${currentSummary.volumeLimit}`);

            const canExecute = await this.volumeEnforcement.canAccountSendEmail(targetEmail, targetType);

            if (!canExecute) {
                console.log(`   💥 EXECUTION BLOCKED: ${targetEmail} hit volume limit (${currentSummary.sentToday}/${currentSummary.volumeLimit})`);
                await this.redis.removeScheduledJob(jobKey);
                return;
            }

            // 🚨 RESERVE SLOT ONLY NOW (at execution time)
            const newCount = await this.volumeEnforcement.incrementSentCount(targetEmail, 1, targetType);
            console.log(`   📈 Volume incremented: ${targetEmail} - ${newCount}/${currentSummary.volumeLimit}`);

            // Send to queue
            await channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(job)), {
                persistent: true
            });

            console.log(`   ✅ EXECUTION QUEUED`);
            await this.redis.removeScheduledJob(jobKey);

        } catch (error) {
            console.error('❌ EXECUTION ERROR:', error);
            // 🚨 REVERSE THE COUNT ON ERROR
            if (job.volumeInfo) {
                await this.volumeEnforcement.reverseScheduledEmail(job.volumeInfo.targetEmail, job.direction);
            }
            await this.redis.removeScheduledJob(jobKey);
        }
    }

    // 🚨 UPDATE: Initialize with volume sync
    async initialize() {
        console.log('🚀 Initializing Bidirectional Warmup Scheduler...');

        // 🚨 FIRST: Initialize volume enforcement
        await this.volumeEnforcement.initialize();

        // 🚨 SECOND: Sync volume with database
        await this.syncVolumeWithDatabase();

        // 🚨 THIRD: Clear any stale jobs from previous server runs
        await this.cleanupStaleJobs();

        console.log('✅ Warmup scheduler started successfully');
    }
}

// Create and export instance
const schedulerInstance = new WarmupScheduler();

// Initialize when module loads
schedulerInstance.initialize().catch(console.error);

module.exports = {
    scheduleWarmup: () => schedulerInstance.scheduleWarmup(),
    stopScheduler: () => schedulerInstance.stopScheduler(),
    WarmupScheduler,
    triggerImmediateScheduling: () => schedulerInstance.triggerImmediateScheduling(),
    markAccountAsIncrementallyScheduled: (email) => schedulerInstance.markAccountAsIncrementallyScheduled(email),
    getRecentlyIncrementallyScheduledAccounts: () => schedulerInstance.getRecentlyIncrementallyScheduledAccounts()
};