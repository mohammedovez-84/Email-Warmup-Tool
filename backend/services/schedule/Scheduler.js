const getChannel = require('../../queues/rabbitConnection');
const GoogleUser = require('../../models/GoogleUser');
const MicrosoftUser = require('../../models/MicrosoftUser');
const SmtpAccount = require('../../models/smtpAccounts');
const EmailPool = require('../../models/EmailPool');
const { computeReplyRate } = require('../../workflows/warmupWorkflow');
const RedisScheduler = require('../redis/redis-scheduler');
const UnifiedWarmupStrategy = require('./unified-strategy');

const VolumeEnforcement = require('../volume/volume-enforcement');

class WarmupScheduler {
    constructor() {
        this.isRunning = false;
        this.scheduledJobs = new Map();
        this.EMAIL_INTERVAL_MS = 15 * 60 * 1000;
        this.TESTING_MODE = process.env.WARMUP_TESTING_MODE === 'true';

        // 🚨 NEW: Track server startup to prevent duplicate scheduling
        this.serverStartTime = new Date();
        this.recoveryCompleted = false;
        this.lastSchedulingTime = 0;
        this.SCHEDULING_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown

        // ADD REDIS PERSISTENCE (only for job recovery, not volume)
        this.redis = new RedisScheduler();
    }

    async initialize() {
        console.log('🚀 Initializing Bidirectional Warmup Scheduler...');

        // 🚨 FIRST: Clear any stale jobs from previous server runs
        await this.cleanupStaleJobs();

        // 🚨 SECOND: Initialize volume enforcement
        await VolumeEnforcement.initialize();

        console.log('✅ Warmup scheduler started successfully');
    }

    // 🚨 NEW: Clean up stale jobs from previous server runs
    async cleanupStaleJobs() {
        try {
            console.log('🧹 Cleaning up stale jobs from previous server runs...');
            const storedJobs = await this.redis.getAllScheduledJobs();
            const now = new Date();
            let cleanedCount = 0;
            let keptCount = 0;

            for (const [jobKey, jobData] of Object.entries(storedJobs)) {
                const scheduledTime = new Date(jobData.scheduledTime);

                // 🚨 KEEP ONLY: Future jobs that are within reasonable timeframe
                const isFutureJob = scheduledTime > now;
                const isRecentJob = (now - scheduledTime) < (24 * 60 * 60 * 1000); // Within 24 hours

                if (isFutureJob && isRecentJob) {
                    keptCount++;
                } else {
                    // Remove expired or very old jobs
                    await this.redis.removeScheduledJob(jobKey);
                    cleanedCount++;
                    console.log(`   🗑️ Removed stale job: ${jobKey}`);
                }
            }

            console.log(`📊 Stale job cleanup: ${cleanedCount} removed, ${keptCount} kept`);

        } catch (error) {
            console.error('❌ Error cleaning up stale jobs:', error);
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

    async scheduleBidirectionalWarmup(channel) {
        // 🚨 CHECK COOLDOWN PERIOD
        const timeSinceLastScheduling = Date.now() - this.lastSchedulingTime;
        if (timeSinceLastScheduling < this.SCHEDULING_COOLDOWN_MS) {
            console.log(`⏸️ Skipping scheduling - in cooldown period (${Math.round((this.SCHEDULING_COOLDOWN_MS - timeSinceLastScheduling) / 60000)}min remaining)`);
            this.isRunning = false;
            return;
        }

        console.log('📧 GLOBAL SCHEDULING: Finding accounts needing emails...');

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

        // 🚨 CRITICAL: Filter accounts with capacity AND no recent incremental jobs
        const accountsWithCapacity = await this.filterAccountsWithCapacity(activeAccounts, activePools);

        if (accountsWithCapacity.length === 0) {
            console.log('🚫 No accounts with capacity available for global scheduling');
            this.isRunning = false;
            return;
        }

        // 🚨 NEW: Filter out accounts that recently had incremental scheduling
        const accountsForGlobalScheduling = await this.filterOutRecentlyIncrementalAccounts(accountsWithCapacity);

        if (accountsForGlobalScheduling.length === 0) {
            console.log('💤 All capable accounts were recently handled by incremental scheduling');
            this.isRunning = false;
            return;
        }

        console.log(`🎯 Global scheduling: ${accountsForGlobalScheduling.length} accounts (excluding recently incremental ones)`);

        for (const warmupAccount of accountsForGlobalScheduling) {
            await this.createAndScheduleBidirectionalPlan(warmupAccount, activePools, channel);
        }

        // 🚨 UPDATE LAST SCHEDULING TIME
        this.lastSchedulingTime = Date.now();
        this.isRunning = false;
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

    async markAccountAsIncrementallyScheduled(email) {
        try {
            const key = `incremental:${email}`;
            const incrementalData = {
                email: email,
                scheduledAt: new Date().toISOString(),
                type: 'incremental',
                markedAt: Date.now()
            };

            // Store with 2-hour expiration (7200 seconds)
            await this.redis.storeScheduledJob(key, incrementalData);

            console.log(`📝 Marked ${email} as incrementally scheduled (2-hour cooldown)`);
            return true;
        } catch (error) {
            console.error(`❌ Error marking incremental scheduling for ${email}:`, error);
            return false;
        }
    }

    // 🚨 NEW: Get recently incrementally scheduled accounts
    async getRecentlyIncrementallyScheduledAccounts() {
        const recentlyScheduled = new Set();
        try {
            const allJobs = await this.redis.getAllScheduledJobs();

            for (const [jobKey, jobData] of Object.entries(allJobs)) {
                if (jobKey.startsWith('incremental:') && jobData.email) {
                    // Check if it's still within 2 hours
                    const markedAt = new Date(jobData.scheduledAt || jobData.markedAt);
                    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

                    if (markedAt > twoHoursAgo) {
                        recentlyScheduled.add(jobData.email);
                    } else {
                        // Remove expired incremental markers
                        await this.redis.removeScheduledJob(jobKey);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error getting incremental accounts:', error);
        }

        console.log(`📝 Recently incremental accounts: ${Array.from(recentlyScheduled)}`);
        return recentlyScheduled;
    }

    // 🚨 NEW: Filter accounts with capacity BEFORE scheduling
    async filterAccountsWithCapacity(warmupAccounts, poolAccounts) {
        const accountsWithCapacity = [];

        for (const warmupAccount of warmupAccounts) {
            const warmupSummary = await VolumeEnforcement.getDailySummary(warmupAccount.email, 'warmup');

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

    // 🚨 NEW: Get pools that can send to specific warmup account
    async getAvailablePoolsForWarmup(poolAccounts, warmupEmail) {
        const availablePools = [];

        for (const pool of poolAccounts) {
            const poolSummary = await VolumeEnforcement.getDailySummary(pool.email, 'pool');

            if (poolSummary.canSendMore) {
                // Also check if warmup account can receive (hasn't hit inbound limit)
                const warmupInboundSummary = await VolumeEnforcement.getDailySummary(warmupEmail, 'warmup');
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
            // 🚨 STEP 1: Get daily summary for WARMUP account
            const warmupSummary = await VolumeEnforcement.getDailySummary(warmupAccount.email, 'warmup');
            console.log(`   📊 WARMUP STATUS: ${warmupSummary.sentToday}/${warmupSummary.volumeLimit} sent, ${warmupSummary.remaining} remaining`);

            // 🚨 STEP 2: Check warmup account capacity (double-check)
            if (!warmupSummary.canSendMore) {
                console.log(`   🚫 WARMUP BLOCKED: ${warmupAccount.email} has NO capacity`);
                await this.cleanupScheduledJobsForAccount(warmupAccount.email);
                return;
            }

            // 🚨 STEP 3: Get available pools that can send TO warmup account
            const availablePools = await this.getAvailablePoolsForWarmup(poolAccounts, warmupAccount.email);

            if (availablePools.length === 0) {
                console.log(`   ⚠️  NO AVAILABLE POOLS: All pools are at capacity or warmup cannot receive`);
                return;
            }

            console.log(`   🏊 AVAILABLE POOLS: ${availablePools.length}`);

            // 🚨 STEP 4: Generate BIDIRECTIONAL plan with proper ratio
            const strategy = new UnifiedWarmupStrategy();
            const replyRate = computeReplyRate(warmupAccount);
            const plan = await strategy.generateWarmupPlan(warmupAccount, availablePools, replyRate);

            if (plan.error || !plan.sequence || plan.sequence.length === 0) {
                console.log(`   ⚠️  NO VALID PLAN: ${plan.error || 'Empty sequence'}`);
                return;
            }

            console.log(`   📧 PLAN GENERATED: ${plan.sequence.length} emails total`);

            // 🚨 STEP 5: Separate and count bidirectional emails
            const outboundEmails = plan.sequence.filter(job => job.direction === 'WARMUP_TO_POOL');
            const inboundEmails = plan.sequence.filter(job => job.direction === 'POOL_TO_WARMUP');

            console.log(`   🔄 BIDIRECTIONAL BREAKDOWN:`);
            console.log(`      ├── Outbound (WARMUP→POOL): ${outboundEmails.length}`);
            console.log(`      └── Inbound (POOL→WARMUP): ${inboundEmails.length}`);

            const actualReplyRate = await this.getActualReplyRate(warmupAccount.email);

            // 🚨 STEP 6: ENFORCE PROPER RATIOS
            const { finalOutbound, finalInbound } = this.enforceBidirectionalRatios(
                outboundEmails,
                inboundEmails,
                warmupAccount,
                actualReplyRate
            );

            console.log(`   ⚖️  RATIO ENFORCED:`);
            console.log(`      ├── Outbound: ${finalOutbound.length}`);
            console.log(`      └── Inbound: ${finalInbound.length}`);

            // 🚨 STEP 7: Get capacity limits for BOTH directions
            const warmupMaxToSchedule = await VolumeEnforcement.getMaxEmailsToSchedule(warmupAccount.email, 'warmup');

            // For inbound emails, we need to check each pool's capacity
            let totalInboundCapacity = 0;
            const poolCapacities = new Map();

            for (const pool of availablePools) {
                const poolCapacity = await VolumeEnforcement.getMaxEmailsToSchedule(pool.email, 'pool');
                poolCapacities.set(pool.email, poolCapacity);
                totalInboundCapacity += poolCapacity;
            }

            console.log(`   📊 CAPACITY ANALYSIS:`);
            console.log(`      ├── Warmup can send: ${warmupMaxToSchedule} emails`);
            console.log(`      └── Pools can send: ${totalInboundCapacity} emails total`);

            // 🚨 STEP 8: Apply volume limits to final email counts
            const volumeLimitedOutbound = finalOutbound.slice(0, warmupMaxToSchedule);
            const volumeLimitedInbound = finalInbound.slice(0, totalInboundCapacity);

            console.log(`   📦 VOLUME LIMITED:`);
            console.log(`      ├── Outbound: ${volumeLimitedOutbound.length} (from ${finalOutbound.length})`);
            console.log(`      └── Inbound: ${volumeLimitedInbound.length} (from ${finalInbound.length})`);

            // 🚨 STEP 9: Schedule emails ONLY if volume allows
            let scheduledOutbound = 0;
            let scheduledInbound = 0;

            // Schedule OUTBOUND emails (WARMUP → POOL)
            console.log(`   🚀 SCHEDULING OUTBOUND EMAILS...`);
            for (const emailJob of volumeLimitedOutbound) {
                const scheduled = await this.scheduleSingleEmailWithEnforcement(emailJob, channel, warmupAccount.email);
                if (scheduled) scheduledOutbound++;
            }

            // Schedule INBOUND emails (POOL → WARMUP)
            console.log(`   📥 SCHEDULING INBOUND EMAILS...`);
            const poolUsage = new Map();

            for (const emailJob of volumeLimitedInbound) {
                const poolEmail = emailJob.senderEmail;

                // Check if this pool still has capacity
                const currentPoolUsage = poolUsage.get(poolEmail) || 0;
                const poolCapacity = poolCapacities.get(poolEmail) || 0;

                if (currentPoolUsage < poolCapacity) {
                    // Add delay to inbound emails to ensure outbound goes first
                    emailJob.scheduleDelay += 5 * 60 * 1000; // Add 5-minute delay for inbound

                    const scheduled = await this.scheduleSingleEmailWithEnforcement(emailJob, channel, warmupAccount.email);
                    if (scheduled) {
                        scheduledInbound++;
                        poolUsage.set(poolEmail, currentPoolUsage + 1);
                    }
                } else {
                    console.log(`   🚫 POOL CAPACITY REACHED: ${poolEmail} - ${currentPoolUsage}/${poolCapacity}`);
                }
            }

            console.log(`   ✅ FINAL SCHEDULED:`);
            console.log(`      ├── Outbound: ${scheduledOutbound} emails`);
            console.log(`      └── Inbound: ${scheduledInbound} emails`);
            console.log(`      └── Total: ${scheduledOutbound + scheduledInbound} bidirectional exchanges`);
            console.log(`      └── Ratio: ${scheduledOutbound}:${scheduledInbound}`);

        } catch (error) {
            console.error(`❌ BIDIRECTIONAL SCHEDULING FAILED for ${warmupAccount.email}:`, error.message);
        }
    }

    // 🚨 FIXED: Remove volume tracking during scheduling
    async scheduleSingleEmailWithEnforcement(emailJob, channel, warmupEmail) {
        try {
            const targetEmail = emailJob.direction === 'WARMUP_TO_POOL' ? warmupEmail : emailJob.senderEmail;
            const targetType = emailJob.direction === 'WARMUP_TO_POOL' ? 'warmup' : 'pool';

            // 🚨 CHECK CAPACITY BUT DON'T RESERVE YET
            const currentSummary = await VolumeEnforcement.getDailySummary(targetEmail, targetType);
            if (!currentSummary.canSendMore) {
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
                // 🚨 ADD SERVER INSTANCE INFO TO PREVENT DUPLICATES
                serverInstance: process.env.SERVER_INSTANCE_ID || `server-${this.serverStartTime.getTime()}`,
                scheduledAfter: this.serverStartTime.toISOString(),
                // 🚨 ADD VOLUME INFO FOR SAFE RECOVERY
                volumeInfo: {
                    targetEmail,
                    targetType,
                    scheduledAtVolume: currentSummary.sentToday,
                    volumeLimit: currentSummary.volumeLimit
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

    // 🚨 SEPARATE: Execute scheduled job with volume enforcement
    async executeScheduledJob(jobKey, job, channel) {
        try {
            console.log(`\n🎯 EXECUTING: ${job.direction}`);
            console.log(`   ${job.pairs[0].senderEmail} → ${job.pairs[0].receiverEmail}`);

            const { targetEmail, targetType } = job.volumeInfo;

            // 🚨 FINAL VOLUME CHECK BEFORE EXECUTION
            const canExecute = await VolumeEnforcement.canAccountSendEmail(targetEmail, targetType);

            if (!canExecute) {
                console.log(`   💥 EXECUTION BLOCKED: ${targetEmail} hit volume limit`);
                await this.redis.removeScheduledJob(jobKey);
                return;
            }

            // 🚨 RESERVE SLOT ONLY NOW (at execution time)
            await VolumeEnforcement.incrementSentCount(targetEmail, 1, targetType);

            // Send to queue
            await channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(job)), {
                persistent: true
            });

            console.log(`   ✅ EXECUTION QUEUED`);
            await this.redis.removeScheduledJob(jobKey);

        } catch (error) {
            console.error('❌ EXECUTION ERROR:', error);
            // 🚨 REVERSE THE COUNT ON ERROR
            await VolumeEnforcement.reverseScheduledEmail(targetEmail, job.direction);
            await this.redis.removeScheduledJob(jobKey);
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

    // 🚨 SAFE: Check if job can be recovered without volume conflicts
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
                return false; // Invalid job data
            }

            // 🚨 CHECK CURRENT VOLUME STATUS (not future/predicted)
            const currentSummary = await VolumeEnforcement.getDailySummary(targetEmail, targetType);

            if (!currentSummary.canSendMore) {
                console.log(`   💥 VOLUME LIMIT: ${targetEmail} at ${currentSummary.sentToday}/${currentSummary.volumeLimit}`);
                return false;
            }

            return true;

        } catch (error) {
            console.error(`❌ Error checking job recovery:`, error);
            return false; // Be safe - don't recover on error
        }
    }

    // 🚨 SAFE: Execute recovered job with final volume check
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

            // 🚨 FINAL VOLUME CHECK RIGHT BEFORE EXECUTION
            const canExecute = await VolumeEnforcement.canAccountSendEmail(targetEmail, targetType);

            if (!canExecute) {
                console.log(`   💥 EXECUTION BLOCKED: ${targetEmail} hit volume limit`);
                await this.redis.removeScheduledJob(jobKey);
                return;
            }

            // 🚨 RESERVE SLOT ONLY WHEN ACTUALLY EXECUTING
            await VolumeEnforcement.incrementSentCount(targetEmail, 1, targetType);

            // Send to queue for processing
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

    // 🚨 FIXED: Bidirectional ratio enforcement - PRESERVE TOTAL COUNT
    enforceBidirectionalRatios(outboundEmails, inboundEmails, warmupAccount, actualReplyRate = null) {
        const warmupDay = warmupAccount.warmupDayCount || 0;
        const totalAvailable = outboundEmails.length + inboundEmails.length;

        console.log(`   📊 CURRENT COUNTS: Outbound: ${outboundEmails.length}, Inbound: ${inboundEmails.length}, Total: ${totalAvailable}`);

        const configuredReplyRate = warmupAccount.replyRate || 0.15;
        const effectiveReplyRate = actualReplyRate !== null ? actualReplyRate : configuredReplyRate;

        console.log(`   📨 REPLY RATE: Configured: ${(configuredReplyRate * 100).toFixed(1)}%, Effective: ${(effectiveReplyRate * 100).toFixed(1)}%`);

        let targetOutboundRatio, targetInboundRatio;

        // Define ratios (same as before)
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

        // 🚨 CRITICAL FIX: Calculate target counts while PRESERVING TOTAL
        let targetOutboundCount = Math.round(totalAvailable * targetOutboundRatio);
        let targetInboundCount = Math.round(totalAvailable * targetInboundRatio);

        // 🚨 ENSURE WE USE ALL AVAILABLE EMAILS
        const currentTotal = targetOutboundCount + targetInboundCount;
        if (currentTotal < totalAvailable) {
            // Distribute remaining emails to maintain ratio
            const remaining = totalAvailable - currentTotal;
            if (targetOutboundRatio >= targetInboundRatio) {
                targetOutboundCount += remaining;
            } else {
                targetInboundCount += remaining;
            }
        }

        // Ensure we don't exceed available emails
        targetOutboundCount = Math.min(targetOutboundCount, outboundEmails.length);
        targetInboundCount = Math.min(targetInboundCount, inboundEmails.length);

        // Final adjustment to ensure we use maximum possible
        const finalTotal = targetOutboundCount + targetInboundCount;
        if (finalTotal < totalAvailable) {
            const remaining = totalAvailable - finalTotal;
            // Add remaining to the direction that has more capacity
            if (outboundEmails.length - targetOutboundCount >= remaining) {
                targetOutboundCount += remaining;
            } else if (inboundEmails.length - targetInboundCount >= remaining) {
                targetInboundCount += remaining;
            }
        }

        console.log(`   ⚖️  FINAL RATIOS: Day ${warmupDay}`);
        console.log(`      ├── Outbound: ${targetOutboundCount} emails (${Math.round((targetOutboundCount / totalAvailable) * 100)}%)`);
        console.log(`      └── Inbound: ${targetInboundCount} emails (${Math.round((targetInboundCount / totalAvailable) * 100)}%)`);
        console.log(`      📨 Reply Rate Impact: ${(effectiveReplyRate * 100).toFixed(1)}%`);
        console.log(`      📊 TOTAL PRESERVED: ${targetOutboundCount + targetInboundCount}/${totalAvailable}`);

        const finalOutbound = outboundEmails.slice(0, targetOutboundCount);
        const finalInbound = inboundEmails.slice(0, targetInboundCount);

        return { finalOutbound, finalInbound, replyRateUsed: effectiveReplyRate };
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

    // 🚨 Cleanup scheduled jobs for account
    async cleanupScheduledJobsForAccount(email) {
        try {
            console.log(`🧹 Cleaning up scheduled jobs for: ${email}`);
            let removedCount = 0;

            // Clean up Redis scheduled jobs
            const storedJobs = await this.redis.getAllScheduledJobs();
            for (const [jobKey, jobData] of Object.entries(storedJobs)) {
                if (jobData.warmupAccount === email) {
                    await this.redis.removeScheduledJob(jobKey);
                    removedCount++;
                    console.log(`   🗑️ Removed scheduled job: ${jobKey}`);
                }
            }

            // Clean up in-memory scheduled jobs
            for (const [jobKey, timeoutId] of this.scheduledJobs) {
                if (jobKey.includes(email)) {
                    clearTimeout(timeoutId);
                    this.scheduledJobs.delete(jobKey);
                    removedCount++;
                    console.log(`   🗑️ Cancelled in-memory job: ${jobKey}`);
                }
            }

            console.log(`✅ Cleanup complete: Removed ${removedCount} jobs for ${email}`);
            return removedCount;
        } catch (error) {
            console.error(`❌ Error cleaning up jobs for ${email}:`, error);
            return 0;
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
                    const poolSummary = await VolumeEnforcement.getDailySummary(pool.email, 'pool');
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

    // 🚨 FIXED: Enhanced volume synchronization
    async syncVolumeWithDatabase() {
        try {
            console.log('🔄 Syncing volume counts with database...');

            const activeAccounts = await this.getActiveWarmupAccounts();
            const activePools = await this.getActivePoolAccounts();

            let syncedCount = 0;

            // Sync warmup accounts
            for (const account of activeAccounts) {
                const summary = await VolumeEnforcement.getDailySummary(account.email, 'warmup');
                console.log(`   📊 ${account.email}: ${summary.sentToday}/${summary.volumeLimit} (${summary.percentage}%)`);
                syncedCount++;
            }

            // Sync pool accounts
            for (const pool of activePools) {
                const summary = await VolumeEnforcement.getDailySummary(pool.email, 'pool');
                console.log(`   🏊 ${pool.email}: ${summary.sentToday}/${summary.volumeLimit} (${summary.percentage}%)`);
                syncedCount++;
            }

            console.log(`✅ Volume sync completed: ${syncedCount} accounts synchronized`);

        } catch (error) {
            console.error('❌ Volume sync error:', error);
        }
    }

    // 🚨 FIXED: Enhanced job recovery with volume validation
    async recoverScheduledJobs(channel) {
        // 🚨 DON'T RECOVER IF WE ALREADY DID IT
        if (this.recoveryCompleted) {
            console.log('⏩ Skipping recovery - already completed');
            return;
        }

        // 🚨 SYNC VOLUME FIRST
        await this.syncVolumeWithDatabase();

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
                    // 🚨 ENHANCED VOLUME CHECK: Validate with current database state
                    const canRecover = await this.canRecoverJobWithVolumeCheck(jobData);

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

    // 🚨 NEW: Enhanced volume check for job recovery
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
                return false; // Invalid job data
            }

            // 🚨 CHECK CURRENT VOLUME STATUS FROM DATABASE
            const currentSummary = await VolumeEnforcement.getDailySummary(targetEmail, targetType);

            console.log(`   📊 Volume check for ${targetEmail}: ${currentSummary.sentToday}/${currentSummary.volumeLimit} (${targetType})`);

            if (!currentSummary.canSendMore) {
                console.log(`   💥 VOLUME LIMIT REACHED: ${targetEmail} at ${currentSummary.sentToday}/${currentSummary.volumeLimit}`);
                return false;
            }

            // 🚨 ADDITIONAL CHECK: Verify job volume info matches current state
            if (jobData.volumeInfo) {
                const volumeChanged = jobData.volumeInfo.scheduledAtVolume !== currentSummary.sentToday;
                if (volumeChanged) {
                    console.log(`   ⚠️  Volume changed since scheduling: was ${jobData.volumeInfo.scheduledAtVolume}, now ${currentSummary.sentToday}`);
                    // Still allow recovery if there's capacity, but log the change
                }
            }

            return true;

        } catch (error) {
            console.error(`❌ Error checking job recovery volume:`, error);
            return false; // Be safe - don't recover on error
        }
    }

    // 🚨 UPDATE: Enhanced scheduling with volume validation
    async scheduleSingleEmailWithEnforcement(emailJob, channel, warmupEmail) {
        try {
            const targetEmail = emailJob.direction === 'WARMUP_TO_POOL' ? warmupEmail : emailJob.senderEmail;
            const targetType = emailJob.direction === 'WARMUP_TO_POOL' ? 'warmup' : 'pool';

            // 🚨 ENHANCED CAPACITY CHECK WITH DATABASE
            const currentSummary = await VolumeEnforcement.getDailySummary(targetEmail, targetType);

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
            const currentSummary = await VolumeEnforcement.getDailySummary(targetEmail, targetType);
            console.log(`   📊 Pre-execution volume: ${targetEmail} - ${currentSummary.sentToday}/${currentSummary.volumeLimit}`);

            const canExecute = await VolumeEnforcement.canAccountSendEmail(targetEmail, targetType);

            if (!canExecute) {
                console.log(`   💥 EXECUTION BLOCKED: ${targetEmail} hit volume limit (${currentSummary.sentToday}/${currentSummary.volumeLimit})`);
                await this.redis.removeScheduledJob(jobKey);
                return;
            }

            // 🚨 RESERVE SLOT ONLY NOW (at execution time)
            const newCount = await VolumeEnforcement.incrementSentCount(targetEmail, 1, targetType);
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
                await VolumeEnforcement.reverseScheduledEmail(job.volumeInfo.targetEmail, job.direction);
            }
            await this.redis.removeScheduledJob(jobKey);
        }
    }

    // 🚨 UPDATE: Initialize with volume sync
    async initialize() {
        console.log('🚀 Initializing Bidirectional Warmup Scheduler...');

        // 🚨 FIRST: Initialize volume enforcement
        await VolumeEnforcement.initialize();

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