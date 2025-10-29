const { buildSenderConfig, buildPoolConfig } = require("../utils/senderConfig");

class UnifiedWarmupStrategy {
    constructor() {
        this.MAX_EMAILS_SAFETY_CAP = 50;
        this.TESTING_MODE = process.env.WARMUP_TESTING_MODE === 'true';
    }

    async generateWarmupPlan(account, availablePools) {
        // VALIDATE ACCOUNT FIRST
        if (!account || !account.email) {
            console.error('❌ INVALID ACCOUNT: No account or email provided');
            return this.createEmptyPlan(account, 'Invalid account provided');
        }

        if (typeof account.email !== 'string' || !account.email.includes('@')) {
            console.error('❌ INVALID ACCOUNT: Invalid email format', account.email);
            return this.createEmptyPlan(account, 'Invalid email format');
        }

        console.log(`🎯 Generating warmup plan for: ${account.email}`);

        // GET ACTUAL VALUES FROM DATABASE
        const warmupDayCount = account.warmupDayCount || 0;
        const startEmailsPerDay = account.startEmailsPerDay || 3;
        const increaseEmailsPerDay = account.increaseEmailsPerDay || 1;
        const maxEmailsPerDay = Math.min(account.maxEmailsPerDay || 25, this.MAX_EMAILS_SAFETY_CAP);

        // CALCULATE ACTUAL SEND LIMIT FROM DB FIELDS
        const calculatedSendLimit = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
        const sendLimit = Math.min(Math.max(calculatedSendLimit, 1), maxEmailsPerDay);

        console.log(`   Day: ${warmupDayCount}, Send Limit: ${sendLimit}`);
        console.log(`   Start: ${startEmailsPerDay}, Increase: ${increaseEmailsPerDay}, Max: ${maxEmailsPerDay}`);

        try {
            // Build account config
            const accountConfig = buildSenderConfig(account);

            // Use a simple capabilities object
            const accountCapabilities = {
                supportedDirections: ['WARMUP_TO_POOL', 'POOL_TO_WARMUP']
            };

            console.log(`   Account Capabilities: ${accountCapabilities.supportedDirections.join(', ')}`);

            // Determine strategy based on warmup day
            const strategy = this.getStrategyForDay(warmupDayCount, sendLimit);

            const outboundCount = Math.max(1, Math.floor(sendLimit * strategy.outboundRatio));
            const inboundCount = sendLimit - outboundCount;

            console.log(`   Strategy: ${strategy.phase}`);
            console.log(`   Outbound: ${outboundCount}, Inbound: ${inboundCount}`);

            return await this.createEmailSequence(account, availablePools, outboundCount, inboundCount, warmupDayCount, accountCapabilities);

        } catch (error) {
            console.error(`❌ Failed to build config for ${account.email}:`, error.message);
            return this.createEmptyPlan(account, error.message);
        }
    }

    getStrategyForDay(warmupDayCount, sendLimit) {
        let baseStrategy = { phase: 'INITIAL', outboundRatio: 0.66 };

        // Base strategy based on warmup day
        if (warmupDayCount === 0) {
            baseStrategy = { phase: 'INITIAL', outboundRatio: 0.66 };
        } else if (warmupDayCount < 3) {
            baseStrategy = { phase: 'BUILDING', outboundRatio: 0.5 };
        } else if (warmupDayCount < 7) {
            baseStrategy = { phase: 'ESTABLISHING', outboundRatio: 0.45 };
        } else if (warmupDayCount < 14) {
            baseStrategy = { phase: 'MATURE', outboundRatio: 0.5 };
        } else {
            baseStrategy = { phase: 'PRODUCTION', outboundRatio: 0.6 };
        }

        console.log(`   Final strategy ratio: ${baseStrategy.outboundRatio} (${baseStrategy.phase})`);
        return baseStrategy;
    }

    async createEmailSequence(account, availablePools, outboundCount, inboundCount, warmupDay, capabilities) {
        const plan = {
            account: account,
            totalEmails: outboundCount + inboundCount,
            outbound: [],
            inbound: [],
            sequence: [],
            warmupDay: warmupDay,
            capabilities: capabilities,
            dbValues: {
                startEmailsPerDay: account.startEmailsPerDay,
                increaseEmailsPerDay: account.increaseEmailsPerDay,
                maxEmailsPerDay: account.maxEmailsPerDay,
                calculatedLimit: outboundCount + inboundCount
            }
        };

        // Filter pools based on capabilities for each direction
        const outboundPools = this.getCompatiblePoolsForDirection(availablePools, 'WARMUP_TO_POOL');
        const inboundPools = this.getCompatiblePoolsForDirection(availablePools, 'POOL_TO_WARMUP');

        console.log(`   📊 Compatible pools - Outbound: ${outboundPools.length}, Inbound: ${inboundPools.length}`);

        // Create outbound emails (Warmup → Pool) - only if capability allows
        if (capabilities.supportedDirections.includes('WARMUP_TO_POOL') && outboundCount > 0) {
            for (let i = 0; i < outboundCount && i < outboundPools.length; i++) {
                const pool = outboundPools[i];
                plan.outbound.push(this.createEmailJob(account, pool, 'WARMUP_TO_POOL', i, outboundCount, 'outbound'));
            }
        }

        // Create inbound emails (Pool → Warmup) - only if capability allows
        if (capabilities.supportedDirections.includes('POOL_TO_WARMUP') && inboundCount > 0) {
            for (let i = 0; i < inboundCount && i < inboundPools.length; i++) {
                const pool = inboundPools[(i + outboundCount) % inboundPools.length];
                plan.inbound.push(this.createEmailJob(pool, account, 'POOL_TO_WARMUP', i, inboundCount, 'inbound'));
            }
        }

        // Interleave for natural flow
        plan.sequence = this.interleaveEmails(plan.outbound, plan.inbound);

        console.log(`   📧 Final sequence: ${plan.sequence.length} emails (${plan.outbound.length} outbound, ${plan.inbound.length} inbound)`);

        return plan;
    }

    // FIXED: Get pools compatible with specific direction
    getCompatiblePoolsForDirection(pools, direction) {
        const compatiblePools = [];

        for (const pool of pools) {
            // Validate pool has required fields
            if (!pool || !pool.email || typeof pool.email !== 'string') {
                console.log(`   ⚠️  Skipping invalid pool: missing email field`);
                continue;
            }

            try {
                // For pool accounts, use buildPoolConfig instead of buildWarmupConfig
                const poolConfig = buildPoolConfig(pool);

                // Simple capability check for pool accounts
                const poolCapabilities = this.getPoolCapabilities(poolConfig, direction);

                if (poolCapabilities.supportedDirections.includes(direction)) {
                    compatiblePools.push(pool);
                    console.log(`   ✅ Compatible pool: ${pool.email} for ${direction}`);
                } else {
                    console.log(`   ❌ Incompatible pool: ${pool.email} cannot handle ${direction}`);
                }
            } catch (error) {
                console.log(`   ⚠️  Error checking pool ${pool.email} compatibility: ${error.message}`);
                continue;
            }
        }

        return compatiblePools;
    }

    // NEW: Simple capability detection for pool accounts
    getPoolCapabilities(poolConfig, direction) {
        const capabilities = {
            supportedDirections: []
        };

        // Pool accounts can always receive emails
        capabilities.supportedDirections.push('WARMUP_TO_POOL');

        // Pool accounts can send if they have proper credentials
        if (poolConfig.smtpPass || poolConfig.accessToken) {
            capabilities.supportedDirections.push('POOL_TO_WARMUP');
        }

        return capabilities;
    }

    createEmailJob(sender, receiver, direction, sequence, total, type) {
        const baseDelay = this.TESTING_MODE ?
            this.calculateTestingDelay(sequence, type) :
            (type === 'outbound' ?
                this.calculateOutboundDelay(sequence, total) :
                this.calculateInboundDelay(sequence, total));

        // Get sender capabilities for reply rate adjustment
        let replyRate = sender.replyRate || 0.15;

        // Adjust reply rate based on direction and capabilities
        if (direction === 'POOL_TO_WARMUP') {
            // Inbound emails from pools typically don't need replies
            replyRate = 0;
        }

        return {
            sender: sender,
            senderEmail: sender.email,
            senderType: this.getAccountType(sender),
            receiver: receiver,
            receiverEmail: receiver.email,
            receiverType: this.getAccountType(receiver),
            direction: direction,
            isInitialEmail: true,
            scheduleDelay: baseDelay,
            sequence: sequence,
            replyRate: replyRate
        };
    }

    // TESTING MODE: Immediate execution with small delays
    calculateTestingDelay(sequence, type) {
        // 1-5 minute delays for testing
        const baseDelay = 1 * 60 * 1000; // 1 minute base
        const increment = 1 * 60 * 1000; // 1 minute increment

        return baseDelay + (sequence * increment);
    }

    // PRODUCTION: Normal delays
    calculateOutboundDelay(sequence, total) {
        // Outbound: Spread across business hours (9 AM - 5 PM)
        const businessHoursOffset = 9 * 60 * 60 * 1000;
        const spread = 8 * 60 * 60 * 1000;
        return businessHoursOffset + (sequence * spread) / Math.max(1, total - 1);
    }

    calculateInboundDelay(sequence, total) {
        // Inbound: More random, throughout the day
        const randomOffset = Math.random() * 12 * 60 * 60 * 1000;
        return randomOffset + (sequence * 2 * 60 * 60 * 1000);
    }

    interleaveEmails(outbound, inbound) {
        const sequence = [];
        const maxLength = Math.max(outbound.length, inbound.length);

        for (let i = 0; i < maxLength; i++) {
            if (i < outbound.length) sequence.push(outbound[i]);
            if (i < inbound.length) sequence.push(inbound[i]);
        }

        return sequence;
    }

    getAccountType(account) {
        if (account.provider === 'google') return 'google';
        if (account.provider === 'microsoft') return 'microsoft';
        if (account.smtp_host) return 'smtp';
        if (account.providerType) return account.providerType; // For pool accounts
        return 'unknown';
    }

    createEmptyPlan(account, error) {
        return {
            account: account,
            totalEmails: 0,
            outbound: [],
            inbound: [],
            sequence: [],
            warmupDay: account?.warmupDayCount || 0,
            error: error
        };
    }
}

module.exports = UnifiedWarmupStrategy;