const getChannel = require('../queues/rabbitConnection');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const EmailPool = require('../models/EmailPool');
const { computeReplyRate } = require('./warmupWorkflow');
const RedisScheduler = require('./redis-scheduler');
const UnifiedWarmupStrategy = require('./unified-strategy');
const { Op } = require('sequelize');

const VolumeEnforcement = require('./volume-enforcement');

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

            // Recover existing schedules with volume protection
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
        console.log(`\n🎯 CREATING BIDIRECTIONAL PLAN FOR: ${warmupAccount.email}`);

        try {
            // 🚨 STEP 1: Get daily summary for WARMUP account
            const warmupSummary = await VolumeEnforcement.getDailySummary(warmupAccount.email, 'warmup');
            console.log(`   📊 WARMUP STATUS: ${warmupSummary.sentToday}/${warmupSummary.volumeLimit} sent, ${warmupSummary.remaining} remaining`);

            // 🚨 STEP 2: Check warmup account capacity
            if (!warmupSummary.canSendMore) {
                console.log(`   🚫 WARMUP BLOCKED: ${warmupAccount.email} has NO capacity`);
                await this.cleanupScheduledJobsForAccount(warmupAccount.email);
                return;
            }

            // 🚨 STEP 3: Get available pools that can send TO warmup account
            const availablePools = [];
            for (const pool of poolAccounts) {
                const poolSummary = await VolumeEnforcement.getDailySummary(pool.email, 'pool');
                if (poolSummary.canSendMore) {
                    availablePools.push(pool);
                    console.log(`   ✅ POOL AVAILABLE: ${pool.email} - ${poolSummary.remaining} remaining`);
                } else {
                    console.log(`   ❌ POOL BLOCKED: ${pool.email} - ${poolSummary.sentToday}/${poolSummary.volumeLimit}`);
                }
            }

            if (availablePools.length === 0) {
                console.log(`   ⚠️  NO AVAILABLE POOLS: All pools are at capacity`);
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

            // 🚨 STEP 6: ENFORCE PROPER RATIOS (NEW)
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

            // 🚨 STEP 8: Schedule OUTBOUND FIRST, then INBOUND with proper delays
            let scheduledOutbound = 0;
            let scheduledInbound = 0;

            // Schedule OUTBOUND emails FIRST (WARMUP → POOL)
            console.log(`   🚀 SCHEDULING OUTBOUND EMAILS FIRST...`);
            for (let i = 0; i < Math.min(finalOutbound.length, warmupMaxToSchedule); i++) {
                const emailJob = finalOutbound[i];
                const scheduled = await this.scheduleSingleEmailWithEnforcement(emailJob, channel, warmupAccount.email);
                if (scheduled) scheduledOutbound++;
            }

            // Schedule INBOUND emails AFTER outbound (POOL → WARMUP)
            console.log(`   📥 SCHEDULING INBOUND EMAILS AFTER OUTBOUND...`);
            const poolUsage = new Map();

            for (let i = 0; i < finalInbound.length; i++) {
                const emailJob = finalInbound[i];
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

                // Stop if we've scheduled all possible inbound emails
                if (scheduledInbound >= totalInboundCapacity) break;
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

    // 🚨 UPDATE THIS METHOD in WarmupScheduler.js
    enforceBidirectionalRatios(outboundEmails, inboundEmails, warmupAccount, actualReplyRate = null) {
        const warmupDay = warmupAccount.warmupDayCount || 0;
        const totalAvailable = outboundEmails.length + inboundEmails.length;

        console.log(`   📊 CURRENT COUNTS: Outbound: ${outboundEmails.length}, Inbound: ${inboundEmails.length}, Total: ${totalAvailable}`);

        // 🆕 GET ACTUAL REPLY RATE FROM DATABASE OR USE CONFIGURED RATE
        const configuredReplyRate = warmupAccount.replyRate || 0.15;
        const effectiveReplyRate = actualReplyRate !== null ? actualReplyRate : configuredReplyRate;

        console.log(`   📨 REPLY RATE: Configured: ${(configuredReplyRate * 100).toFixed(1)}%, Effective: ${(effectiveReplyRate * 100).toFixed(1)}%`);

        // Define dynamic ratios based on warmup progression AND reply rate
        let targetOutboundRatio, targetInboundRatio;

        if (warmupDay === 0) {
            // Day 0: More outbound, adjust based on expected replies
            targetOutboundRatio = 0.7;
            targetInboundRatio = 0.3;
            console.log(`   🎯 Day 0 Strategy: Heavy outbound to initiate conversations`);
        } else if (warmupDay === 1) {
            // Day 1: Balance outbound with EXPECTED replies
            // If reply rate is high, we can schedule less inbound (expecting organic replies)
            const replyAdjustment = effectiveReplyRate * 0.3; // Adjust up to 30% based on reply rate
            targetOutboundRatio = 0.5 + replyAdjustment;
            targetInboundRatio = 0.5 - replyAdjustment;
            console.log(`   🎯 Day 1 Strategy: Balanced with reply rate adjustment`);
        } else if (warmupDay >= 2 && warmupDay <= 7) {
            // Days 2-7: Gradual shift, heavily influenced by actual reply performance
            const progression = Math.min((warmupDay - 1) / 6, 1);

            // Base ratios
            let baseOutbound = 0.5 - (progression * 0.2);
            let baseInbound = 0.5 + (progression * 0.2);

            // Adjust based on reply rate performance
            const replyPerformance = Math.min(effectiveReplyRate / 0.25, 1.5); // Scale based on 25% target
            if (replyPerformance > 1) {
                // Good reply rate - schedule less inbound (expecting organic replies)
                baseOutbound += (replyPerformance - 1) * 0.1;
                baseInbound -= (replyPerformance - 1) * 0.1;
            } else {
                // Poor reply rate - schedule more inbound to maintain engagement
                baseOutbound -= (1 - replyPerformance) * 0.05;
                baseInbound += (1 - replyPerformance) * 0.05;
            }

            targetOutboundRatio = Math.max(0.2, Math.min(0.8, baseOutbound));
            targetInboundRatio = Math.max(0.2, Math.min(0.8, baseInbound));

            console.log(`   🎯 Day ${warmupDay} Strategy: Reply-performance adjusted`);
        } else {
            // Day 8+: Established account, heavily reply-dependent
            const replyBasedOutbound = 0.3 * (1 - effectiveReplyRate); // Less outbound if good replies
            targetOutboundRatio = Math.max(0.2, Math.min(0.4, replyBasedOutbound));
            targetInboundRatio = 1 - targetOutboundRatio;
            console.log(`   🎯 Day ${warmupDay}+ Strategy: Reply-optimized`);
        }

        // Calculate target counts
        let targetOutboundCount = Math.floor(totalAvailable * targetOutboundRatio);
        let targetInboundCount = Math.floor(totalAvailable * targetInboundRatio);

        // Ensure at least 1 email in each direction
        targetOutboundCount = Math.max(1, Math.min(targetOutboundCount, outboundEmails.length));
        targetInboundCount = Math.max(1, Math.min(targetInboundCount, inboundEmails.length));

        console.log(`   ⚖️  FINAL RATIOS: Day ${warmupDay}`);
        console.log(`      ├── Outbound: ${targetOutboundCount} emails (${Math.round((targetOutboundCount / totalAvailable) * 100)}%)`);
        console.log(`      └── Inbound: ${targetInboundCount} emails (${Math.round((targetInboundCount / totalAvailable) * 100)}%)`);
        console.log(`      📨 Reply Rate Impact: ${(effectiveReplyRate * 100).toFixed(1)}%`);

        const finalOutbound = outboundEmails.slice(0, targetOutboundCount);
        const finalInbound = inboundEmails.slice(0, targetInboundCount);

        return { finalOutbound, finalInbound, replyRateUsed: effectiveReplyRate };
    }

    // 🆕 ADD THIS METHOD to WarmupScheduler.js
    async getActualReplyRate(warmupEmail, daysToCheck = 3) {
        try {
            const EmailMetric = require('../models/EmailMetric');
            const { Op } = require('sequelize');

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - daysToCheck);

            // Get metrics from recent days
            const metrics = await EmailMetric.findAll({
                where: {
                    senderEmail: warmupEmail,
                    direction: 'WARMUP_TO_POOL',
                    sentAt: {
                        [Op.gte]: startDate
                    }
                },
                attributes: ['id', 'replied', 'sentAt']
            });

            if (metrics.length === 0) {
                console.log(`   📊 No recent email data for reply rate calculation`);
                return null; // No data yet
            }

            const totalSent = metrics.length;
            const totalReplied = metrics.filter(m => m.replied === true).length;
            const actualReplyRate = totalReplied / totalSent;

            console.log(`   📊 ACTUAL REPLY RATE: ${totalReplied}/${totalSent} = ${(actualReplyRate * 100).toFixed(1)}% (last ${daysToCheck} days)`);

            return actualReplyRate;

        } catch (error) {
            console.error(`❌ Error calculating actual reply rate:`, error);
            return null;
        }
    }

    // 🆕 ADD THIS HELPER METHOD
    getWarmupStrategyDescription(warmupDay) {
        const strategies = {
            0: "Initiation Phase - Heavy outbound to start conversations",
            1: "Balance Phase - Equal outbound/inbound for reputation building",
            2: "Growth Phase - Gradual shift toward more inbound",
            3: "Growth Phase - Continuing reputation development",
            4: "Growth Phase - Building organic engagement",
            5: "Growth Phase - Establishing consistent flow",
            6: "Growth Phase - Nearing established status",
            7: "Transition Phase - Moving to inbound-heavy",
            8: "Established Phase - Primarily inbound/replies"
        };

        return strategies[warmupDay] || strategies[Math.min(warmupDay, 8)];
    }
    // 🚨 NEW: Individual email scheduling with enforcement
    async scheduleSingleEmailWithEnforcement(emailJob, channel, warmupEmail) {
        try {
            const targetEmail = emailJob.direction === 'WARMUP_TO_POOL' ? warmupEmail : emailJob.senderEmail;
            const targetType = emailJob.direction === 'WARMUP_TO_POOL' ? 'warmup' : 'pool';

            // 🚨 FINAL CHECK: Can this specific email be sent?
            const canSendThisEmail = await VolumeEnforcement.canAccountSendEmail(targetEmail, targetType);

            if (!canSendThisEmail) {
                console.log(`   🚫 EMAIL BLOCKED: ${targetEmail} cannot send this email`);
                return false;
            }

            const scheduleTime = new Date(Date.now() + emailJob.scheduleDelay);
            const jobKey = `${scheduleTime.toISOString()}_${emailJob.senderEmail}_${emailJob.receiverEmail}_${emailJob.direction}`;

            const job = {
                timeSlot: scheduleTime.toISOString(),
                pairs: [emailJob],
                timestamp: new Date().toISOString(),
                individualSchedule: true,
                scheduledTime: scheduleTime.toISOString(),
                warmupAccount: warmupEmail,
                direction: emailJob.direction
            };

            await this.redis.storeScheduledJob(jobKey, job);

            const timeoutId = setTimeout(async () => {
                try {
                    console.log(`\n🎯 EXECUTING: ${emailJob.direction}`);
                    console.log(`   ${emailJob.senderEmail} → ${emailJob.receiverEmail}`);

                    // 🚨 ULTRA-FINAL CHECK: Right before execution
                    const canStillExecute = await VolumeEnforcement.canAccountSendEmail(targetEmail, targetType);

                    if (!canStillExecute) {
                        console.log(`   💥 EXECUTION BLOCKED: ${targetEmail} hit limit at execution time`);
                        await this.redis.removeScheduledJob(jobKey);
                        return;
                    }

                    // 🚨 ACTUALLY QUEUE THE JOB
                    await channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(job)), {
                        persistent: true
                    });

                    console.log(`   ✅ EXECUTION QUEUED`);
                    await this.redis.removeScheduledJob(jobKey);

                } catch (error) {
                    console.error('❌ EXECUTION ERROR:', error);
                }
            }, emailJob.scheduleDelay);

            this.scheduledJobs.set(jobKey, timeoutId);
            console.log(`   ⏰ SCHEDULED: ${emailJob.direction} in ${Math.round(emailJob.scheduleDelay / 60000)}min`);
            return true;

        } catch (error) {
            console.error(`❌ SCHEDULING ERROR:`, error);
            return false;
        }
    }

    // 🚨 REPLACE the old method
    async scheduleBidirectionalEmail(emailJob, channel, warmupEmail) {
        return await this.scheduleSingleEmailWithEnforcement(emailJob, channel, warmupEmail);
    }



    // 🚨 UPDATE THE REAL-TIME EXECUTION CHECK METHOD
    async canExecuteEmailNow(warmupEmail, direction, poolEmail = null) {
        try {
            if (direction === 'WARMUP_TO_POOL') {
                return await VolumeEnforcement.canAccountSendEmail(warmupEmail, 'warmup');
            } else { // POOL_TO_WARMUP
                return await VolumeEnforcement.canAccountSendEmail(poolEmail, 'pool');
            }
        } catch (error) {
            console.error(`❌ Error in real-time execution check:`, error);
            return false; // Fail safe - don't execute if we can't verify
        }
    }

    // Add this method to your WarmupScheduler class
    async emergencyVolumeCheck(email) {
        try {
            return await VolumeEnforcement.canAccountSendEmail(email, 'warmup');
        } catch (error) {
            console.error(`❌ Emergency volume check failed for ${email}:`, error);
            return false; // Fail safe - don't send if we can't verify
        }
    }

    async cancelAccountJobs(email) {
        // Cancel all scheduled jobs for this account
        for (const [jobKey, timeoutId] of this.scheduledJobs) {
            if (jobKey.includes(email)) {
                clearTimeout(timeoutId);
                this.scheduledJobs.delete(jobKey);
                await this.redis.removeScheduledJob(jobKey);
                console.log(`   🚫 Cancelled job: ${jobKey}`);
            }
        }
    }

    // ENHANCED RECOVERY WITH DATABASE VOLUME PROTECTION
    async recoverScheduledJobs(channel) {
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
                    // 🚨 CENTRALIZED VOLUME VALIDATION DURING RECOVERY
                    let canExecute = true;

                    if (jobData.direction === 'WARMUP_TO_POOL') {
                        canExecute = await VolumeEnforcement.canAccountSendEmail(jobData.warmupAccount, 'warmup');
                        if (!canExecute) {
                            console.log(`   ⚠️  Skipping recovery - warmup volume limit reached: ${jobData.warmupAccount}`);
                        }
                    } else { // POOL_TO_WARMUP
                        const senderEmail = jobData.pairs[0].senderEmail;
                        canExecute = await VolumeEnforcement.canAccountSendEmail(senderEmail, 'pool');
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

    // Add this method to WarmupScheduler to clean up scheduled jobs
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

    // UPDATED: Get warmup account volume with STRICT database values
    async getWarmupAccountVolume(email) {
        return await VolumeEnforcement.getAccountVolumeLimit(email, 'warmup');
    }

    // NEW: Get remaining capacity for warmup account
    async getWarmupRemainingCapacity(email) {
        return await VolumeEnforcement.getRemainingCapacity(email, 'warmup');
    }

    // NEW: Get how many emails warmup account sent today
    async getWarmupSentToday(email) {
        return await VolumeEnforcement.getSentTodayCount(email, 'warmup');
    }

    // UPDATED: Check if warmup account can send more
    async canWarmupAccountSendMore(email) {
        return await VolumeEnforcement.canAccountSendEmail(email, 'warmup');
    }

    // UPDATED: Check if pool account can send more
    async canPoolAccountSendMore(email) {
        return await VolumeEnforcement.canAccountSendEmail(email, 'pool');
    }

    async getPoolAccountCapacity(email) {
        return await VolumeEnforcement.getRemainingCapacity(email, 'pool');
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

    // In WarmupScheduler - FIX getActivePoolAccounts method

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

            // Check if pool has capacity using centralized service
            const canSend = await VolumeEnforcement.canAccountSendEmail(pool.email, 'pool');
            if (canSend) {
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