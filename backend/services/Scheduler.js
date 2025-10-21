const getChannel = require('../queues/rabbitConnection');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const { computeEmailsToSend, computeReplyRate } = require('./warmupWorkflow');

class IntelligentWarmupScheduler {
    constructor() {
        this.isRunning = false;
        this.scheduledJobs = new Map();
    }

    async scheduleIntelligentWarmup() {
        if (this.isRunning) {
            console.log('🔄 Warmup scheduler already running...');
            return;
        }

        this.isRunning = true;

        try {
            const channel = await getChannel();
            await channel.assertQueue('warmup_jobs', { durable: true });

            console.log('🧠 Starting intelligent warmup scheduling...');

            const activeAccounts = await this.getActiveAccounts();

            if (activeAccounts.length < 2) {
                console.log('⚠️ Need at least 2 active accounts for warmup');
                this.isRunning = false;
                return;
            }

            console.log(`📊 Processing ${activeAccounts.length} active accounts`);

            this.clearScheduledJobs();

            const warmupPlan = await this.createBalancedWarmupPlan(activeAccounts);

            await this.scheduleJobs(channel, warmupPlan);

            console.log('✅ Intelligent warmup scheduling completed');

        } catch (error) {
            console.error('❌ Intelligent scheduling error:', error);
            this.isRunning = false;
        }
    }

    async getActiveAccounts() {
        const googleAccounts = await GoogleUser.findAll({ where: { warmupStatus: 'active' } });
        const smtpAccounts = await SmtpAccount.findAll({ where: { warmupStatus: 'active' } });
        const microsoftAccounts = await MicrosoftUser.findAll({ where: { warmupStatus: 'active' } });

        console.log(`📊 Database accounts found:`);
        console.log(`   Google: ${googleAccounts.length}, SMTP: ${smtpAccounts.length}, Microsoft: ${microsoftAccounts.length}`);

        const allAccounts = [...googleAccounts, ...smtpAccounts, ...microsoftAccounts];

        for (const account of allAccounts) {
            const sendLimit = await computeEmailsToSend(account);
            console.log(`   ${account.email}: Day ${account.warmupDayCount}, Send Limit: ${sendLimit}, ReplyRate: ${account.replyRate}`);
        }

        return allAccounts;
    }

    async createBalancedWarmupPlan(accounts) {
        console.log(`🎯 Creating BALANCED warmup plan for ${accounts.length} accounts`);

        const plan = {
            timeSlots: new Map(),
            totalEmails: 0,
            accountStats: new Map()
        };

        // Calculate individual sending limits
        const accountSendLimits = new Map();
        const accountSentCounts = new Map();
        const accountReceivedCounts = new Map();

        for (const account of accounts) {
            const sendLimit = await computeEmailsToSend(account);
            accountSendLimits.set(account.email, sendLimit);
            accountSentCounts.set(account.email, 0);
            accountReceivedCounts.set(account.email, 0);
            plan.accountStats.set(account.email, { sent: 0, received: 0 });
        }

        console.log('📊 Individual Send Limits:');
        for (const [email, limit] of accountSendLimits) {
            console.log(`   ${email}: ${limit} emails to SEND`);
        }

        // Create balanced pairs
        const allPairs = await this.createBalancedPairs(
            accounts,
            accountSendLimits,
            accountSentCounts,
            accountReceivedCounts
        );

        // Distribute to time slots
        await this.distributeToTimeSlots(allPairs, plan);

        // Final validation
        this.validateDistribution(accounts, accountSentCounts, accountReceivedCounts, accountSendLimits);

        return plan;
    }

    async createBalancedPairs(accounts, sendLimits, sentCounts, receivedCounts) {
        console.log(`\n🔄 Creating OPTIMIZED round-robin pairs...`);

        const allPairs = [];

        // Reset counts for fresh calculation
        for (const account of accounts) {
            sentCounts.set(account.email, 0);
            receivedCounts.set(account.email, 0);
        }

        // Create complete round-robin: each account sends to every other account
        for (const sender of accounts) {
            const senderEmail = sender.email;
            const senderLimit = sendLimits.get(senderEmail);

            console.log(`\n   🔄 Processing sender: ${senderEmail} (limit: ${senderLimit})`);

            // Find all other accounts to send to
            const otherAccounts = accounts.filter(acc => acc.email !== senderEmail);

            for (const receiver of otherAccounts) {
                // Check if sender has reached their daily limit
                if (sentCounts.get(senderEmail) >= senderLimit) {
                    console.log(`     ⚠️  ${senderEmail} reached daily limit, skipping remaining sends`);
                    break;
                }

                const replyRate = await computeReplyRate(sender);

                allPairs.push({
                    sender,
                    receiver,
                    senderEmail: senderEmail,
                    receiverEmail: receiver.email,
                    replyRate: replyRate,
                    warmupDay: sender.warmupDayCount,
                    senderType: this.getSenderType(sender),
                    round: 1
                });

                // Update counts
                sentCounts.set(senderEmail, sentCounts.get(senderEmail) + 1);
                receivedCounts.set(receiver.email, receivedCounts.get(receiver.email) + 1);

                console.log(`     📤 ${senderEmail} → ${receiver.email} (${sentCounts.get(senderEmail)}/${senderLimit})`);
            }
        }

        // If we still have capacity, create additional exchanges
        let additionalRound = 2;
        let hasCapacity = true;

        while (hasCapacity && additionalRound <= 3) { // Max 3 rounds
            hasCapacity = false;
            const roundPairs = [];

            for (const sender of accounts) {
                const senderEmail = sender.email;
                const currentSent = sentCounts.get(senderEmail);
                const senderLimit = sendLimits.get(senderEmail);

                if (currentSent < senderLimit) {
                    hasCapacity = true;

                    // Find a receiver who has received fewer emails
                    const potentialReceivers = accounts
                        .filter(acc => acc.email !== senderEmail)
                        .sort((a, b) => receivedCounts.get(a.email) - receivedCounts.get(b.email));

                    if (potentialReceivers.length > 0) {
                        const receiver = potentialReceivers[0];
                        const replyRate = await computeReplyRate(sender);

                        roundPairs.push({
                            sender,
                            receiver,
                            senderEmail: senderEmail,
                            receiverEmail: receiver.email,
                            replyRate: replyRate,
                            warmupDay: sender.warmupDayCount,
                            senderType: this.getSenderType(sender),
                            round: additionalRound
                        });

                        sentCounts.set(senderEmail, currentSent + 1);
                        receivedCounts.set(receiver.email, receivedCounts.get(receiver.email) + 1);

                        console.log(`     📤 [Round ${additionalRound}] ${senderEmail} → ${receiver.email} (${currentSent + 1}/${senderLimit})`);
                    }
                }
            }

            if (roundPairs.length > 0) {
                allPairs.push(...roundPairs);
                additionalRound++;
            }
        }

        console.log(`\n   ✅ Created ${allPairs.length} total pairs across ${additionalRound - 1} rounds`);

        // Group by rounds for time slot distribution
        const rounds = [];
        const pairsPerRound = Math.max(1, Math.floor(allPairs.length / 3)); // Distribute across 3 rounds max

        for (let i = 0; i < allPairs.length; i += pairsPerRound) {
            const roundPairs = allPairs.slice(i, i + pairsPerRound);
            if (roundPairs.length > 0) {
                rounds.push({
                    roundNumber: rounds.length + 1,
                    pairs: roundPairs,
                    emailCount: roundPairs.length
                });
            }
        }

        return rounds;
    }

    findOptimalReceiver(sender, accounts, receivedCounts, sentCounts) {
        const senderEmail = sender.email;

        // Create list of potential receivers (excluding sender)
        const potentialReceivers = accounts
            .filter(account => account.email !== senderEmail)
            .map(receiver => {
                const received = receivedCounts.get(receiver.email);
                const sent = sentCounts.get(receiver.email);

                // Calculate balance score (prefer receivers who have received fewer emails)
                const balanceScore = -received; // Negative because we want lower received counts

                return { receiver, received, sent, balanceScore };
            })
            .sort((a, b) => b.balanceScore - a.balanceScore); // Sort by balance (ascending received count)

        return potentialReceivers.length > 0 ? potentialReceivers[0].receiver : null;
    }

    async distributeToTimeSlots(rounds, plan) {
        if (rounds.length === 0) {
            console.log('⚠️ No rounds to distribute');
            return;
        }

        console.log(`\n📅 Distributing ${rounds.length} rounds to time slots...`);

        const timeSlots = this.calculateOptimalTimeSlots(rounds.length);

        rounds.forEach((round, index) => {
            if (index < timeSlots.length) {
                const slot = timeSlots[index];
                const timeKey = slot.time.toISOString();

                if (!plan.timeSlots.has(timeKey)) {
                    plan.timeSlots.set(timeKey, []);
                }

                // Add all pairs from this round to the time slot
                round.pairs.forEach(pair => {
                    plan.timeSlots.get(timeKey).push(pair);
                    plan.totalEmails++;

                    // Update account stats
                    const senderStats = plan.accountStats.get(pair.senderEmail);
                    const receiverStats = plan.accountStats.get(pair.receiverEmail);
                    senderStats.sent++;
                    receiverStats.received++;
                });

                console.log(`   🕐 ${slot.time.toLocaleTimeString()} - Round ${round.roundNumber} (${round.pairs.length} emails)`);
            }
        });

        console.log(`✅ Distributed ${plan.totalEmails} emails across ${plan.timeSlots.size} time slots`);

        // Log final distribution
        console.log('\n📊 FINAL DISTRIBUTION:');
        for (const [email, stats] of plan.accountStats) {
            console.log(`   ${email}: Sent ${stats.sent}, Received ${stats.received}`);
        }
    }

    calculateOptimalTimeSlots(totalRounds) {
        const timeSlots = [];
        const now = new Date();

        console.log(`   ⏱️ Scheduling ${totalRounds} rounds with proper spacing`);

        for (let i = 0; i < totalRounds; i++) {
            // ✅ IMPROVED: Better timing for email sending
            // Start first round in 2 minutes, then space out by 5-10 minutes
            const baseDelay = 2 * 60 * 1000; // 2 minutes for first round
            const additionalDelay = i * 8 * 60 * 1000; // 8 minutes between rounds

            const slotTime = new Date(now.getTime() + baseDelay + additionalDelay);

            timeSlots.push({ time: slotTime, round: i + 1 });

            const minutesFromNow = Math.round((baseDelay + additionalDelay) / (60 * 1000));
            console.log(`   🚀 Round ${i + 1}: ${slotTime.toLocaleTimeString()} (in ${minutesFromNow} minutes)`);
        }

        return timeSlots;
    }

    validateDistribution(accounts, sentCounts, receivedCounts, sendLimits) {
        console.log('\n📊 DISTRIBUTION VALIDATION:');
        console.log('='.repeat(50));

        let totalSent = 0;
        let totalReceived = 0;
        let allLimitsMet = true;

        for (const account of accounts) {
            const email = account.email;
            const sent = sentCounts.get(email);
            const received = receivedCounts.get(email);
            const limit = sendLimits.get(email);

            totalSent += sent;
            totalReceived += received;

            const status = sent >= limit ? '✅' : '❌';
            console.log(`   ${email}:`);
            console.log(`     Sent: ${sent}/${limit} ${status}`);
            console.log(`     Received: ${received}`);

            if (sent < limit) {
                allLimitsMet = false;
            }
        }

        console.log(`\n📈 SYSTEM SUMMARY:`);
        console.log(`   Total Sent: ${totalSent}`);
        console.log(`   Total Received: ${totalReceived}`);
        console.log(`   Balance: ${Math.abs(totalSent - totalReceived)} difference`);
        console.log(`   All Limits Met: ${allLimitsMet ? '✅ YES' : '❌ NO'}`);
        console.log('='.repeat(50));
    }

    async scheduleJobs(channel, warmupPlan) {
        let totalScheduled = 0;

        console.log(`\n🕐 Scheduling ${warmupPlan.timeSlots.size} time slots...`);

        for (const [timeString, pairs] of warmupPlan.timeSlots) {
            const scheduledTime = new Date(timeString);
            const now = new Date();
            const delay = scheduledTime.getTime() - now.getTime();

            if (delay > 0) {
                console.log(`   📅 ${scheduledTime.toLocaleTimeString()} - ${pairs.length} emails`);

                // ✅ FIX: Include round information in the job
                const job = {
                    timeSlot: timeString,
                    pairs: pairs.map(pair => ({
                        senderEmail: pair.senderEmail,
                        senderType: pair.senderType,
                        receiverEmail: pair.receiverEmail,
                        replyRate: pair.replyRate,
                        warmupDay: pair.warmupDay,
                        round: pair.round // ✅ Make sure round is included
                    })),
                    timestamp: new Date().toISOString(),
                    coordinated: true,
                    round: pairs[0]?.round || 1 // ✅ Include overall round for the time slot
                };

                const timeoutId = setTimeout(async () => {
                    try {
                        console.log(`\n🎯 EXECUTING TIME SLOT: ${scheduledTime.toLocaleTimeString()}`);
                        console.log(`   Processing ${pairs.length} emails in round ${job.round}...`);

                        await channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(job)), {
                            persistent: true,
                            priority: 5
                        });

                        console.log(`   ✅ Job queued successfully for round ${job.round}`);
                    } catch (error) {
                        console.error('❌ Error queuing job:', error);
                    }
                }, delay);

                this.scheduledJobs.set(timeString, timeoutId);
                totalScheduled += pairs.length;
            }
        }

        console.log(`\n✅ Successfully scheduled ${totalScheduled} emails across ${warmupPlan.timeSlots.size} time slots`);
        this.isRunning = false;
    }

    // ✅ NEW: Build sender config for coordinated jobs
    buildSenderConfigForCoordinated(sender, senderType) {
        const base = {
            userId: sender.userId || sender.user_id,
            name: sender.name || sender.sender_name || sender.email,
            email: sender.email,
            type: senderType,
            startEmailsPerDay: sender.startEmailsPerDay,
            increaseEmailsPerDay: sender.increaseEmailsPerDay,
            maxEmailsPerDay: sender.maxEmailsPerDay,
            replyRate: sender.replyRate,
            warmupDayCount: sender.warmupDayCount,
            industry: sender.industry
        };

        if (senderType === 'google') {
            return {
                ...base,
                smtpHost: 'smtp.gmail.com',
                smtpPort: 587,
                smtpUser: sender.email,
                smtpPass: sender.app_password,
                smtpEncryption: 'TLS',
                imapHost: 'imap.gmail.com',
                imapPort: 993,
                imapUser: sender.email,
                imapPass: sender.app_password,
                imapEncryption: 'SSL',
            };
        }

        if (senderType === 'microsoft') {
            return {
                ...base,
                smtpHost: 'smtp.office365.com',
                smtpPort: 587,
                smtpUser: sender.email,
                smtpPass: sender.access_token || sender.app_password,
                smtpEncryption: 'STARTTLS',
                imapHost: 'outlook.office365.com',
                imapPort: 993,
                imapUser: sender.email,
                imapPass: sender.access_token || sender.app_password,
                imapEncryption: 'SSL',
            };
        }

        // SMTP account
        return {
            ...base,
            smtpHost: sender.smtp_host,
            smtpPort: sender.smtp_port || 587,
            smtpUser: sender.smtp_user || sender.email,
            smtpPass: sender.smtp_pass,
            smtpEncryption: sender.smtp_encryption || 'TLS',
            imapHost: sender.imap_host,
            imapPort: sender.imap_port || 993,
            imapUser: sender.imap_user || sender.email,
            imapPass: sender.imap_pass || sender.smtp_pass,
            imapEncryption: sender.imap_encryption || 'SSL',
        };
    }

    async getSender(senderType, email) {
        try {
            let senderModel;
            switch (senderType) {
                case 'google':
                    senderModel = GoogleUser;
                    break;
                case 'microsoft':
                    senderModel = MicrosoftUser;
                    break;
                case 'smtp':
                    senderModel = SmtpAccount;
                    break;
                default:
                    throw new Error(`Unknown sender type: ${senderType}`);
            }

            const sender = await senderModel.findOne({ where: { email } });
            if (!sender) {
                console.error(`❌ Sender not found: ${email} for type: ${senderType}`);
                return null;
            }

            return sender;
        } catch (error) {
            console.error(`❌ Error fetching sender ${email} for type ${senderType}:`, error.message);
            return null;
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

    stopScheduler() {
        this.clearScheduledJobs();
        this.isRunning = false;
        console.log('🛑 Intelligent warmup scheduler stopped');
    }

    async incrementWarmupDayCount() {
        try {
            const activeAccounts = await this.getActiveAccounts();
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

}

// Create singleton instance
const schedulerInstance = new IntelligentWarmupScheduler();

module.exports = {
    scheduleIntelligentWarmup: () => schedulerInstance.scheduleIntelligentWarmup(),
    stopIntelligentScheduler: () => schedulerInstance.stopScheduler(),
    IntelligentWarmupScheduler
};