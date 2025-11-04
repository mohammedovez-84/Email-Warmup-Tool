const { buildPoolConfig } = require("../../utils/senderConfig");

class UnifiedWarmupStrategy {
    constructor() {
        this.MAX_EMAILS_SAFETY_CAP = 50;
        this.TESTING_MODE = process.env.WARMUP_TESTING_MODE === 'true';

        console.log(`🔧 TESTING MODE: ${this.TESTING_MODE ? 'ENABLED (2-3 min delays)' : 'DISABLED'}`);
    }

    async generateWarmupPlan(warmupAccount, poolAccounts, replyRate) {
        try {
            console.log(`📊 GENERATING PLAN for ${warmupAccount.email}:`);
            console.log(`   ├── Warmup Day: ${warmupAccount.warmupDayCount || 0}`);
            console.log(`   ├── Start: ${warmupAccount.startEmailsPerDay || 3}`);
            console.log(`   ├── Increase: ${warmupAccount.increaseEmailsPerDay || 3}`);
            console.log(`   └── Max: ${warmupAccount.maxEmailsPerDay || 25}`);
            console.log(`   ⏱️ Testing Mode: ${this.TESTING_MODE ? 'YES (fast delays)' : 'NO'}`);

            // 🚨 DYNAMIC organizational detection
            const isOrganizational = this.isOrganizationalAccount(warmupAccount.email, warmupAccount);
            if (isOrganizational) {
                console.log(`   🏢 Organizational account detected - receive-only mode`);
                return this.generateOrganizationalAccountPlan(warmupAccount, poolAccounts);
            }

            // 🚨 CALCULATE ACTUAL DAILY LIMIT FROM DATABASE FIELDS
            const startEmailsPerDay = warmupAccount.startEmailsPerDay || 3;
            const increaseEmailsPerDay = warmupAccount.increaseEmailsPerDay || 3;
            const maxEmailsPerDay = warmupAccount.maxEmailsPerDay || 25;
            const warmupDayCount = warmupAccount.warmupDayCount || 0;

            // Calculate volume based on warmup progression
            let dailyLimit = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
            dailyLimit = Math.min(dailyLimit, maxEmailsPerDay);
            dailyLimit = Math.max(1, dailyLimit); // At least 1 email per day

            console.log(`   📈 CALCULATED DAILY LIMIT: ${dailyLimit} emails`);

            // 🚨 USE DAILY LIMIT TO DETERMINE HOW MANY EMAILS TO CREATE
            const sequence = [];

            // Calculate how many pools we can use (limited by daily limit)
            const maxPoolsToUse = Math.min(poolAccounts.length, Math.ceil(dailyLimit / 2));

            console.log(`   🏊 USING ${maxPoolsToUse} of ${poolAccounts.length} pools`);

            // 🚨 CREATE BIDIRECTIONAL PAIRS (but limited by daily limit)
            for (let i = 0; i < maxPoolsToUse; i++) {
                const poolAccount = poolAccounts[i];

                // Stop if we've reached the daily limit
                if (sequence.length >= dailyLimit) break;

                // OUTBOUND: Warmup → Pool
                sequence.push({
                    senderEmail: warmupAccount.email,
                    receiverEmail: poolAccount.email,
                    direction: 'WARMUP_TO_POOL',
                    scheduleDelay: this.calculateOutboundDelay(sequence.length, dailyLimit),
                    type: 'initial'
                });

                // Stop if we've reached the daily limit
                if (sequence.length >= dailyLimit) break;

                // INBOUND: Pool → Warmup (reply simulation)
                sequence.push({
                    senderEmail: poolAccount.email,
                    receiverEmail: warmupAccount.email,
                    direction: 'POOL_TO_WARMUP',
                    scheduleDelay: this.calculateInboundDelay(sequence.length, dailyLimit),
                    type: 'reply'
                });
            }

            // 🚨 IF WE STILL HAVE CAPACITY, ADD MORE OUTBOUND EMAILS
            let additionalOutbound = dailyLimit - sequence.length;
            if (additionalOutbound > 0) {
                console.log(`   📤 ADDING ${additionalOutbound} EXTRA OUTBOUND EMAILS`);

                for (let i = 0; i < additionalOutbound && i < poolAccounts.length; i++) {
                    const poolAccount = poolAccounts[i % poolAccounts.length];

                    sequence.push({
                        senderEmail: warmupAccount.email,
                        receiverEmail: poolAccount.email,
                        direction: 'WARMUP_TO_POOL',
                        scheduleDelay: this.calculateOutboundDelay(sequence.length, dailyLimit),
                        type: 'initial'
                    });

                    if (sequence.length >= dailyLimit) break;
                }
            }

            console.log(`   📧 FINAL PLAN: ${sequence.length} emails (${dailyLimit} limit)`);
            console.log(`   🔄 BREAKDOWN: ${sequence.filter(s => s.direction === 'WARMUP_TO_POOL').length} outbound, ${sequence.filter(s => s.direction === 'POOL_TO_WARMUP').length} inbound`);

            return {
                sequence: this.shuffleArray(sequence),
                totalEmails: sequence.length,
                outboundCount: sequence.filter(s => s.direction === 'WARMUP_TO_POOL').length,
                inboundCount: sequence.filter(s => s.direction === 'POOL_TO_WARMUP').length,
                dailyLimit: dailyLimit,
                warmupDay: warmupDayCount,
                testingMode: this.TESTING_MODE
            };

        } catch (error) {
            console.error(`❌ PLAN GENERATION ERROR:`, error);
            return { error: error.message };
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