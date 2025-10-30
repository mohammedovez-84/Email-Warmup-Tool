const { buildSenderConfig, buildPoolConfig } = require("../utils/senderConfig");

class UnifiedWarmupStrategy {
    constructor() {
        this.MAX_EMAILS_SAFETY_CAP = 50;
        this.TESTING_MODE = process.env.WARMUP_TESTING_MODE === 'true';

        // Organizational domains that require special handling
        this.ORGANIZATIONAL_DOMAINS = ['elmstreetweb.com']; // Add more as needed
    }

    // In your unified-strategy.js - ensure it generates both directions
    async generateWarmupPlan(warmupAccount, poolAccounts, replyRate) {
        try {
            const sequence = [];

            // Create BOTH directions
            for (const poolAccount of poolAccounts) {
                // OUTBOUND: Warmup → Pool
                sequence.push({
                    senderEmail: warmupAccount.email,
                    receiverEmail: poolAccount.email,
                    direction: 'WARMUP_TO_POOL',
                    scheduleDelay: this.calculateScheduleDelay(sequence.length),
                    type: 'initial'
                });

                // INBOUND: Pool → Warmup (reply simulation)
                sequence.push({
                    senderEmail: poolAccount.email,
                    receiverEmail: warmupAccount.email,
                    direction: 'POOL_TO_WARMUP',
                    scheduleDelay: this.calculateScheduleDelay(sequence.length + 1), // Stagger the timing
                    type: 'reply'
                });
            }

            return {
                sequence: this.shuffleArray(sequence), // Mix up the order
                totalEmails: sequence.length,
                outboundCount: sequence.filter(s => s.direction === 'WARMUP_TO_POOL').length,
                inboundCount: sequence.filter(s => s.direction === 'POOL_TO_WARMUP').length
            };

        } catch (error) {
            return { error: error.message };
        }
    }
    // NEW: Generate plan specifically for organizational accounts
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
        console.log(`   ⚠️  Organizational account - SENDING DISABLED (admin consent required)`);
        console.log(`   📥 Proceeding with receiving-only warmup`);

        // Organizational accounts can only receive emails
        const accountCapabilities = {
            supportedDirections: ['POOL_TO_WARMUP'], // Only receiving
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
            organizational: true,
            dbValues: {
                startEmailsPerDay: account.startEmailsPerDay,
                increaseEmailsPerDay: account.increaseEmailsPerDay,
                maxEmailsPerDay: account.maxEmailsPerDay,
                calculatedLimit: receiveLimit
            }
        };

        // Only create inbound emails (Pool → Warmup)
        const inboundPools = this.getCompatiblePoolsForDirection(availablePools, 'POOL_TO_WARMUP');

        console.log(`   📊 Compatible pools for receiving: ${inboundPools.length}`);

        // Create inbound emails (Pool → Warmup)
        for (let i = 0; i < receiveLimit && i < inboundPools.length; i++) {
            const pool = inboundPools[i];
            const emailJob = this.createEmailJob(pool, account, 'POOL_TO_WARMUP', i, receiveLimit, 'inbound');
            plan.inbound.push(emailJob);
            plan.sequence.push(emailJob);
        }

        console.log(`   📧 Final sequence: ${plan.sequence.length} RECEIVE-ONLY emails`);
        console.log(`   💡 Admin consent required for sending: Use Azure Admin Consent URL`);

        if (account.email === 'jonathon.shults@elmstreetweb.com') {
            console.log(`   🔐 Application ID: 511cc857-4fb9-4738-b063-fdf68e2ef980`);
            console.log(`   🌐 Admin Consent URL: https://login.microsoftonline.com/common/adminconsent?client_id=511cc857-4fb9-4738-b063-fdf68e2ef980&redirect_uri=YOUR_REDIRECT_URI`);
        }

        return plan;
    }

    // NEW: Check if account is organizational
    isOrganizationalAccount(email) {
        const domain = email.split('@')[1];
        return this.ORGANIZATIONAL_DOMAINS.includes(domain);
    }

    getStrategyForDay(warmupDayCount, totalEmails) {
        let baseStrategy = { phase: 'INITIAL', outboundRatio: 0.33 }; // 1:2 ratio = 33% outbound

        // Base strategy based on warmup day
        if (warmupDayCount === 0) {
            baseStrategy = { phase: 'DAY_0', outboundRatio: 0.33 }; // 1 outbound : 2 inbound
        } else if (warmupDayCount === 1) {
            baseStrategy = { phase: 'DAY_1', outboundRatio: 0.4 }; // 2 outbound : 3 inbound
        } else if (warmupDayCount === 2) {
            baseStrategy = { phase: 'DAY_2', outboundRatio: 0.43 }; // 3 outbound : 4 inbound  
        } else if (warmupDayCount < 7) {
            baseStrategy = { phase: 'WEEK_1', outboundRatio: 0.45 }; // Nearly 1:1
        } else if (warmupDayCount < 14) {
            baseStrategy = { phase: 'WEEK_2', outboundRatio: 0.5 }; // 1:1 ratio
        } else {
            baseStrategy = { phase: 'MATURE', outboundRatio: 0.6 }; // More outbound
        }

        console.log(`   Final strategy: ${baseStrategy.phase} (${(baseStrategy.outboundRatio * 100).toFixed(0)}% outbound)`);
        return baseStrategy;
    }

    // Add this debug method to UnifiedWarmupStrategy
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
            console.log(`   📤 Creating ${outboundCount} outbound emails`);
            for (let i = 0; i < outboundCount && i < outboundPools.length; i++) {
                const pool = outboundPools[i];
                plan.outbound.push(this.createEmailJob(account, pool, 'WARMUP_TO_POOL', i, outboundCount, 'outbound'));
            }
        }

        // Create inbound emails (Pool → Warmup) - only if capability allows
        if (capabilities.supportedDirections.includes('POOL_TO_WARMUP') && inboundCount > 0) {
            console.log(`   📥 Creating ${inboundCount} inbound emails`);
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

    // In UnifiedWarmupStrategy.js - fix getCompatiblePoolsForDirection
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

                } else {
                    console.log(`   ❌ Incompatible pool: ${pool.email} cannot handle ${direction}`);
                    console.log(`      Available directions: ${poolCapabilities.supportedDirections.join(', ')}`);
                    console.log(`      Required direction: ${direction}`);
                }
            } catch (error) {
                console.log(`   ⚠️  Error checking pool ${pool.email} compatibility: ${error.message}`);
                continue;
            }
        }

        console.log(`   📋 Total compatible pools for ${direction}: ${compatiblePools.length}`);
        return compatiblePools;
    }

    // In UnifiedWarmupStrategy.js - make pool capability detection more robust
    getPoolCapabilities(poolConfig, direction) {
        const capabilities = {
            supportedDirections: []
        };

        // All pool accounts can receive emails (WARMUP_TO_POOL)
        capabilities.supportedDirections.push('WARMUP_TO_POOL');

        // Pool accounts can send (POOL_TO_WARMUP) if they have basic credentials
        // Check for any authentication method
        const hasCredentials =
            poolConfig.appPassword ||
            poolConfig.accessToken ||
            poolConfig.smtpPass ||
            poolConfig.smtpPassword ||
            (poolConfig.providerType && poolConfig.providerType === 'GMAIL');

        if (hasCredentials) {
            capabilities.supportedDirections.push('POOL_TO_WARMUP');

        } else {
            console.log(`      ⚠️  Pool ${poolConfig.email} cannot SEND - missing credentials`);
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

        // SPECIAL HANDLING: If receiver is organizational, ensure proper configuration
        if (this.isOrganizationalAccount(receiver.email) && direction === 'WARMUP_TO_POOL') {
            console.log(`   ⚠️  WARNING: Attempting to send TO organizational account ${receiver.email}`);
            console.log(`   💡 This may fail if organizational account has sending restrictions`);
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
            replyRate: replyRate,
            // Add organizational flags for better handling
            isOrganizationalSender: this.isOrganizationalAccount(sender.email),
            isOrganizationalReceiver: this.isOrganizationalAccount(receiver.email)
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