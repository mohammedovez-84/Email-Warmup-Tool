const EmailExchange = require("../../models/MailExchange");
const ReplyTracking = require("../../models/ReplyTracking");
const { buildPoolConfig } = require("../../utils/senderConfig");

class UnifiedWarmupStrategy {
    constructor() {
        this.MAX_EMAILS_SAFETY_CAP = 50;
        this.TESTING_MODE = process.env.WARMUP_TESTING_MODE === 'true';

        console.log(`🔧 TESTING MODE: ${this.TESTING_MODE ? 'ENABLED (2-3 min delays)' : 'DISABLED'}`);
    }

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

            const dailyLimit = await this.calculateDailyLimit(warmupAccount);

            // 🎯 FIX: Use RANDOMIZED sequence generation
            const sequence = await this.generateRandomizedEmailSequence(
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

    // 🎯 NEW: Generate truly randomized email sequence
    async generateRandomizedEmailSequence(warmupAccount, poolAccounts, dailyLimit, replyRate) {
        try {
            console.log(`   🎲 Generating RANDOMIZED email sequence for ${dailyLimit} emails`);

            const isOrganizational = this.isOrganizationalAccount(warmupAccount.email, warmupAccount);
            if (isOrganizational) {
                console.log(`   🏢 Organizational account detected - receive-only mode`);
                const orgPlan = this.generateOrganizationalAccountPlan(warmupAccount, poolAccounts);
                return orgPlan.sequence || [];
            }

            // 🎯 Calculate ratios
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

            // 🎯 CRITICAL FIX: Generate RANDOMIZED sequence
            const randomizedSequence = this.createRandomizedBidirectionalSequence(
                warmupAccount,
                outboundPools,
                inboundPools,
                outboundCount,
                inboundCount
            );

            console.log(`   ✅ Final RANDOMIZED sequence: ${randomizedSequence.length} emails`);

            // Log the actual mix and pattern
            const actualOutbound = randomizedSequence.filter(job => job.direction === 'WARMUP_TO_POOL').length;
            const actualInbound = randomizedSequence.filter(job => job.direction === 'POOL_TO_WARMUP').length;
            console.log(`   📊 Actual mix: ${actualOutbound} outbound, ${actualInbound} inbound`);
            console.log(`   🎯 Pattern: ${this.getSequencePattern(randomizedSequence)}`);

            return randomizedSequence;

        } catch (error) {
            console.error(`❌ Error generating randomized sequence:`, error);
            return [];
        }
    }

    // 🎯 FIXED: True random pool selection
    distributeEmailsAcrossPools(pools, emailCount, direction) {
        const jobs = [];

        if (pools.length === 0) return jobs;

        console.log(`   🎲 RANDOMIZING: Selecting from ${pools.length} available pools`);

        // 🎯 SHUFFLE pools randomly first
        const shuffledPools = this.shuffleArray([...pools]);

        // 🎯 DISTRIBUTE emails randomly across shuffled pools
        for (let i = 0; i < emailCount; i++) {
            const poolIndex = i % shuffledPools.length;
            const pool = shuffledPools[poolIndex];

            const emailJob = direction === 'WARMUP_TO_POOL'
                ? this.createRandomizedEmailJob(warmupAccount, pool, direction, i, emailCount)
                : this.createRandomizedEmailJob(pool, warmupAccount, direction, i, emailCount);

            jobs.push(emailJob);
        }

        console.log(`   ✅ Distributed ${emailCount} emails across ${shuffledPools.length} randomly selected pools`);
        return jobs;
    }

    createRandomizedBidirectionalSequence(warmupAccount, outboundPools, inboundPools, outboundCount, inboundCount) {
        const allEmailJobs = [];

        console.log(`   🔨 Creating TRULY RANDOM email combinations...`);

        // 🎯 SHUFFLE BOTH POOL SETS for true randomness
        const randomizedOutboundPools = this.shuffleArray([...outboundPools]);
        const randomizedInboundPools = this.shuffleArray([...inboundPools]);

        console.log(`   🎲 Outbound pools shuffled: ${randomizedOutboundPools.map(p => p.email).join(', ')}`);
        console.log(`   🎲 Inbound pools shuffled: ${randomizedInboundPools.map(p => p.email).join(', ')}`);

        // 🎯 CREATE OUTBOUND emails with random pool selection
        const outboundJobs = this.createRandomizedEmailSet(
            warmupAccount,
            randomizedOutboundPools,
            outboundCount,
            'WARMUP_TO_POOL'
        );

        // 🎯 CREATE INBOUND emails with random pool selection  
        const inboundJobs = this.createRandomizedEmailSet(
            warmupAccount,
            randomizedInboundPools,
            inboundCount,
            'POOL_TO_WARMUP'
        );

        allEmailJobs.push(...outboundJobs, ...inboundJobs);

        console.log(`   ├── Created ${allEmailJobs.length} total email jobs`);
        console.log(`   ├── Outbound: ${outboundCount} emails across ${randomizedOutboundPools.length} pools`);
        console.log(`   ├── Inbound: ${inboundCount} emails across ${randomizedInboundPools.length} pools`);

        // 🎯 FINAL SHUFFLE for maximum randomness
        console.log(`   🔀 Final shuffle of all email jobs...`);
        const finalShuffled = this.shuffleArray(allEmailJobs);

        // Apply timing to the final shuffled sequence
        this.applyNaturalConversationTiming(finalShuffled, warmupAccount);

        return finalShuffled;
    }

    // 🎯 NEW: Create randomized email set with proper distribution
    createRandomizedEmailSet(primaryAccount, availablePools, emailCount, direction) {
        const jobs = [];

        if (availablePools.length === 0) return jobs;

        console.log(`   🎯 Creating ${emailCount} ${direction} emails across ${availablePools.length} pools`);

        // 🎯 STRATEGY: Round-robin through shuffled pools for even distribution
        for (let i = 0; i < emailCount; i++) {
            const poolIndex = i % availablePools.length;
            const selectedPool = availablePools[poolIndex];

            const emailJob = direction === 'WARMUP_TO_POOL'
                ? this.createRandomizedEmailJob(primaryAccount, selectedPool, direction, i, emailCount)
                : this.createRandomizedEmailJob(selectedPool, primaryAccount, direction, i, emailCount);

            jobs.push(emailJob);

            if (i < 5) { // Log first few selections to verify randomness
                console.log(`      ${i + 1}. Using pool: ${selectedPool.email}`);
            }
        }

        if (emailCount > 5) {
            console.log(`      ... and ${emailCount - 5} more emails`);
        }

        return jobs;
    }

    // 🎯 NEW: Create email job with randomized timing
    createRandomizedEmailJob(sender, receiver, direction, sequenceIndex, totalEmails) {
        // 🎯 RANDOM: Calculate delay with more randomness
        const baseDelay = this.calculateRandomizedDelay(sequenceIndex, totalEmails, direction);

        // 🎯 ADD EXTRA RANDOMNESS: ±30% variation
        const randomVariation = 0.7 + (Math.random() * 0.6); // 0.7 to 1.3
        const finalDelay = baseDelay * randomVariation;

        let replyRate = sender.replyRate || 0.15;
        if (direction === 'POOL_TO_WARMUP') {
            replyRate = 0; // Inbound emails don't need replies
        }

        const emailJob = {
            senderEmail: sender.email,
            senderType: this.getAccountType(sender),
            receiverEmail: receiver.email,
            receiverType: this.getAccountType(receiver),
            direction: direction,
            scheduleDelay: finalDelay,
            replyRate: replyRate,
            poolUsed: direction === 'WARMUP_TO_POOL' ? receiver.email : sender.email
        };

        console.log(`   ⏱️ ${direction} delay: ${(finalDelay / (this.TESTING_MODE ? 1000 : 60000)).toFixed(0)} ${this.TESTING_MODE ? 'seconds' : 'minutes'} (pool: ${emailJob.poolUsed})`);

        return emailJob;
    }

    // 🎯 UPDATED: Calculate delays for randomized sequence
    calculateRandomizedDelay(sequenceIndex, totalEmails, direction) {
        if (this.TESTING_MODE) {
            // 🚨 TESTING MODE: More random distribution
            const baseDelay = 1 * 60 * 1000; // 1 minute base
            const randomSpread = Math.random() * 4 * 60 * 1000; // 0-4 minutes random

            let delay = baseDelay + randomSpread;

            // Inbound emails start slightly later for natural flow
            if (direction === 'POOL_TO_WARMUP') {
                delay += 30 * 1000;
            }

            // Add some sequence-based progression but keep it random
            delay += (sequenceIndex * 0.5 * 60 * 1000); // Small progression

            return delay;
        } else {
            // Production: Natural business hours with randomness
            const businessHoursStart = 9 * 60 * 60 * 1000; // 9 AM
            const spreadDuration = 8 * 60 * 60 * 1000; // 8 hours

            // Random position within business hours
            const randomPosition = Math.random() * spreadDuration;
            let delay = businessHoursStart + randomPosition;

            // Replies come 1-4 hours after outbound emails
            if (direction === 'POOL_TO_WARMUP') {
                const replyDelay = (1 + (Math.random() * 3)) * 60 * 60 * 1000;
                delay += replyDelay;
            }



            return delay;
        }
    }

    // 🎯 NEW: Apply natural conversation timing to shuffled sequence
    applyNaturalConversationTiming(sequence, warmupAccount) {
        console.log(`   💬 Applying natural conversation timing to randomized sequence...`);

        let lastOutboundTime = 0;
        let conversationGap = this.TESTING_MODE ?
            (2 * 60 * 1000) : // 2 min in testing
            (30 * 60 * 1000); // 30 min in production

        // Reset all delays and apply natural conversation flow
        sequence.forEach((emailJob, index) => {
            if (emailJob.direction === 'WARMUP_TO_POOL') {
                // Outbound email - space them out naturally
                emailJob.scheduleDelay = lastOutboundTime + conversationGap;
                lastOutboundTime = emailJob.scheduleDelay;

                // Randomize the gap between outbound emails
                conversationGap = this.TESTING_MODE ?
                    (1 + Math.random() * 3) * 60 * 1000 : // 1-4 minutes in testing
                    (15 + Math.random() * 45) * 60 * 1000; // 15-60 minutes in production
            } else {

                // Inbound email - typically comes as a reply after outbound
                const replyDelay = this.TESTING_MODE ?
                    (1 + Math.random() * 2) * 60 * 1000 : // 1-3 minutes in testing
                    (1 + Math.random() * 2) * 60 * 60 * 1000; // 1-3 hours in production

                // Find the most recent outbound email for natural reply timing
                const recentOutbound = this.findMostRecentOutbound(sequence, index);
                if (recentOutbound) {
                    emailJob.scheduleDelay = recentOutbound.scheduleDelay + replyDelay;
                } else {
                    // No recent outbound, use progressive timing
                    emailJob.scheduleDelay = lastOutboundTime + replyDelay;
                }
            }
        });

        // 🎯 FINAL SHUFFLE: One more shuffle to break any remaining patterns
        const finalSequence = this.shuffleArray(sequence);

        console.log(`   ✅ Applied natural conversation timing to ${finalSequence.length} emails`);
        return finalSequence;
    }

    // 🎯 NEW: Find most recent outbound email for natural reply timing
    findMostRecentOutbound(sequence, currentIndex) {
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (sequence[i].direction === 'WARMUP_TO_POOL') {
                return sequence[i];
            }
        }
        return null;
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

    // 🎯 NEW: Get sequence pattern for logging
    getSequencePattern(sequence) {
        if (sequence.length === 0) return "Empty";

        const pattern = sequence.slice(0, 10).map(job =>
            job.direction === 'WARMUP_TO_POOL' ? 'OUT' : 'IN'
        ).join(' ');

        return sequence.length > 10 ? pattern + '...' : pattern;
    }

    // 🎯 Keep your existing helper methods (they're good!)
    calculateSmartRatios(warmupAccount) {
        const warmupDay = warmupAccount.warmupDayCount || 0;
        let outboundRatio, inboundRatio;

        if (warmupDay === 0) {
            outboundRatio = 0.4; inboundRatio = 0.6;
        } else if (warmupDay === 1) {
            outboundRatio = 0.5; inboundRatio = 0.5;
        } else if (warmupDay >= 2 && warmupDay <= 7) {
            outboundRatio = 0.6; inboundRatio = 0.4;
        } else {
            outboundRatio = 0.7; inboundRatio = 0.3;
        }

        return { outboundRatio, inboundRatio };
    }

    // ... keep all your other existing methods (getActualReplyMetrics, calculateDailyLimit, etc.)

    getCompatiblePoolsForDirection(pools, direction) {
        const compatiblePools = [];
        for (const pool of pools) {
            if (!pool || !pool.email) continue;
            try {
                const poolConfig = buildPoolConfig(pool);
                const poolCapabilities = this.getPoolCapabilities(poolConfig, direction);
                if (poolCapabilities.supportedDirections.includes(direction)) {
                    compatiblePools.push(pool);
                }
            } catch (error) {
                console.log(`   ⚠️  Error checking pool ${pool.email}: ${error.message}`);
            }
        }
        return compatiblePools;
    }

    getPoolCapabilities(poolConfig, direction) {
        const capabilities = { supportedDirections: ['WARMUP_TO_POOL'] };
        const hasCredentials = poolConfig.appPassword || poolConfig.accessToken ||
            poolConfig.smtpPass || poolConfig.smtpPassword ||
            (poolConfig.providerType && poolConfig.providerType === 'GMAIL');
        if (hasCredentials) capabilities.supportedDirections.push('POOL_TO_WARMUP');
        return capabilities;
    }

    getAccountType(account) {
        if (account.provider === 'google') return 'google';
        if (account.provider === 'microsoft') return 'microsoft';
        if (account.smtp_host) return 'smtp';
        if (account.providerType) return account.providerType;
        return 'unknown';
    }

    // 🎯 KEEP: Actual reply metrics
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

    // 🎯 KEEP: Daily limit calculation
    calculateDailyLimit(warmupAccount) {
        try {
            const warmupDayCount = warmupAccount.warmupDayCount || 0;
            const startEmailsPerDay = warmupAccount.startEmailsPerDay || 3;
            const increaseEmailsPerDay = warmupAccount.increaseEmailsPerDay || 1;
            const maxEmailsPerDay = Math.min(warmupAccount.maxEmailsPerDay || 25, this.MAX_EMAILS_SAFETY_CAP);

            const calculatedLimit = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
            const dailyLimit = Math.min(Math.max(calculatedLimit, 1), maxEmailsPerDay);

            console.log(`   ├── Start: ${startEmailsPerDay}, Increase: ${increaseEmailsPerDay}, Max: ${maxEmailsPerDay}`);
            console.log(`   ├── Calculated: ${calculatedLimit}, Final: ${dailyLimit}`);

            return dailyLimit;

        } catch (error) {
            console.error(`❌ Error calculating daily limit:`, error);
            return 5;
        }
    }

    // 🎯 KEEP: Organizational account detection
    isOrganizationalAccount(email, accountData = null) {
        try {
            const domain = email.split('@')[1];

            const isLikelyCorporate =
                domain.includes('-inc.') ||
                domain.includes('-corp.') ||
                domain.includes('-llc.') ||
                domain.endsWith('.local') ||
                domain.split('.').length > 2;

            if (accountData) {
                if (accountData.provider === 'microsoft' && accountData.tenantId) {
                    return true;
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

    // 🎯 KEEP: Organizational account plan
    generateOrganizationalAccountPlan(account, availablePools) {
        console.log(`🏢 Generating RECEIVE-ONLY plan for organizational account: ${account.email}`);

        const warmupDayCount = account.warmupDayCount || 0;
        const startEmailsPerDay = account.startEmailsPerDay || 3;
        const increaseEmailsPerDay = account.increaseEmailsPerDay || 1;
        const maxEmailsPerDay = Math.min(account.maxEmailsPerDay || 25, this.MAX_EMAILS_SAFETY_CAP);

        const calculatedSendLimit = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
        const receiveLimit = Math.min(Math.max(calculatedSendLimit, 1), maxEmailsPerDay);

        console.log(`   Day: ${warmupDayCount}, Receive Limit: ${receiveLimit}`);
        console.log(`   ⚠️  Organizational account - SENDING DISABLED`);

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

        const inboundPools = this.getCompatiblePoolsForDirection(availablePools, 'POOL_TO_WARMUP');
        console.log(`   📊 Compatible pools for receiving: ${inboundPools.length}`);

        for (let i = 0; i < receiveLimit && i < inboundPools.length; i++) {
            const pool = inboundPools[i];
            const scheduleDelay = this.TESTING_MODE
                ? (2 * 60 * 1000) + (i * 30 * 1000)
                : this.calculateInboundDelay(i, receiveLimit);

            const emailJob = {
                senderEmail: pool.email,
                receiverEmail: account.email,
                direction: 'POOL_TO_WARMUP',
                scheduleDelay: scheduleDelay,
                type: 'inbound',
                replyRate: 0
            };

            plan.inbound.push(emailJob);
            plan.sequence.push(emailJob);
        }

        console.log(`   📧 Final sequence: ${plan.sequence.length} RECEIVE-ONLY emails`);
        return plan;
    }

    // 🎯 KEEP: Calculate inbound delay (needed for organizational accounts)
    calculateInboundDelay(sequenceIndex, dailyLimit) {
        if (this.TESTING_MODE) {
            const baseDelay = 2 * 60 * 1000;
            const increment = 1 * 60 * 1000;
            const delay = baseDelay + (sequenceIndex * increment);
            console.log(`   📥 INBOUND TESTING DELAY: ${(delay / 1000).toFixed(0)} seconds`);
            return delay;
        } else {
            const replyDelay = (1 + (sequenceIndex * 3 / Math.max(1, dailyLimit - 1))) * 60 * 60 * 1000;
            return replyDelay;
        }
    }

    // 🎯 KEEP: Get compatible pools
    getCompatiblePoolsForDirection(pools, direction) {
        const compatiblePools = [];
        for (const pool of pools) {
            if (!pool || !pool.email) continue;
            try {
                const poolConfig = buildPoolConfig(pool);
                const poolCapabilities = this.getPoolCapabilities(poolConfig, direction);
                if (poolCapabilities.supportedDirections.includes(direction)) {
                    compatiblePools.push(pool);
                }
            } catch (error) {
                console.log(`   ⚠️  Error checking pool ${pool.email}: ${error.message}`);
            }
        }
        return compatiblePools;
    }

    // 🎯 KEEP: Pool capabilities
    getPoolCapabilities(poolConfig, direction) {
        const capabilities = { supportedDirections: ['WARMUP_TO_POOL'] };
        const hasCredentials = poolConfig.appPassword || poolConfig.accessToken ||
            poolConfig.smtpPass || poolConfig.smtpPassword ||
            (poolConfig.providerType && poolConfig.providerType === 'GMAIL');
        if (hasCredentials) capabilities.supportedDirections.push('POOL_TO_WARMUP');
        return capabilities;
    }

    // 🎯 KEEP: Get account type
    getAccountType(account) {
        if (account.provider === 'google') return 'google';
        if (account.provider === 'microsoft') return 'microsoft';
        if (account.smtp_host) return 'smtp';
        if (account.providerType) return account.providerType;
        return 'unknown';
    }
}

module.exports = UnifiedWarmupStrategy;