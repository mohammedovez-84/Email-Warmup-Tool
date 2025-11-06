const EmailExchange = require("../../models/MailExchange");
const ReplyTracking = require("../../models/ReplyTracking");
const { buildPoolConfig } = require("../../utils/senderConfig");

class UnifiedWarmupStrategy {
    constructor() {
        this.MAX_EMAILS_SAFETY_CAP = 50;
        this.TESTING_MODE = process.env.WARMUP_TESTING_MODE === 'true';

        console.log(`🔧 TESTING MODE: ${this.TESTING_MODE ? 'ENABLED (2-3 min delays)' : 'DISABLED'}`);
    }

    // In UnifiedWarmupStrategy - UPDATE the generateWarmupPlan method

    // In your UnifiedWarmupStrategy - update the plan generation
    async generateWarmupPlan(warmupAccount, poolAccounts, replyRate) {
        try {
            console.log(`📊 GENERATING REPLY-DRIVEN PLAN for ${warmupAccount.email}:`);

            // 🎯 GET ACTUAL REPLY METRICS INSTEAD OF USING CONFIGURED RATE
            const actualMetrics = await this.getActualReplyMetrics(warmupAccount.email);
            const actualReplyRate = actualMetrics.replyRate > 0 ? actualMetrics.replyRate : replyRate;

            console.log(`   ├── Warmup Day: ${warmupAccount.warmupDayCount || 0}`);
            console.log(`   ├── Actual Reply Rate: ${(actualReplyRate * 100).toFixed(1)}%`);
            console.log(`   ├── Total Replies: ${actualMetrics.totalReplies}`);
            console.log(`   └── Using rate: ${(actualReplyRate * 100).toFixed(1)}% (${actualMetrics.totalReplies > 0 ? 'ACTUAL' : 'CONFIGURED'})`);

            // Your existing plan generation logic continues...
            const dailyLimit = await this.calculateDailyLimit(warmupAccount);

            // Use actual reply rate for planning
            const sequence = await this.generateEmailSequence(
                warmupAccount,
                poolAccounts,
                dailyLimit,
                actualReplyRate
            );

            return {
                sequence: sequence,
                totalEmails: sequence.length,
                dailyLimit: dailyLimit,
                warmupDay: warmupAccount.warmupDayCount || 0,
                actualReplyRate: actualReplyRate,
                replyDriven: actualMetrics.totalReplies > 0
            };

        } catch (error) {
            console.error(`❌ PLAN GENERATION ERROR:`, error);
            return { error: error.message };
        }
    }

    // 🎯 NEW: Get actual reply metrics
    async getActualReplyMetrics(email, days = 3) {
        try {
            const { Op } = require('sequelize');
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const replies = await ReplyTracking.count({
                where: {
                    originalSender: email,
                    repliedAt: { [Op.gte]: startDate }
                }
            });

            const sentEmails = await EmailExchange.count({
                where: {
                    warmupAccount: email,
                    sentAt: { [Op.gte]: startDate },
                    direction: 'WARMUP_TO_POOL'
                }
            });

            const replyRate = sentEmails > 0 ? replies / sentEmails : 0;

            return {
                totalReplies: replies,
                totalSent: sentEmails,
                replyRate: replyRate
            };

        } catch (error) {
            console.error(`❌ Error getting actual reply metrics:`, error);
            return { totalReplies: 0, totalSent: 0, replyRate: 0 };
        }
    }
    // Add this method to your UnifiedWarmupStrategy class
    calculateDailyLimit(warmupAccount) {
        try {
            const warmupDayCount = warmupAccount.warmupDayCount || 0;
            const startEmailsPerDay = warmupAccount.startEmailsPerDay || 3;
            const increaseEmailsPerDay = warmupAccount.increaseEmailsPerDay || 1;
            const maxEmailsPerDay = Math.min(warmupAccount.maxEmailsPerDay || 25, this.MAX_EMAILS_SAFETY_CAP);

            // Calculate progressive daily limit
            const calculatedLimit = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
            const dailyLimit = Math.min(Math.max(calculatedLimit, 1), maxEmailsPerDay);

            console.log(`   ├── Start: ${startEmailsPerDay}, Increase: ${increaseEmailsPerDay}, Max: ${maxEmailsPerDay}`);
            console.log(`   ├── Calculated: ${calculatedLimit}, Final: ${dailyLimit}`);

            return dailyLimit;

        } catch (error) {
            console.error(`❌ Error calculating daily limit:`, error);
            return 5; // Fallback to safe default
        }
    }

    // In UnifiedWarmupStrategy - REPLACE the generateEmailSequence method
    async generateEmailSequence(warmupAccount, poolAccounts, dailyLimit, replyRate) {
        try {
            console.log(`   📧 Generating MIXED email sequence for ${dailyLimit} emails`);

            const sequence = [];
            const isOrganizational = this.isOrganizationalAccount(warmupAccount.email, warmupAccount);

            if (isOrganizational) {
                console.log(`   🏢 Organizational account detected - receive-only mode`);
                const orgPlan = this.generateOrganizationalAccountPlan(warmupAccount, poolAccounts);
                return orgPlan.sequence || [];
            }

            // 🎯 NEW: Calculate SMART ratios based on warmup day
            const { outboundRatio, inboundRatio } = this.calculateSmartRatios(warmupAccount);

            const outboundCount = Math.floor(dailyLimit * outboundRatio);
            const inboundCount = dailyLimit - outboundCount;

            console.log(`   ├── Smart Ratio: ${(outboundRatio * 100).toFixed(0)}% outbound, ${(inboundRatio * 100).toFixed(0)}% inbound`);
            console.log(`   ├── Outbound: ${outboundCount}, Inbound: ${inboundCount}`);

            // Get compatible pools
            const outboundPools = this.getCompatiblePoolsForDirection(poolAccounts, 'WARMUP_TO_POOL');
            const inboundPools = this.getCompatiblePoolsForDirection(poolAccounts, 'POOL_TO_WARMUP');

            console.log(`   ├── Available outbound pools: ${outboundPools.length}`);
            console.log(`   ├── Available inbound pools: ${inboundPools.length}`);

            // 🎯 NEW: Create INTERLEAVED sequence (not separate batches)
            const interleavedSequence = this.createInterleavedSequence(
                warmupAccount,
                outboundPools,
                inboundPools,
                outboundCount,
                inboundCount,
                dailyLimit
            );

            console.log(`   ✅ Final INTERLEAVED sequence: ${interleavedSequence.length} emails`);

            // Log the actual mix for verification
            const actualOutbound = interleavedSequence.filter(job => job.direction === 'WARMUP_TO_POOL').length;
            const actualInbound = interleavedSequence.filter(job => job.direction === 'POOL_TO_WARMUP').length;
            console.log(`   📊 Actual mix: ${actualOutbound} outbound, ${actualInbound} inbound`);

            return interleavedSequence;

        } catch (error) {
            console.error(`❌ Error generating email sequence:`, error);
            return [];
        }
    }

    // 🎯 NEW: Calculate smart ratios based on warmup progression
    calculateSmartRatios(warmupAccount) {
        const warmupDay = warmupAccount.warmupDayCount || 0;

        let outboundRatio, inboundRatio;

        if (warmupDay === 0) {
            // Day 1: More inbound to build reputation
            outboundRatio = 0.4; // 40% outbound
            inboundRatio = 0.6;  // 60% inbound
        } else if (warmupDay === 1) {
            // Day 2: Balanced approach
            outboundRatio = 0.5; // 50% outbound
            inboundRatio = 0.5;  // 50% inbound
        } else if (warmupDay >= 2 && warmupDay <= 7) {
            // Week 1: Slightly more outbound
            outboundRatio = 0.6; // 60% outbound
            inboundRatio = 0.4;  // 40% inbound
        } else {
            // Established: Natural conversation flow
            outboundRatio = 0.7; // 70% outbound
            inboundRatio = 0.3;  // 30% inbound
        }

        console.log(`   📈 Smart ratios for day ${warmupDay}: ${(outboundRatio * 100).toFixed(0)}% outbound, ${(inboundRatio * 100).toFixed(0)}% inbound`);

        return { outboundRatio, inboundRatio };
    }

    // 🎯 NEW: Create properly interleaved sequence
    createInterleavedSequence(warmupAccount, outboundPools, inboundPools, outboundCount, inboundCount, dailyLimit) {
        const sequence = [];

        // Create all email jobs first
        const outboundEmails = [];
        const inboundEmails = [];

        // Create outbound emails (Warmup → Pool)
        for (let i = 0; i < outboundCount && i < outboundPools.length; i++) {
            const pool = outboundPools[i];
            const emailJob = this.createEmailJob(
                warmupAccount,
                pool,
                'WARMUP_TO_POOL',
                i,
                dailyLimit,
                'outbound'
            );
            outboundEmails.push(emailJob);
        }

        // Create inbound emails (Pool → Warmup)
        for (let i = 0; i < inboundCount && i < inboundPools.length; i++) {
            const pool = inboundPools[i];
            const emailJob = this.createEmailJob(
                pool,
                warmupAccount,
                'POOL_TO_WARMUP',
                i,
                dailyLimit,
                'inbound'
            );
            inboundEmails.push(emailJob);
        }

        console.log(`   ├── Created ${outboundEmails.length} outbound, ${inboundEmails.length} inbound emails`);

        // 🎯 INTERLEAVE: Mix outbound and inbound emails naturally
        let outboundIndex = 0;
        let inboundIndex = 0;
        let totalAdded = 0;

        // Start with inbound (more natural - someone emails you first)
        if (inboundEmails.length > 0) {
            sequence.push(inboundEmails[inboundIndex++]);
            totalAdded++;
        }

        // Alternate between outbound and inbound
        while (totalAdded < (outboundEmails.length + inboundEmails.length)) {
            // Add outbound if available and we haven't added too many consecutively
            if (outboundIndex < outboundEmails.length &&
                this.canAddOutbound(sequence, outboundIndex, inboundIndex)) {
                sequence.push(outboundEmails[outboundIndex++]);
                totalAdded++;
            }

            // Add inbound if available
            if (inboundIndex < inboundEmails.length && totalAdded < (outboundEmails.length + inboundEmails.length)) {
                sequence.push(inboundEmails[inboundIndex++]);
                totalAdded++;
            }

            // If we're stuck, break out
            if (outboundIndex >= outboundEmails.length && inboundIndex >= inboundEmails.length) {
                break;
            }
        }

        // 🎯 Apply natural conversation timing
        this.applyConversationTiming(sequence, warmupAccount);

        return sequence;
    }

    // 🎯 NEW: Check if we can add outbound email without breaking conversation flow
    canAddOutbound(sequence, outboundIndex, inboundIndex) {
        // Don't start with 2 outbound emails in a row
        if (sequence.length === 0) return false;

        // Check last 2 emails in sequence
        const lastTwo = sequence.slice(-2);
        const consecutiveOutbound = lastTwo.filter(job => job.direction === 'WARMUP_TO_POOL').length;

        // Allow max 2 consecutive outbound emails
        return consecutiveOutbound < 2;
    }

    // 🎯 NEW: Apply natural conversation timing to interleaved sequence
    applyConversationTiming(sequence, warmupAccount) {
        let lastOutboundTime = 0;
        let conversationGap = this.TESTING_MODE ? (2 * 60 * 1000) : (30 * 60 * 1000); // 2 min testing, 30 min production

        sequence.forEach((emailJob, index) => {
            if (emailJob.direction === 'WARMUP_TO_POOL') {
                // Outbound email - space them out
                emailJob.scheduleDelay = lastOutboundTime + conversationGap;
                lastOutboundTime = emailJob.scheduleDelay;
                conversationGap = this.TESTING_MODE ?
                    (1 + Math.random() * 2) * 60 * 1000 : // 1-3 minutes in testing
                    (20 + Math.random() * 40) * 60 * 1000; // 20-60 minutes in production
            } else {
                // Inbound email - typically comes as a reply 1-4 hours after outbound
                const replyDelay = this.TESTING_MODE ?
                    (2 + Math.random() * 3) * 60 * 1000 : // 2-5 minutes in testing
                    (1 + Math.random() * 3) * 60 * 60 * 1000; // 1-4 hours in production

                emailJob.scheduleDelay = lastOutboundTime + replyDelay;
            }

            console.log(`   ⏱️ ${emailJob.direction} delay: ${(emailJob.scheduleDelay / (this.TESTING_MODE ? 1000 : 60000)).toFixed(0)} ${this.TESTING_MODE ? 'seconds' : 'minutes'}`);
        });
    }

    // 🎯 NEW: Calculate delays for randomized sequence
    calculateRandomizedDelay(sequenceIndex, totalEmails, direction) {
        if (this.TESTING_MODE) {
            // 🚨 TESTING MODE: Even distribution across 1-5 minutes
            const baseDelay = 1 * 60 * 1000; // 1 minute base
            const spread = 4 * 60 * 1000; // 4 minute spread
            const randomFactor = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2 random factor

            let delay = baseDelay + ((sequenceIndex * spread) / Math.max(1, totalEmails - 1));
            delay = delay * randomFactor;

            // Add slight variation based on direction
            if (direction === 'POOL_TO_WARMUP') {
                delay += 30 * 1000; // Inbound emails start slightly later
            }

            console.log(`   ⏱️ RANDOMIZED DELAY [${direction}]: ${(delay / 1000).toFixed(0)} seconds`);
            return delay;
        } else {
            // Production: Spread across business hours with natural variation
            const businessHoursOffset = 9 * 60 * 60 * 1000; // Start at 9 AM
            const spreadDuration = 8 * 60 * 60 * 1000; // Spread over 8 hours
            const randomVariation = (Math.random() - 0.5) * 60 * 60 * 1000; // ±30 minutes random

            let delay = businessHoursOffset + (sequenceIndex * spreadDuration) / Math.max(1, totalEmails - 1);
            delay += randomVariation;

            // Replies come 1-4 hours after outbound emails
            if (direction === 'POOL_TO_WARMUP') {
                const replyDelay = (1 + (Math.random() * 3)) * 60 * 60 * 1000;
                delay += replyDelay;
            }

            return delay;
        }
    }


    // 🚨 FIXED: Ultra-fast testing delays (2-3 minutes)
    calculateOutboundDelay(sequenceIndex, dailyLimit) {
        if (this.TESTING_MODE) {
            // 🚨 TESTING MODE: 1-3 minutes for outbound
            const baseDelay = 1 * 60 * 1000; // 1 minute base
            const increment = 1 * 60 * 1000; // 1 minute increment per sequence
            const delay = baseDelay + (sequenceIndex * increment);
            console.log(`   📤 OUTBOUND TESTING DELAY: ${(delay / 1000).toFixed(0)} seconds`);
            return delay;
        } else {
            // Production: Spread across 8 business hours
            const businessHoursOffset = 9 * 60 * 60 * 1000; // Start at 9 AM
            const spreadDuration = 8 * 60 * 60 * 1000; // Spread over 8 hours
            return businessHoursOffset + (sequenceIndex * spreadDuration) / Math.max(1, dailyLimit - 1);
        }
    }

    calculateInboundDelay(sequenceIndex, dailyLimit) {
        if (this.TESTING_MODE) {
            // 🚨 TESTING MODE: 2-4 minutes for inbound
            const baseDelay = 2 * 60 * 1000; // 2 minutes base
            const increment = 1 * 60 * 1000; // 1 minute increment per sequence
            const delay = baseDelay + (sequenceIndex * increment);
            console.log(`   📥 INBOUND TESTING DELAY: ${(delay / 1000).toFixed(0)} seconds`);
            return delay;
        } else {
            // Production: Replies come 1-4 hours after outbound emails
            const replyDelay = (1 + (sequenceIndex * 3 / Math.max(1, dailyLimit - 1))) * 60 * 60 * 1000;
            return replyDelay;
        }
    }

    // 🚨 FIXED: Dynamic organizational account detection (no hardcoded domains)
    isOrganizationalAccount(email, accountData = null) {
        try {
            const domain = email.split('@')[1];

            // Method 1: Check domain characteristics
            const isLikelyCorporate =
                domain.includes('-inc.') ||
                domain.includes('-corp.') ||
                domain.includes('-llc.') ||
                domain.endsWith('.local') ||
                domain.split('.').length > 2; // subdomain.company.com

            // Method 2: Check account data if available
            if (accountData) {
                if (accountData.provider === 'microsoft' && accountData.tenantId) {
                    return true; // Microsoft with tenant ID = organizational
                }
                if (accountData.organizational === true) {
                    return true;
                }
            }

            return isLikelyCorporate;

        } catch (error) {
            console.log(`❌ Error detecting organizational account for ${email}:`, error);
            return false;
        }
    }

    // 🚨 UPDATED: Organizational plan with testing mode support
    generateOrganizationalAccountPlan(account, availablePools) {
        console.log(`🏢 Generating RECEIVE-ONLY plan for organizational account: ${account.email}`);

        const warmupDayCount = account.warmupDayCount || 0;
        const startEmailsPerDay = account.startEmailsPerDay || 3;
        const increaseEmailsPerDay = account.increaseEmailsPerDay || 1;
        const maxEmailsPerDay = Math.min(account.maxEmailsPerDay || 25, this.MAX_EMAILS_SAFETY_CAP);

        // Calculate limit but use only for inbound (receiving)
        const calculatedSendLimit = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
        const receiveLimit = Math.min(Math.max(calculatedSendLimit, 1), maxEmailsPerDay);

        console.log(`   Day: ${warmupDayCount}, Receive Limit: ${receiveLimit}`);
        console.log(`   ⚠️  Organizational account - SENDING DISABLED`);
        console.log(`   ⏱️  Testing Mode: ${this.TESTING_MODE ? 'YES (fast delays)' : 'NO'}`);

        const accountCapabilities = {
            supportedDirections: ['POOL_TO_WARMUP'],
            organizational: true,
            adminConsentRequired: true
        };

        const plan = {
            account: account,
            totalEmails: receiveLimit,
            outbound: [],
            inbound: [],
            sequence: [],
            warmupDay: warmupDayCount,
            capabilities: accountCapabilities,
            organizational: true
        };

        // Only create inbound emails (Pool → Warmup)
        const inboundPools = this.getCompatiblePoolsForDirection(availablePools, 'POOL_TO_WARMUP');
        console.log(`   📊 Compatible pools for receiving: ${inboundPools.length}`);

        // Create inbound emails with testing mode delays
        for (let i = 0; i < receiveLimit && i < inboundPools.length; i++) {
            const pool = inboundPools[i];
            const scheduleDelay = this.TESTING_MODE
                ? (2 * 60 * 1000) + (i * 30 * 1000) // 2-5 minutes in testing
                : this.calculateInboundDelay(i, receiveLimit);

            const emailJob = {
                senderEmail: pool.email,
                receiverEmail: account.email,
                direction: 'POOL_TO_WARMUP',
                scheduleDelay: scheduleDelay,
                type: 'inbound',
                replyRate: 0 // No replies for organizational accounts
            };

            plan.inbound.push(emailJob);
            plan.sequence.push(emailJob);
        }

        console.log(`   📧 Final sequence: ${plan.sequence.length} RECEIVE-ONLY emails`);
        console.log(`   💡 Admin consent required for sending capabilities`);

        return plan;
    }

    // 🚨 SIMPLIFIED: Get compatible pools
    getCompatiblePoolsForDirection(pools, direction) {
        const compatiblePools = [];

        for (const pool of pools) {
            if (!pool || !pool.email) {
                continue;
            }

            try {
                const poolConfig = buildPoolConfig(pool);
                const poolCapabilities = this.getPoolCapabilities(poolConfig, direction);

                if (poolCapabilities.supportedDirections.includes(direction)) {
                    compatiblePools.push(pool);
                }
            } catch (error) {
                console.log(`   ⚠️  Error checking pool ${pool.email}: ${error.message}`);
                continue;
            }
        }

        return compatiblePools;
    }

    // 🚨 SIMPLIFIED: Pool capabilities
    getPoolCapabilities(poolConfig, direction) {
        const capabilities = {
            supportedDirections: ['WARMUP_TO_POOL'] // All pools can receive
        };

        // Pool accounts can send if they have credentials
        const hasCredentials =
            poolConfig.appPassword ||
            poolConfig.accessToken ||
            poolConfig.smtpPass ||
            poolConfig.smtpPassword ||
            (poolConfig.providerType && poolConfig.providerType === 'GMAIL');

        if (hasCredentials) {
            capabilities.supportedDirections.push('POOL_TO_WARMUP');
        }

        return capabilities;
    }

    // 🚨 SIMPLIFIED: Create email job
    createEmailJob(sender, receiver, direction, sequence, total, type) {
        const baseDelay = this.TESTING_MODE ?
            this.calculateTestingDelay(sequence, type) :
            (type === 'outbound' ?
                this.calculateOutboundDelay(sequence, total) :
                this.calculateInboundDelay(sequence, total));

        let replyRate = sender.replyRate || 0.15;
        if (direction === 'POOL_TO_WARMUP') {
            replyRate = 0; // Inbound emails don't need replies
        }

        return {
            senderEmail: sender.email,
            senderType: this.getAccountType(sender),
            receiverEmail: receiver.email,
            receiverType: this.getAccountType(receiver),
            direction: direction,
            scheduleDelay: baseDelay,
            replyRate: replyRate
        };
    }

    // 🚨 FIXED: Testing mode delays (2-3 minutes)
    calculateTestingDelay(sequence, type) {
        if (type === 'outbound') {
            return (1 + sequence) * 60 * 1000; // 1, 2, 3... minutes
        } else {
            return (2 + sequence) * 60 * 1000; // 2, 3, 4... minutes
        }
    }

    getAccountType(account) {
        if (account.provider === 'google') return 'google';
        if (account.provider === 'microsoft') return 'microsoft';
        if (account.smtp_host) return 'smtp';
        if (account.providerType) return account.providerType;
        return 'unknown';
    }


    // 🎯 NEW: Fisher-Yates shuffle algorithm for true randomization
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }


}

module.exports = UnifiedWarmupStrategy;