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

            // Get all active accounts
            const activeAccounts = await this.getActiveAccounts();

            if (activeAccounts.length < 2) {
                console.log('⚠️ Need at least 2 active accounts for warmup');
                this.isRunning = false;
                return;
            }

            console.log(`📊 Processing ${activeAccounts.length} active accounts`);

            // Clear previous scheduled jobs
            this.clearScheduledJobs();

            // Create intelligent warmup plan
            const warmupPlan = this.createWarmupPlan(activeAccounts);

            // Schedule jobs based on the plan
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

        return [...googleAccounts, ...smtpAccounts, ...microsoftAccounts];
    }

    createWarmupPlan(accounts) {
        const plan = {
            timeSlots: new Map(),
            totalEmails: 0,
            accountDistribution: new Map()
        };

        console.log(`🎯 Creating warmup plan for ${accounts.length} accounts`);

        // Create balanced pairs ensuring bidirectional communication
        const allPairs = this.createBalancedPairs(accounts);

        // Distribute pairs intelligently across time
        this.distributePairsOverTime(allPairs, plan);

        console.log(`📅 Warmup Plan: ${plan.totalEmails} emails across ${plan.timeSlots.size} time slots`);

        // Log account distribution
        console.log('📊 Account Distribution:');
        for (const [email, count] of plan.accountDistribution) {
            console.log(`   ${email}: ${count} emails`);
        }

        return plan;
    }

    createBalancedPairs(accounts) {
        const pairs = [];

        console.log(`🔗 Creating balanced pairs for ${accounts.length} accounts`);

        // Create bidirectional pairs ensuring everyone sends and receives
        for (let i = 0; i < accounts.length; i++) {
            for (let j = 0; j < accounts.length; j++) {
                if (i === j) continue; // Skip self-pairing

                const accountA = accounts[i];
                const accountB = accounts[j];

                // Calculate balanced email exchange
                const emailsAtoB = this.calculateBalancedEmails(accountA, accountB);
                const emailsBtoA = this.calculateBalancedEmails(accountB, accountA);

                // Add bidirectional emails
                for (let k = 0; k < emailsAtoB; k++) {
                    pairs.push({
                        sender: accountA,
                        receiver: accountB,
                        replyRate: Math.min(0.25, computeReplyRate(accountA)),
                        warmupDay: accountA.warmupDayCount || 0
                    });
                }

                for (let k = 0; k < emailsBtoA; k++) {
                    pairs.push({
                        sender: accountB,
                        receiver: accountA,
                        replyRate: Math.min(0.25, computeReplyRate(accountB)),
                        warmupDay: accountB.warmupDayCount || 0
                    });
                }

                if (emailsAtoB > 0 || emailsBtoA > 0) {
                    console.log(`   ${accountA.email} <-> ${accountB.email}: ${emailsAtoB}A→B, ${emailsBtoA}B→A`);
                }
            }
        }

        console.log(`✅ Created ${pairs.length} balanced bidirectional pairs`);
        return pairs;
    }

    calculateBalancedEmails(sender, receiver) {
        const senderDays = sender.warmupDayCount || 0;

        // Gradual increase based on warmup progress
        let emailsToSend;
        if (senderDays === 0) emailsToSend = 1;
        else if (senderDays <= 3) emailsToSend = 1;
        else if (senderDays <= 7) emailsToSend = 2;
        else if (senderDays <= 14) emailsToSend = 2;
        else emailsToSend = 3;

        return emailsToSend;
    }

    distributePairsOverTime(pairs, plan) {
        if (pairs.length === 0) {
            console.log('⚠️ No pairs to distribute');
            return;
        }

        console.log(`📅 Distributing ${pairs.length} pairs over time...`);

        // Shuffle pairs for random distribution
        const shuffledPairs = this.shuffleArray([...pairs]);

        // Track account distribution
        const accountEmails = new Map();

        // Distribute emails throughout the day with 30-minute intervals
        let currentTime = this.getNextAvailableTime();
        const sendInterval = 30 * 60 * 1000; // 30 minutes between emails

        shuffledPairs.forEach((pair, index) => {
            const scheduledTime = new Date(currentTime.getTime() + (index * sendInterval));

            const timeKey = scheduledTime.toISOString();
            if (!plan.timeSlots.has(timeKey)) {
                plan.timeSlots.set(timeKey, []);
            }

            plan.timeSlots.get(timeKey).push(pair);
            plan.totalEmails++;

            // Track account distribution
            const senderEmail = pair.sender.email;
            accountEmails.set(senderEmail, (accountEmails.get(senderEmail) || 0) + 1);
        });

        plan.accountDistribution = accountEmails;
        console.log(`✅ Distributed ${plan.totalEmails} emails across ${plan.timeSlots.size} time slots`);
    }

    getNextAvailableTime() {
        // Start scheduling from next 30-minute mark
        const now = new Date();
        const nextSlot = new Date(now);
        nextSlot.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);

        // If it's the same minute, add 30 minutes
        if (nextSlot.getTime() <= now.getTime()) {
            nextSlot.setMinutes(nextSlot.getMinutes() + 30);
        }

        return nextSlot;
    }

    async scheduleJobs(channel, warmupPlan) {
        let totalScheduled = 0;

        console.log(`🕐 Scheduling ${warmupPlan.timeSlots.size} time slots...`);

        for (const [timeString, pairs] of warmupPlan.timeSlots) {
            const scheduledTime = new Date(timeString);
            const now = new Date();
            const delay = scheduledTime.getTime() - now.getTime();

            if (delay > 0) {
                console.log(`   📅 ${scheduledTime.toLocaleTimeString()} - ${pairs.length} emails`);

                const timeoutId = setTimeout(async () => {
                    try {
                        console.log(`🎯 Executing ${pairs.length} emails scheduled for ${scheduledTime.toLocaleTimeString()}`);

                        for (const pair of pairs) {
                            const jobPayload = {
                                senderEmail: pair.sender.email,
                                senderType: this.getSenderType(pair.sender),
                                receiverEmail: pair.receiver.email,
                                replyRate: pair.replyRate,
                                warmupDay: pair.warmupDay,
                                timestamp: new Date().toISOString(),
                                scheduled: true
                            };

                            await channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(jobPayload)), {
                                persistent: true,
                                priority: 5
                            });

                            console.log(`   📨 ${pair.sender.email} -> ${pair.receiver.email} (Reply: ${(pair.replyRate * 100).toFixed(1)}%)`);
                        }
                    } catch (error) {
                        console.error('❌ Error executing scheduled job:', error);
                    }
                }, delay);

                this.scheduledJobs.set(timeString, timeoutId);
                totalScheduled += pairs.length;
            } else {
                console.log(`⚠️ Skipping past time slot: ${scheduledTime.toLocaleTimeString()}`);
            }
        }

        console.log(`✅ Successfully scheduled ${totalScheduled} emails`);
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

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
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
}

// Create singleton instance
const schedulerInstance = new IntelligentWarmupScheduler();

// Export functions
module.exports = {
    scheduleIntelligentWarmup: () => schedulerInstance.scheduleIntelligentWarmup(),
    stopIntelligentScheduler: () => schedulerInstance.stopScheduler(),
    IntelligentWarmupScheduler
};