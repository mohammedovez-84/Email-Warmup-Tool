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
        await this.scheduleJobs(channel, warmupPlan);
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
            // FIX: Ensure sendLimit is a number
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
            poolStats: new Map()
        };

        // Calculate individual sending limits for warmup accounts
        const accountSendLimits = new Map();
        const accountSentCounts = new Map();
        const poolReceiveCounts = new Map();

        // Initialize counts - ensure ALL accounts are initialized
        for (const account of warmupAccounts) {
            const sendLimit = await computeEmailsToSend(account);
            // FIX: Ensure sendLimit is a number
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

        // Create balanced pairs
        const allPairs = await this.createBalancedPairs(
            warmupAccounts,
            poolAccounts,
            accountSendLimits,
            accountSentCounts,
            poolReceiveCounts
        );

        // Initialize stats for any accounts that might have been missed
        this.initializeAllStats(plan, allPairs);

        // Distribute to time slots
        await this.distributeToTimeSlots(allPairs, plan);

        // Final validation
        this.validateDistribution(warmupAccounts, poolAccounts, accountSentCounts, poolReceiveCounts, accountSendLimits);

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
        console.log(`\n🔄 Creating time-based warmup schedule`);

        const rounds = [];
        const now = new Date();

        // Reset counts
        for (const account of warmupAccounts) {
            sentCounts.set(account.email, 0);
        }
        for (const pool of poolAccounts) {
            poolReceiveCounts.set(pool.email, 0);
        }

        // STEP 1: Immediate Pool → Warmup (First emails within 2 minutes)
        console.log(`\n📥 ROUND 1: Immediate Pool → Warmup (First emails in 2 minutes)`);
        const round1Pairs = [];

        for (const warmupAccount of warmupAccounts) {
            const warmupEmail = warmupAccount.email;
            const warmupReplyRate = await computeReplyRate(warmupAccount) || 0.25;
            const warmupSendLimit = sendLimits.get(warmupEmail);
            const warmupDayCount = warmupAccount.warmupDayCount || 0;

            console.log(`   🔄 ${warmupEmail}: Day ${warmupDayCount} - Send Limit: ${warmupSendLimit}`);

            // DAY 0 LOGIC: Only receive, no sending
            if (warmupDayCount === 0) {
                const initialReceiveEmails = Math.min(4, Math.max(3, poolAccounts.length));
                console.log(`     📥 Day 0 Strategy: Receiving ${initialReceiveEmails} emails (NO SENDING)`);

                for (let i = 0; i < initialReceiveEmails; i++) {
                    const poolAccount = poolAccounts[i % poolAccounts.length];

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
                        scheduleDelay: 2 * 60 * 1000
                    };

                    round1Pairs.push(pair);
                    poolReceiveCounts.set(poolAccount.email, (poolReceiveCounts.get(poolAccount.email) || 0) + 1);
                    console.log(`       📥 ${poolAccount.email} → ${warmupEmail} (receive ${i + 1}/${initialReceiveEmails})`);
                }
            }
            // DAY 1+ LOGIC: Balanced sending and receiving
            else {
                const receiveEmails = Math.min(3, Math.floor(warmupSendLimit * 0.6));
                console.log(`     🔄 Day ${warmupDayCount}+ Strategy: Receive ${receiveEmails}, Send ${warmupSendLimit}`);

                for (let i = 0; i < receiveEmails; i++) {
                    const poolAccount = poolAccounts[i % poolAccounts.length];

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
                        scheduleDelay: 2 * 60 * 1000
                    };

                    round1Pairs.push(pair);
                    poolReceiveCounts.set(poolAccount.email, (poolReceiveCounts.get(poolAccount.email) || 0) + 1);
                    console.log(`       📥 ${poolAccount.email} → ${warmupEmail} (receive ${i + 1}/${receiveEmails})`);
                }
            }
        }

        rounds.push({
            roundNumber: 1,
            pairs: round1Pairs,
            type: 'IMMEDIATE_RECEIVE',
            scheduleDelay: 2 * 60 * 1000
        });

        // STEP 2: Warmup Replies (30-60 minutes after receiving)
        console.log(`\n📨 ROUND 2: Warmup Replies (30-60 minutes after receiving)`);
        const round2Pairs = [];

        for (const pair of round1Pairs) {
            if (Math.random() < pair.replyRate) {
                const replyPair = {
                    sender: pair.receiver,
                    senderEmail: pair.receiverEmail,
                    senderType: pair.receiverType,
                    receiver: pair.sender,
                    receiverEmail: pair.senderEmail,
                    receiverType: 'pool',
                    replyRate: 1.0,
                    warmupDay: pair.warmupDay,
                    round: 2,
                    isInitialEmail: false,
                    direction: 'WARMUP_REPLY',
                    originalPair: pair,
                    scheduleDelay: (30 + Math.random() * 30) * 60 * 1000
                };

                round2Pairs.push(replyPair);
                sentCounts.set(pair.receiverEmail, (sentCounts.get(pair.receiverEmail) || 0) + 1);
                console.log(`     📨 ${pair.receiverEmail} → ${pair.senderEmail} (reply in 30-60 mins)`);
            }
        }

        rounds.push({
            roundNumber: 2,
            pairs: round2Pairs,
            type: 'WARMUP_REPLIES',
            scheduleDelay: 45 * 60 * 1000
        });

        // STEP 3: Warmup → Pool New Emails (2-4 hours later) - ONLY FOR DAY 1+
        console.log(`\n📤 ROUND 3: Warmup → Pool New Emails (2-4 hours later)`);
        const round3Pairs = [];

        for (const warmupAccount of warmupAccounts) {
            const warmupEmail = warmupAccount.email;
            const warmupSendLimit = sendLimits.get(warmupEmail);
            const warmupDayCount = warmupAccount.warmupDayCount || 0;

            // FIX: Only send new emails if it's day 1 or later
            if (warmupDayCount >= 1) {
                const repliesSent = round2Pairs.filter(pair => pair.senderEmail === warmupEmail).length;
                const remainingSendCapacity = Math.max(0, warmupSendLimit - repliesSent);

                if (remainingSendCapacity > 0) {
                    console.log(`   🔄 ${warmupEmail}: Day ${warmupDayCount} - Sending ${remainingSendCapacity} new emails (limit: ${warmupSendLimit}, replies: ${repliesSent})`);

                    for (let i = 0; i < remainingSendCapacity; i++) {
                        const poolAccount = poolAccounts[(repliesSent + i) % poolAccounts.length];

                        const pair = {
                            sender: warmupAccount,
                            senderEmail: warmupEmail,
                            senderType: this.getSenderType(warmupAccount),
                            receiver: poolAccount,
                            receiverEmail: poolAccount.email,
                            receiverType: 'pool',
                            replyRate: 0.1,
                            warmupDay: warmupDayCount,
                            round: 3,
                            isInitialEmail: true,
                            direction: 'WARMUP_TO_POOL',
                            scheduleDelay: (120 + Math.random() * 120) * 60 * 1000
                        };

                        round3Pairs.push(pair);
                        sentCounts.set(warmupEmail, (sentCounts.get(warmupEmail) || 0) + 1);
                        console.log(`     📤 ${warmupEmail} → ${poolAccount.email} (new email in 2-4 hours)`);
                    }
                }
            } else {
                console.log(`   🔄 ${warmupEmail}: Day 0 - No new emails to send (receiving only phase)`);
            }
        }

        rounds.push({
            roundNumber: 3,
            pairs: round3Pairs,
            type: 'WARMUP_SEND_NEW',
            scheduleDelay: 180 * 60 * 1000
        });

        // STEP 4: Additional Pool → Warmup (Spread throughout day)
        console.log(`\n📥 ROUND 4: Additional Pool → Warmup (Spread throughout day)`);
        const round4Pairs = [];

        for (const warmupAccount of warmupAccounts) {
            const warmupEmail = warmupAccount.email;
            const warmupDayCount = warmupAccount.warmupDayCount || 0;
            const initialReceived = round1Pairs.filter(p => p.receiverEmail === warmupEmail).length;

            // Different strategy based on warmup day
            let additionalNeeded;
            if (warmupDayCount === 0) {
                // Day 0: Get more engagement
                additionalNeeded = Math.max(0, 2 - initialReceived);
            } else {
                // Day 1+: Balanced approach
                additionalNeeded = Math.max(0, Math.min(2, 4 - initialReceived));
            }

            if (additionalNeeded > 0) {
                console.log(`   🔄 ${warmupEmail}: Receiving ${additionalNeeded} additional emails (had ${initialReceived})`);

                for (let i = 0; i < additionalNeeded; i++) {
                    const poolAccount = poolAccounts[(initialReceived + i) % poolAccounts.length];

                    const pair = {
                        sender: poolAccount,
                        senderEmail: poolAccount.email,
                        senderType: 'pool',
                        receiver: warmupAccount,
                        receiverEmail: warmupEmail,
                        receiverType: this.getSenderType(warmupAccount),
                        replyRate: warmupAccount.replyRate || 0.25,
                        warmupDay: warmupDayCount,
                        round: 4,
                        isInitialEmail: true,
                        direction: 'POOL_TO_WARMUP',
                        scheduleDelay: (180 + (i * 60)) * 60 * 1000
                    };

                    round4Pairs.push(pair);
                    poolReceiveCounts.set(poolAccount.email, (poolReceiveCounts.get(poolAccount.email) || 0) + 1);
                    console.log(`     📥 ${poolAccount.email} → ${warmupEmail} (additional in ${3 + i} hours)`);
                }
            }
        }

        rounds.push({
            roundNumber: 4,
            pairs: round4Pairs,
            type: 'ADDITIONAL_RECEIVE',
            scheduleDelay: 360 * 60 * 1000
        });

        const totalEmails = rounds.reduce((total, round) => total + round.pairs.length, 0);
        console.log(`\n   ✅ Created complete warmup schedule with ${totalEmails} total emails`);

        return rounds;
    }

    async distributeToTimeSlots(rounds, plan) {
        if (!rounds || rounds.length === 0) {
            console.log('⚠️ No rounds to distribute');
            return;
        }

        console.log(`\n📅 Distributing emails from ${rounds.length} rounds to time slots...`);

        const now = new Date();
        let totalScheduled = 0;

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

                    // FIX: Initialize stats if missing
                    if (!plan.accountStats.has(pair.senderEmail)) {
                        plan.accountStats.set(pair.senderEmail, { sent: 0, received: 0 });
                    }
                    if (!plan.poolStats.has(pair.receiverEmail)) {
                        plan.poolStats.set(pair.receiverEmail, { received: 0, replied: 0 });
                    }

                    const senderStats = plan.accountStats.get(pair.senderEmail);
                    const receiverStats = plan.accountStats.get(pair.receiverEmail);
                    const poolStats = plan.poolStats.get(pair.receiverEmail);

                    // FIX: Correct stats counting based on direction
                    if (pair.direction === 'POOL_TO_WARMUP') {
                        // Pool sends, warmup receives
                        if (senderStats) senderStats.sent++; // Pool account sent
                        if (receiverStats) receiverStats.received++; // Warmup account received
                    } else if (pair.direction === 'WARMUP_REPLY' || pair.direction === 'WARMUP_TO_POOL') {
                        // Warmup sends, pool receives
                        if (senderStats) senderStats.sent++; // Warmup account sent
                        if (poolStats) poolStats.received++; // Pool account received
                    }

                    const delayMinutes = Math.round(delay / (60 * 1000));
                    console.log(`   🕐 ${slotTime.toLocaleTimeString()} (in ${delayMinutes} mins): ${pair.senderEmail} → ${pair.receiverEmail} [${pair.direction}]`);
                });
            }
        });

        console.log(`✅ Successfully scheduled ${totalScheduled} emails with proper delays`);
    }
    validateDistribution(warmupAccounts, poolAccounts, sentCounts, poolReceiveCounts, sendLimits) {
        console.log('\n📊 DISTRIBUTION VALIDATION:');
        console.log('='.repeat(50));

        let totalWarmupSent = 0;
        let totalWarmupReceived = 0;
        let totalPoolSent = 0;
        let allLimitsMet = true;

        console.log('🔥 WARMUP ACCOUNTS:');
        for (const account of warmupAccounts) {
            const email = account.email;
            const sent = sentCounts.get(email) || 0;
            const received = poolReceiveCounts.get(email) || 0;
            const limit = sendLimits.get(email);

            totalWarmupSent += sent;
            totalWarmupReceived += received;

            const sentStatus = sent >= limit ? '✅' : '❌';
            const receivedStatus = received >= 2 ? '✅' : '❌';

            console.log(`   ${email}:`);
            console.log(`     Sent: ${sent}/${limit} ${sentStatus}`);
            console.log(`     Received: ${received} ${receivedStatus}`);

            if (sent < limit || received < 2) {
                allLimitsMet = false;
            }
        }

        console.log('\n🏊 POOL ACCOUNTS:');
        for (const pool of poolAccounts) {
            const sent = poolReceiveCounts.get(pool.email) || 0;
            totalPoolSent += sent;
            console.log(`   ${pool.email}: Sent ${sent} emails`);
        }

        console.log(`\n📈 SYSTEM SUMMARY:`);
        console.log(`   Warmup Accounts Sent: ${totalWarmupSent}`);
        console.log(`   Warmup Accounts Received: ${totalWarmupReceived}`);
        console.log(`   Pool Accounts Sent: ${totalPoolSent}`);
        console.log(`   Balance Check: ${totalWarmupSent === totalWarmupReceived ? '✅' : '❌'}`);
        console.log(`   All Limits Met: ${allLimitsMet ? '✅ YES' : '❌ NO'}`);
        console.log('='.repeat(50));
    }

    async scheduleJobs(channel, warmupPlan) {
        let totalScheduled = 0;

        if (!warmupPlan.timeSlots || warmupPlan.timeSlots.size === 0) {
            console.log('⚠️  No time slots to schedule');
            this.isRunning = false;
            return;
        }

        console.log(`\n🕐 Scheduling ${warmupPlan.timeSlots.size} time slots...`);

        for (const [timeString, pairs] of warmupPlan.timeSlots) {
            if (!pairs || pairs.length === 0) {
                console.log(`⚠️  Skipping empty time slot: ${timeString}`);
                continue;
            }

            const scheduledTime = new Date(timeString);
            const now = new Date();
            const delay = scheduledTime.getTime() - now.getTime();

            if (delay > 0) {
                console.log(`   📅 ${scheduledTime.toLocaleTimeString()} - ${pairs.length} emails`);

                const job = {
                    timeSlot: timeString,
                    pairs: pairs,
                    timestamp: new Date().toISOString(),
                    coordinated: true,
                    round: pairs[0]?.round || 1
                };

                const timeoutId = setTimeout(async () => {
                    try {
                        console.log(`\n🎯 EXECUTING TIME SLOT: ${scheduledTime.toLocaleTimeString()}`);
                        console.log(`   Processing ${pairs.length} emails...`);

                        await channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(job)), {
                            persistent: true,
                            priority: 5
                        });

                        console.log(`   ✅ Job queued successfully`);
                    } catch (error) {
                        console.error('❌ Error queuing job:', error);
                    }
                }, delay);

                this.scheduledJobs.set(timeString, timeoutId);
                totalScheduled += pairs.length;
            } else {
                console.log(`   ⏩ Skipping past time slot: ${scheduledTime.toLocaleTimeString()}`);
            }
        }

        if (totalScheduled === 0) {
            console.log('⚠️  No jobs scheduled - all time slots were in the past');
        } else {
            console.log(`\n✅ Successfully scheduled ${totalScheduled} emails across ${warmupPlan.timeSlots.size} time slots`);
        }

        this.isRunning = false;
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

    // NEW: Helper function to ensure values are numbers
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
};