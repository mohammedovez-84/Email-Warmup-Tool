const getChannel = require('../queues/rabbitConnection');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const EmailPool = require('../models/EmailPool');
const { computeEmailsToSend, computeReplyRate } = require('./warmupWorkflow');

class WarmupScheduler {
    constructor() {
        this.isRunning = false;
        this.scheduledJobs = new Map();
        this.EMAIL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes between emails in same slot
        this.TESTING_MODE = process.env.WARMUP_TESTING_MODE === 'true';
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

            console.log('🚀 Starting warmup scheduling...');
            await this.scheduleAccountWarmup(channel);

            console.log('✅ Warmup scheduling completed');

        } catch (error) {
            console.error('❌ Scheduling error:', error);
            this.isRunning = false;
        }
    }

    async scheduleAccountWarmup(channel) {
        console.log('📧 Scheduling ACCOUNT ↔ POOL warmup exchanges...');

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

        const warmupPlan = await this.createWarmupPlan(activeAccounts, activePools);
        await this.scheduleJobsWithIntervals(channel, warmupPlan);
    }

    async getActiveWarmupAccounts() {
        const googleAccounts = await GoogleUser.findAll({
            where: { warmupStatus: 'active', is_connected: true }
        });
        const smtpAccounts = await SmtpAccount.findAll({
            where: { warmupStatus: 'active', is_connected: true }
        });
        const microsoftAccounts = await MicrosoftUser.findAll({
            where: { warmupStatus: 'active', is_connected: true }
        });

        console.log(`📊 Active warmup accounts:`);
        console.log(`   Google: ${googleAccounts.length}, SMTP: ${smtpAccounts.length}, Microsoft: ${microsoftAccounts.length}`);

        const allAccounts = [...googleAccounts, ...smtpAccounts, ...microsoftAccounts];

        // Log account details with FIXED sendLimit handling
        for (const account of allAccounts) {
            const sendLimit = await computeEmailsToSend(account);
            const safeSendLimit = this.ensureNumber(sendLimit, 3);
            console.log(`   ${account.email}: Day ${account.warmupDayCount || 0}, Send Limit: ${safeSendLimit}, ReplyRate: ${account.replyRate || 0.15}`);
        }

        return allAccounts;
    }

    async getActivePoolAccounts() {
        const poolAccounts = await EmailPool.findAll({
            where: { isActive: true }
        });

        console.log(`🏊 Active pool accounts: ${poolAccounts.length}`);
        poolAccounts.forEach(pool => {
            console.log(`   ${pool.email} (${pool.providerType})`);
        });

        return poolAccounts;
    }

    async createWarmupPlan(warmupAccounts, poolAccounts) {
        console.log(`🎯 Creating warmup plan for ${warmupAccounts.length} accounts with ${poolAccounts.length} pool emails`);

        const plan = {
            timeSlots: new Map(),
            totalEmails: 0,
            accountStats: new Map(),
            poolStats: new Map(),
            startTime: new Date() // CRITICAL: Store current time as warmup start time
        };

        // Calculate individual sending limits for warmup accounts
        const accountSendLimits = new Map();
        const accountSentCounts = new Map();
        const poolReceiveCounts = new Map();

        // Initialize counts
        for (const account of warmupAccounts) {
            const sendLimit = await computeEmailsToSend(account);
            const safeSendLimit = this.ensureNumber(sendLimit, 3);
            accountSendLimits.set(account.email, safeSendLimit);
            accountSentCounts.set(account.email, 0);
            plan.accountStats.set(account.email, { sent: 0, received: 0 });
        }

        for (const pool of poolAccounts) {
            poolReceiveCounts.set(pool.email, 0);
            plan.poolStats.set(pool.email, { received: 0, replied: 0 });
        }

        console.log('📊 Warmup Account Send Limits:');
        for (const [email, limit] of accountSendLimits) {
            console.log(`   ${email}: ${limit} emails to SEND to pool`);
        }

        // Create balanced pairs with CURRENT TIME as starting point
        const allPairs = await this.createBalancedPairs(
            warmupAccounts,
            poolAccounts,
            accountSendLimits,
            accountSentCounts,
            poolReceiveCounts,
            plan.startTime // Pass current time as starting point
        );

        // Initialize stats for any accounts that might have been missed
        this.initializeAllStats(plan, allPairs);

        // Distribute to time slots
        await this.distributeToTimeSlots(allPairs, plan, accountSendLimits);

        // Final validation
        this.validateDistribution(warmupAccounts, poolAccounts, plan, accountSendLimits);

        return plan;
    }

    initializeAllStats(plan, allPairs) {
        const allSenders = new Set();
        const allReceivers = new Set();

        allPairs.forEach(round => {
            round.pairs.forEach(pair => {
                allSenders.add(pair.senderEmail);
                allReceivers.add(pair.receiverEmail);
            });
        });

        allSenders.forEach(email => {
            if (!plan.accountStats.has(email)) {
                console.log(`⚠️  Initializing missing account stats for: ${email}`);
                plan.accountStats.set(email, { sent: 0, received: 0 });
            }
        });

        allReceivers.forEach(email => {
            if (!plan.poolStats.has(email)) {
                console.log(`⚠️  Initializing missing pool stats for: ${email}`);
                plan.poolStats.set(email, { received: 0, replied: 0 });
            }
        });
    }

    async createBalancedPairs(warmupAccounts, poolAccounts, sendLimits, sentCounts, poolReceiveCounts) {
        console.log(`\n🔄 Creating warmup schedule - ${this.TESTING_MODE ? 'TESTING MODE (2-3 min intervals)' : 'PRODUCTION MODE (24-hour distribution)'}`);

        const rounds = [];
        const now = new Date();

        for (const warmupAccount of warmupAccounts) {
            const warmupEmail = warmupAccount.email;
            const warmupReplyRate = await computeReplyRate(warmupAccount) || 0.15;
            const warmupSendLimit = sendLimits.get(warmupEmail);
            const warmupDayCount = warmupAccount.warmupDayCount || 0;

            // ✅ FIXED: Use correct variable names
            console.log(`   🔄 ${warmupEmail}: Day ${warmupDayCount}, Send Limit: ${warmupSendLimit}, Reply Rate: ${(warmupReplyRate * 100).toFixed(1)}%`);

            // **STEP 1: REGULAR EMAILS FROM ALL POOL ACCOUNTS**
            console.log(`\n📥 ROUND 1: Emails from ALL ${poolAccounts.length} pool accounts`);
            const receivePairs = [];

            for (let i = 0; i < poolAccounts.length; i++) {
                const poolAccount = poolAccounts[i];

                let scheduleDelay;

                if (this.TESTING_MODE) {
                    // TESTING: 2-3 minute intervals
                    scheduleDelay = (2 + (i * 1)) * 60 * 1000; // 2min, 3min, 4min, etc.
                    console.log(`       🧪 TESTING: ${poolAccount.email} → ${warmupEmail} in ${scheduleDelay / 60000} mins`);
                } else {
                    // PRODUCTION: 24-hour distribution (1-24 hours)
                    const minDelay = 60 * 60 * 1000; // 1 hour
                    const maxDelay = 24 * 60 * 60 * 1000; // 24 hours
                    const baseDelay = minDelay + (i * (maxDelay - minDelay)) / Math.max(1, poolAccounts.length - 1);
                    const randomVariance = (Math.random() - 0.5) * (2 * 60 * 60 * 1000); // ±2 hours
                    scheduleDelay = Math.max(minDelay, Math.min(maxDelay, baseDelay + randomVariance));
                    console.log(`       📥 PRODUCTION: ${poolAccount.email} → ${warmupEmail} in ${Math.round(scheduleDelay / (60 * 60 * 1000))} hours`);
                }

                const pair = {
                    sender: poolAccount,
                    senderEmail: poolAccount.email,
                    senderType: 'pool',
                    receiver: warmupAccount,
                    receiverEmail: warmupEmail,
                    receiverType: this.getSenderType(warmupAccount),
                    replyRate: warmupReplyRate,
                    warmupDay: warmupDayCount,
                    round: 1,
                    isInitialEmail: true,
                    direction: 'POOL_TO_WARMUP',
                    scheduleDelay: scheduleDelay,
                    slotInterval: 0,
                    doesNotCount: false
                };

                receivePairs.push(pair);
                poolReceiveCounts.set(poolAccount.email, (poolReceiveCounts.get(poolAccount.email) || 0) + 1);
            }

            rounds.push({
                roundNumber: 1,
                pairs: receivePairs,
                type: 'RECEIVE_FROM_ALL_POOLS',
                scheduleDelay: this.TESTING_MODE ? (2 * 60 * 1000) : (60 * 60 * 1000)
            });

            // **STEP 2: ADDITIONAL EMAILS IF NEEDED**
            const regularEmailsScheduled = receivePairs.length;
            const emailsNeededFromDB = warmupSendLimit;
            const additionalEmailsNeeded = Math.max(0, emailsNeededFromDB - regularEmailsScheduled);

            let additionalPairs = [];

            if (additionalEmailsNeeded > 0) {
                console.log(`\n📥 ROUND 2: Additional ${additionalEmailsNeeded} emails to reach DB limit`);

                for (let i = 0; i < additionalEmailsNeeded; i++) {
                    const poolAccount = poolAccounts[i % poolAccounts.length];

                    let scheduleDelay;

                    if (this.TESTING_MODE) {
                        // TESTING: Schedule after all initial emails (5-10 minutes)
                        scheduleDelay = (5 + (i * 2)) * 60 * 1000;
                        console.log(`       🧪 TESTING: Additional ${poolAccount.email} → ${warmupEmail} in ${scheduleDelay / 60000} mins`);
                    } else {
                        // PRODUCTION: Schedule later in the day (12-24 hours)
                        const baseDelay = 12 * 60 * 60 * 1000 + (i * 4 * 60 * 60 * 1000);
                        const randomVariance = (Math.random() - 0.5) * (2 * 60 * 60 * 1000);
                        scheduleDelay = baseDelay + randomVariance;
                        console.log(`       📥 PRODUCTION: Additional ${poolAccount.email} → ${warmupEmail} in ${Math.round(scheduleDelay / (60 * 60 * 1000))} hours`);
                    }

                    const pair = {
                        sender: poolAccount,
                        senderEmail: poolAccount.email,
                        senderType: 'pool',
                        receiver: warmupAccount,
                        receiverEmail: warmupEmail,
                        receiverType: this.getSenderType(warmupAccount),
                        replyRate: warmupReplyRate,
                        warmupDay: warmupDayCount,
                        round: 2,
                        isInitialEmail: true,
                        direction: 'POOL_TO_WARMUP',
                        scheduleDelay: scheduleDelay,
                        slotInterval: 0,
                        doesNotCount: false
                    };

                    additionalPairs.push(pair);
                    poolReceiveCounts.set(poolAccount.email, (poolReceiveCounts.get(poolAccount.email) || 0) + 1);
                }

                rounds.push({
                    roundNumber: 2,
                    pairs: additionalPairs,
                    type: 'ADDITIONAL_TO_REACH_LIMIT',
                    scheduleDelay: this.TESTING_MODE ? (5 * 60 * 1000) : (12 * 60 * 60 * 1000)
                });
            }

            // **STEP 3: WARMUP REPLIES (only if past day 0)**
            // Replies are handled automatically by the maybeReply function in warmupWorkflow
            // No need to schedule them separately - they happen based on replyRate
            if (warmupDayCount > 0) {
                console.log(`\n📨 REPLY INFO: ${warmupEmail} can send replies (Day ${warmupDayCount}+)`);
                console.log(`     🔄 Reply rate: ${(warmupReplyRate * 100).toFixed(1)}%`);
                console.log(`     📧 Replies will be handled automatically by maybeReply() function`);
            } else {
                console.log(`   🔄 ${warmupEmail}: Day 0 - Only receiving emails, no sending`);
            }

            // **SUMMARY**
            const totalEmails = receivePairs.length + additionalPairs.length;
            console.log(`\n   ✅ ${warmupEmail} Schedule Summary (${this.TESTING_MODE ? 'TESTING' : 'PRODUCTION'}):`);
            console.log(`       📥 Receiving: ${totalEmails} emails`);
            console.log(`       📊 DB Limit: ${warmupSendLimit}`);
            console.log(`       🔄 Reply handling: Automatic via maybeReply() function`);
        }

        const totalAllEmails = rounds.reduce((total, round) => total + round.pairs.length, 0);
        console.log(`\n   ✅ Created ${this.TESTING_MODE ? 'TESTING' : 'PRODUCTION'} schedule with ${totalAllEmails} total emails`);

        return rounds;
    }

    async distributeToTimeSlots(rounds, plan, sendLimits) {
        if (!rounds || rounds.length === 0) {
            console.log('⚠️ No rounds to distribute');
            return;
        }

        console.log(`\n📅 Distributing emails from ${rounds.length} rounds to time slots...`);

        const now = plan.startTime;
        let totalScheduled = 0;
        let testEmailsScheduled = 0;
        let countedEmailsScheduled = 0;

        // RESET all counts first for accurate tracking
        plan.accountStats.clear();
        plan.poolStats.clear();

        rounds.forEach(round => {
            if (round.pairs && Array.isArray(round.pairs)) {
                round.pairs.forEach(pair => {
                    const delay = pair.scheduleDelay || round.scheduleDelay || 0;
                    const slotTime = new Date(now.getTime() + delay);
                    const timeKey = slotTime.toISOString();

                    if (!plan.timeSlots.has(timeKey)) {
                        plan.timeSlots.set(timeKey, []);
                    }

                    plan.timeSlots.get(timeKey).push(pair);
                    plan.totalEmails++;
                    totalScheduled++;

                    // Initialize stats properly for all involved accounts
                    if (!plan.accountStats.has(pair.senderEmail)) {
                        plan.accountStats.set(pair.senderEmail, { sent: 0, received: 0 });
                    }
                    if (!plan.accountStats.has(pair.receiverEmail)) {
                        plan.accountStats.set(pair.receiverEmail, { sent: 0, received: 0 });
                    }
                    if (!plan.poolStats.has(pair.receiverEmail)) {
                        plan.poolStats.set(pair.receiverEmail, { received: 0, replied: 0 });
                    }
                    if (!plan.poolStats.has(pair.senderEmail)) {
                        plan.poolStats.set(pair.senderEmail, { received: 0, replied: 0 });
                    }

                    const senderStats = plan.accountStats.get(pair.senderEmail);
                    const receiverStats = plan.accountStats.get(pair.receiverEmail);
                    const senderPoolStats = plan.poolStats.get(pair.senderEmail);
                    const receiverPoolStats = plan.poolStats.get(pair.receiverEmail);

                    // CORRECT stats counting based on direction and account type
                    if (pair.direction === 'POOL_TO_WARMUP') {
                        // Only count if it's NOT a test email
                        if (!pair.doesNotCount) {
                            // Pool account sends to warmup account
                            if (senderPoolStats) senderPoolStats.received++; // Pool sent count
                            if (receiverStats) receiverStats.received++; // Warmup received count
                            countedEmailsScheduled++;

                            const delayMinutes = Math.round(delay / (60 * 1000));
                            console.log(`   🕐 ${slotTime.toLocaleTimeString()} (in ${delayMinutes} mins): ${pair.senderEmail} → ${pair.receiverEmail} [${pair.direction}] - COUNTS`);
                        } else {
                            // This is a test email - don't count toward limits
                            testEmailsScheduled++;
                            const delayMinutes = Math.round(delay / (60 * 1000));
                            console.log(`   🕐 ${slotTime.toLocaleTimeString()} (in ${delayMinutes} mins): ${pair.senderEmail} → ${pair.receiverEmail} [${pair.direction}] - TEST (NO COUNT)`);
                        }
                    } else if (pair.direction === 'WARMUP_REPLY' || pair.direction === 'WARMUP_TO_POOL') {
                        // Warmup account sends to pool account
                        if (senderStats) senderStats.sent++; // Warmup sent count
                        if (receiverPoolStats) receiverPoolStats.received++; // Pool received count
                        countedEmailsScheduled++;

                        const delayMinutes = Math.round(delay / (60 * 1000));
                        console.log(`   🕐 ${slotTime.toLocaleTimeString()} (in ${delayMinutes} mins): ${pair.senderEmail} → ${pair.receiverEmail} [${pair.direction}] - COUNTS`);
                    } else {
                        // Fallback for any other directions
                        const delayMinutes = Math.round(delay / (60 * 1000));
                        console.log(`   🕐 ${slotTime.toLocaleTimeString()} (in ${delayMinutes} mins): ${pair.senderEmail} → ${pair.receiverEmail} [${pair.direction}]`);
                    }
                });
            }
        });

        console.log(`\n📊 Email Distribution Summary:`);
        console.log(`   ✅ Total emails scheduled: ${totalScheduled}`);
        console.log(`   🚀 Test emails (no count): ${testEmailsScheduled}`);
        console.log(`   📥 Counted emails: ${countedEmailsScheduled}`);
        console.log(`   🕐 Scheduling started from: ${now.toLocaleString()}`);

        // Validate that we're meeting DB requirements
        this.validateEmailCounts(plan, sendLimits, testEmailsScheduled, countedEmailsScheduled);
    }

    // Add this helper method to validate email counts
    validateEmailCounts(plan, sendLimits, testEmails, countedEmails) {
        console.log(`\n📋 VALIDATING EMAIL COUNTS AGAINST DB REQUIREMENTS:`);
        console.log('='.repeat(60));

        let allRequirementsMet = true;

        for (const [email, limit] of sendLimits) {
            const accountStat = plan.accountStats.get(email) || { sent: 0, received: 0 };
            const receivedCount = accountStat.received || 0;

            console.log(`   ${email}:`);
            console.log(`     📊 DB Requirement: ${limit} emails`);
            console.log(`     📥 Currently scheduled: ${receivedCount} counted + ${testEmails} test`);
            console.log(`     📈 Total incoming: ${receivedCount + testEmails} emails`);

            if (receivedCount >= limit) {
                console.log(`     ✅ SUCCESS: Meets DB requirement (${receivedCount}/${limit})`);
            } else {
                console.log(`     ❌ SHORTAGE: Needs ${limit - receivedCount} more counted emails`);
                allRequirementsMet = false;
            }

            // Check if receiving from all pool accounts
            const poolEmails = Array.from(plan.poolStats.keys()).filter(poolEmail =>
                poolEmail !== email && plan.poolStats.get(poolEmail)?.received > 0
            );
            console.log(`     🏊 Receiving from ${poolEmails.length} pool accounts: ${poolEmails.join(', ')}`);
        }

        console.log(`\n   📈 OVERALL: ${allRequirementsMet ? '✅ ALL REQUIREMENTS MET' : '❌ SOME REQUIREMENTS NOT MET'}`);
        console.log('='.repeat(60));

        return allRequirementsMet;
    }

    async scheduleJobsWithIntervals(channel, warmupPlan) {
        let totalScheduled = 0;

        if (!warmupPlan.timeSlots || warmupPlan.timeSlots.size === 0) {
            console.log('⚠️  No time slots to schedule');
            this.isRunning = false;
            return;
        }

        console.log(`\n🕐 Scheduling ${warmupPlan.timeSlots.size} time slots with 15-minute intervals...`);

        const now = new Date(); // Current time for scheduling comparison

        for (const [timeString, pairs] of warmupPlan.timeSlots) {
            if (!pairs || pairs.length === 0) {
                console.log(`⚠️  Skipping empty time slot: ${timeString}`);
                continue;
            }

            const baseTime = new Date(timeString);

            // CRITICAL FIX: Skip past time slots and only schedule future emails
            if (baseTime < now) {
                console.log(`⏩ Skipping past time slot: ${baseTime.toLocaleString()} (current: ${now.toLocaleString()})`);
                continue;
            }

            // Sort pairs by their slotInterval to ensure proper ordering
            const sortedPairs = pairs.sort((a, b) => (a.slotInterval || 0) - (b.slotInterval || 0));

            console.log(`\n📅 Time Slot: ${baseTime.toLocaleTimeString()} - ${sortedPairs.length} emails`);

            for (let i = 0; i < sortedPairs.length; i++) {
                const pair = sortedPairs[i];
                const individualDelay = (baseTime.getTime() + (pair.slotInterval || 0)) - now.getTime();

                // CRITICAL: Only schedule if the individual email time is in the future
                if (individualDelay > 0) {
                    const individualTime = new Date(baseTime.getTime() + (pair.slotInterval || 0));

                    console.log(`   📧 Email ${i + 1}/${sortedPairs.length}: ${individualTime.toLocaleTimeString()} - ${pair.senderEmail} → ${pair.receiverEmail}`);

                    const job = {
                        timeSlot: timeString,
                        pairs: [pair],
                        timestamp: new Date().toISOString(),
                        coordinated: true,
                        round: pair.round || 1,
                        individualSchedule: true,
                        scheduledTime: individualTime.toISOString()
                    };

                    const timeoutId = setTimeout(async () => {
                        try {
                            console.log(`\n🎯 EXECUTING INDIVIDUAL EMAIL: ${individualTime.toLocaleTimeString()}`);
                            console.log(`   Processing: ${pair.senderEmail} → ${pair.receiverEmail} [${pair.direction}]`);

                            await channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(job)), {
                                persistent: true,
                                priority: 5
                            });

                            console.log(`   ✅ Individual email queued successfully`);
                        } catch (error) {
                            console.error('❌ Error queuing individual email:', error);
                        }
                    }, individualDelay);

                    const jobKey = `${timeString}_${i}`;
                    this.scheduledJobs.set(jobKey, timeoutId);
                    totalScheduled++;
                } else {
                    console.log(`   ⏩ Skipping past individual email: ${pair.senderEmail} → ${pair.receiverEmail} (scheduled: ${new Date(baseTime.getTime() + (pair.slotInterval || 0)).toLocaleTimeString()})`);
                }
            }
        }

        if (totalScheduled === 0) {
            console.log('⚠️  No jobs scheduled - all time slots were in the past');
        } else {
            console.log(`\n✅ Successfully scheduled ${totalScheduled} individual emails across ${warmupPlan.timeSlots.size} time slots`);
            console.log(`   📊 Emails are spaced ${this.EMAIL_INTERVAL_MS / (60 * 1000)} minutes apart within each time slot`);
            console.log(`   🕐 Scheduling started from: ${now.toLocaleString()}`);
        }

        this.isRunning = false;
    }
    validateDistribution(warmupAccounts, poolAccounts, plan, sendLimits) {
        console.log('\n📊 FINAL DISTRIBUTION VALIDATION:');
        console.log('='.repeat(60));

        let totalWarmupSent = 0;
        let totalWarmupReceived = 0;
        let totalWarmupReceivedCounted = 0;
        let totalPoolSent = 0;
        let allLimitsMet = true;

        console.log('🔥 WARMUP ACCOUNTS:');
        for (const account of warmupAccounts) {
            const email = account.email;
            const accountStat = plan.accountStats.get(email) || { sent: 0, received: 0 };
            const sent = accountStat.sent || 0;
            const received = accountStat.received || 0; // This only includes COUNTED emails
            const limit = sendLimits.get(email);

            totalWarmupSent += sent;
            totalWarmupReceivedCounted += received;

            // Calculate total received (including test emails)
            const totalReceived = this.calculateTotalReceivedEmails(plan, email);
            totalWarmupReceived += totalReceived;

            const sentStatus = sent <= limit ? '✅' : '❌';
            const receivedStatus = received >= limit ? '✅' : '❌';

            console.log(`   ${email}:`);
            console.log(`     Sent: ${sent}/${limit} ${sentStatus}`);
            console.log(`     Received (counted): ${received}/${limit} ${receivedStatus}`);
            console.log(`     Received (total): ${totalReceived} emails`);
            console.log(`     DB Requirement: ${limit} counted emails`);

            if (received < limit) {
                allLimitsMet = false;
                console.log(`     ⚠️  NEEDS ${limit - received} more counted emails`);
            }
        }

        console.log('\n🏊 POOL ACCOUNTS:');
        for (const pool of poolAccounts) {
            const poolStat = plan.poolStats.get(pool.email) || { received: 0, replied: 0 };
            const sent = poolStat.received || 0;
            totalPoolSent += sent;

            const sendingTo = Array.from(plan.accountStats.entries())
                .filter(([email, stat]) => email !== pool.email && stat.received > 0)
                .map(([email]) => email);

            console.log(`   ${pool.email}: Sent ${sent} emails to: ${sendingTo.join(', ') || 'none'}`);
        }

        console.log(`\n📈 SYSTEM SUMMARY:`);
        console.log(`   Warmup Accounts Sent: ${totalWarmupSent}`);
        console.log(`   Warmup Accounts Received (counted): ${totalWarmupReceivedCounted}`);
        console.log(`   Warmup Accounts Received (total): ${totalWarmupReceived}`);
        console.log(`   Pool Accounts Sent: ${totalPoolSent}`);
        console.log(`   All DB Limits Met: ${allLimitsMet ? '✅ YES' : '❌ NO'}`);
        console.log(`   Start Time: ${plan.startTime.toLocaleString()}`);
        console.log('='.repeat(60));
    }

    // Helper method to calculate total received emails (including test emails)
    calculateTotalReceivedEmails(plan, email) {
        let total = 0;

        for (const [timeKey, pairs] of plan.timeSlots) {
            for (const pair of pairs) {
                if (pair.receiverEmail === email && pair.direction === 'POOL_TO_WARMUP') {
                    total++;
                }
            }
        }

        return total;
    }

    // Helper methods for random selection
    getRandomPoolAccounts(poolAccounts, count) {
        if (count >= poolAccounts.length) {
            return [...poolAccounts].sort(() => Math.random() - 0.5);
        }

        // Fisher-Yates shuffle for true randomness
        const shuffled = [...poolAccounts];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled.slice(0, count);
    }

    getRandomItems(array, count) {
        const shuffled = [...array].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
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

    stopScheduler() {
        this.clearScheduledJobs();
        this.isRunning = false;
        console.log('🛑 Warmup scheduler stopped');
    }

    async incrementWarmupDayCount() {
        try {
            const activeAccounts = await this.getActiveWarmupAccounts();
            for (const account of activeAccounts) {
                const newDayCount = (account.warmupDayCount || 0) + 1;

                if (account.provider === 'google' || account.roundRobinIndexGoogle !== undefined) {
                    await GoogleUser.update(
                        { warmupDayCount: newDayCount },
                        { where: { email: account.email } }
                    );
                } else if (account.provider === 'microsoft' || account.roundRobinIndexMicrosoft !== undefined) {
                    await MicrosoftUser.update(
                        { warmupDayCount: newDayCount },
                        { where: { email: account.email } }
                    );
                } else {
                    await SmtpAccount.update(
                        { warmupDayCount: newDayCount },
                        { where: { email: account.email } }
                    );
                }
            }
            console.log('📈 Warmup day incremented for all active accounts');
        } catch (error) {
            console.error('❌ Error incrementing warmup day count:', error);
        }
    }

    async triggerImmediateScheduling() {
        try {
            console.log('🚀 TRIGGER: Immediate scheduling requested...');

            if (this.isRunning) {
                console.log('🔄 Scheduler already running, waiting for current cycle to complete...');
                return;
            }

            this.clearScheduledJobs();
            await this.scheduleWarmup();

            console.log('✅ TRIGGER: Immediate scheduling completed successfully');
        } catch (error) {
            console.error('❌ TRIGGER: Immediate scheduling failed:', error);
            throw error;
        }
    }

    ensureNumber(value, defaultValue = 3) {
        if (typeof value === 'number' && !isNaN(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed)) return parsed;
        }
        console.log(`⚠️  Converting non-number value to default: ${defaultValue}`);
        return defaultValue;
    }
}

// Create singleton instance
const schedulerInstance = new WarmupScheduler();

module.exports = {
    scheduleWarmup: () => schedulerInstance.scheduleWarmup(),
    stopScheduler: () => schedulerInstance.stopScheduler(),
    WarmupScheduler,
    triggerImmediateScheduling: () => schedulerInstance.triggerImmediateScheduling(),
}