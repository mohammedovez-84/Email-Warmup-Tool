const RedisScheduler = require('./redis-scheduler');
const UnifiedWarmupStrategy = require('./unified-strategy');
class BatchWarmupScheduler {
    constructor() {
        this.isRunning = false;
        this.batchSize = parseInt(process.env.BATCH_SIZE) || 100;
        this.batchInterval = parseInt(process.env.BATCH_INTERVAL) || 60000; // 1 minute
        this.redis = new RedisScheduler();
    }


    async processSingleAccount(account) {
        try {
            const availablePools = await this.getCachedAvailablePools();

            if (availablePools.length === 0) {
                console.log(`⏩ No pools available for ${account.email}`);
                return;
            }

            // USE UNIFIED STRATEGY
            const strategy = new UnifiedWarmupStrategy();
            const warmupPlan = await strategy.generateWarmupPlan(account, availablePools);

            // Store batch job
            await this.createBatchWarmupJob(account, warmupPlan);

        } catch (error) {
            console.error(`❌ Error processing account ${account.email}:`, error.message);
        }
    }

    async createBatchWarmupJob(account, warmupPlan) {
        const jobKey = `batch_warmup:${account.id}:${Date.now()}`;

        await this.redis.storeScheduledJob(jobKey, {
            type: 'batch_warmup',
            account: account,
            plan: warmupPlan,
            batchId: this.getCurrentBatchId(),
            scheduledAt: new Date().toISOString(),
            dbValues: warmupPlan.dbValues // Include DB values for tracking
        });

        // Add to sorted set for time-based execution
        await this.redis.client.zAdd(
            'batch_warmup_queue',
            { score: Date.now(), value: jobKey }
        );

        console.log(`💾 Stored batch job for ${account.email} (Day ${warmupPlan.warmupDay}, ${warmupPlan.totalEmails} emails)`);
    }
    async startBatchScheduling() {
        if (this.isRunning) {
            console.log('🔄 Batch scheduler already running...');
            return;
        }

        this.isRunning = true;
        console.log(`🏭 Starting BATCH scheduling (${this.batchSize} accounts/batch)`);

        while (this.isRunning) {
            try {
                await this.processBatch();
                await this.delay(this.batchInterval);
            } catch (error) {
                console.error('❌ Batch scheduling error:', error);
                await this.delay(30000);
            }
        }
    }

    async processBatch() {
        const batchStartTime = Date.now();

        // Get next batch of accounts using cursor
        const accountsBatch = await this.getAccountsBatch();

        if (accountsBatch.length === 0) {
            console.log('📭 No accounts to process in this batch');
            return;
        }

        console.log(`🏭 Processing batch: ${accountsBatch.length} accounts`);

        // Process accounts in parallel with concurrency control
        const BATCH_CONCURRENCY = 10;
        for (let i = 0; i < accountsBatch.length; i += BATCH_CONCURRENCY) {
            const chunk = accountsBatch.slice(i, i + BATCH_CONCURRENCY);

            const chunkPromises = chunk.map(account =>
                this.processSingleAccount(account)
            );

            await Promise.allSettled(chunkPromises);
            console.log(`✅ Processed chunk ${i / BATCH_CONCURRENCY + 1}`);
        }

        // Update batch cursor
        await this.updateBatchCursor(accountsBatch[accountsBatch.length - 1].id);

        const batchDuration = Date.now() - batchStartTime;
        console.log(`📊 Batch completed: ${accountsBatch.length} accounts in ${batchDuration}ms`);
    }

    async getAccountsBatch() {
        const lastProcessedId = await this.redis.get('batch_cursor') || 0;

        // Get active accounts in batches
        const [googleAccounts, smtpAccounts, microsoftAccounts] = await Promise.all([
            this.getAccountsBatchByType('google', lastProcessedId),
            this.getAccountsBatchByType('smtp', lastProcessedId),
            this.getAccountsBatchByType('microsoft', lastProcessedId)
        ]);

        const allAccounts = [...googleAccounts, ...smtpAccounts, ...microsoftAccounts]
            .sort((a, b) => a.id - b.id)
            .slice(0, this.batchSize);

        return allAccounts;
    }

    async getAccountsBatchByType(type, lastId) {
        let model;
        switch (type) {
            case 'google':
                model = GoogleUser;
                break;
            case 'smtp':
                model = SmtpAccount;
                break;
            case 'microsoft':
                model = MicrosoftUser;
                break;
            default:
                return [];
        }

        return await model.findAll({
            where: {
                id: { [Op.gt]: lastId },
                warmupStatus: 'active',
                is_connected: true
            },
            limit: Math.ceil(this.batchSize / 3), // Distribute across types
            order: [['id', 'ASC']],
            raw: true
        });
    }

    async processSingleAccount(account) {
        try {
            // Get pools once per batch instead of per account
            const availablePools = await this.getCachedAvailablePools();

            if (availablePools.length === 0) {
                console.log(`⏩ No pools available for ${account.email}`);
                return;
            }

            const sendLimit = await this.computeEmailsToSend(account);
            const warmupPlan = this.createWarmupPlan(account, availablePools, sendLimit);

            // Store batch job instead of individual timeouts
            await this.createBatchWarmupJob(account, warmupPlan);

        } catch (error) {
            console.error(`❌ Error processing account ${account.email}:`, error.message);
        }
    }

    async getCachedAvailablePools() {
        // Cache pools for the entire batch to avoid repeated DB queries
        const cacheKey = 'available_pools_cache';
        const cached = await this.redis.get(cacheKey);

        if (cached) {
            return JSON.parse(cached);
        }

        const pools = await EmailPool.findAll({
            where: { isActive: true },
            raw: true
        });

        // Cache for 5 minutes
        await this.redis.setEx(cacheKey, 300, JSON.stringify(pools));
        return pools;
    }

    createWarmupPlan(account, availablePools, sendLimit) {
        const plan = {
            accountId: account.id,
            email: account.email,
            accountType: this.getAccountType(account),
            sendLimit: sendLimit,
            scheduledFor: Date.now(),
            emails: []
        };

        // Distribute across available pools
        for (let i = 0; i < Math.min(sendLimit, availablePools.length); i++) {
            const pool = availablePools[i % availablePools.length];
            plan.emails.push({
                poolEmail: pool.email,
                poolType: pool.providerType,
                delay: i * 30 * 60 * 1000, // 30 minutes between emails
                replyRate: 0.15
            });
        }

        return plan;
    }

    async createBatchWarmupJob(account, warmupPlan) {
        const jobKey = `batch_warmup:${account.id}:${Date.now()}`;

        await this.redis.storeScheduledJob(jobKey, {
            type: 'batch_warmup',
            account: account,
            plan: warmupPlan,
            batchId: this.getCurrentBatchId(),
            scheduledAt: new Date().toISOString()
        });

        // Also add to a sorted set for time-based execution
        await this.redis.client.zAdd(
            'batch_warmup_queue',
            { score: Date.now(), value: jobKey }
        );
    }

    async updateBatchCursor(lastProcessedId) {
        await this.redis.set('batch_cursor', lastProcessedId);

        // Reset cursor if we've processed all accounts
        const remainingAccounts = await this.getRemainingAccountCount(lastProcessedId);
        if (remainingAccounts === 0) {
            await this.redis.set('batch_cursor', 0);
            console.log('🔄 Batch cursor reset - completed full cycle');
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    stopBatchScheduling() {
        this.isRunning = false;
        console.log('🛑 Batch scheduling stopped');
    }
}

module.exports = BatchWarmupScheduler;