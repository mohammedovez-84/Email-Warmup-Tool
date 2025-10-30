require('dotenv').config();
const getChannel = require('../queues/rabbitConnection');
const RedisScheduler = require('../services/redis-scheduler');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');

class BatchWarmupWorker {
    constructor() {
        this.processing = false;
        this.batchSize = parseInt(process.env.BATCH_PROCESSING_LIMIT) || 50;
        this.redis = new RedisScheduler();
        this.workerId = `batch-worker-${process.pid}-${Date.now()}`;
        this.shouldRun = false; // NEW: Control flag for the loop
        this.checkInterval = 30000; // NEW: Check every 30 seconds instead of constant checking
        this.lastJobCheck = 0; // NEW: Track last check time

        console.log(`🏭 Batch Worker ${this.workerId} Initialized`);
        console.log(`   Batch Processing Limit: ${this.batchSize} jobs`);
        console.log(`   Check Interval: ${this.checkInterval / 1000} seconds`);
    }

    async consumeBatchWarmupJobs() {
        // CHECK IF BATCH PROCESSING IS ACTUALLY ENABLED
        if (!await this.shouldProcessBatchJobs()) {
            console.log('⏩ Batch worker not started (batch mode not enabled or no jobs)');
            return;
        }

        const channel = await getChannel();

        console.log(`🏭 Starting BATCH Warmup Worker: ${this.workerId}`);
        console.log('📋 Waiting for batch warmup jobs...');

        this.shouldRun = true; // NEW: Set control flag

        while (this.shouldRun) {
            try {
                // ADD LONGER DELAY BETWEEN CHECKS
                await this.delay(this.checkInterval);

                if (this.processing) {
                    console.log('⏳ Batch worker busy, waiting...');
                    continue;
                }

                this.processing = true;

                // CHECK IF THERE ARE ACTUALLY ANY JOBS
                const jobCount = await this.getBatchJobCount();
                if (jobCount === 0) {
                    console.log('📭 No batch jobs in queue, skipping processing');
                    this.processing = false;
                    continue; // Skip processing if no jobs
                }

                await this.processBatchJobs(channel);
                this.processing = false;

            } catch (error) {
                console.error('❌ Batch worker error:', error);
                this.processing = false;
                await this.delay(30000);
            }
        }

        console.log('🛑 Batch worker stopped gracefully');
    }

    // NEW: Check if batch processing should actually run
    async shouldProcessBatchJobs() {
        try {
            // Check if batch mode is enabled
            if (process.env.SCHEDULER_MODE !== 'batch' && process.env.SCHEDULER_MODE !== 'hybrid') {
                console.log('⏩ Batch worker: SCHEDULER_MODE not set to batch or hybrid');
                return false;
            }

            // Check if Redis is connected
            if (!this.redis.client.isOpen) {
                console.log('⏩ Batch worker: Redis not connected');
                return false;
            }

            // Check if there are any batch jobs in queue
            const jobCount = await this.getBatchJobCount();
            if (jobCount === 0) {
                console.log('⏩ Batch worker: No jobs in queue');
                return false;
            }

            // Check if there are active accounts that need batch processing
            const activeAccountCount = await this.getActiveAccountCount();
            const scaleThreshold = parseInt(process.env.SCALE_THRESHOLD) || 200;

            if (activeAccountCount <= scaleThreshold) {
                console.log(`⏩ Batch worker: Account count ${activeAccountCount} below threshold ${scaleThreshold}`);
                return false;
            }

            console.log(`📊 Batch processing required: ${jobCount} jobs, ${activeAccountCount} accounts`);
            return true;

        } catch (error) {
            console.error('❌ Error checking batch processing requirement:', error);
            return false;
        }
    }

    // NEW: Get batch job count
    async getBatchJobCount() {
        if (!this.redis.client.isOpen) {
            return 0;
        }

        try {
            return await this.redis.client.zCard('batch_warmup_queue');
        } catch (error) {
            console.error('❌ Error getting batch job count:', error);
            return 0;
        }
    }

    // NEW: Get active account count
    async getActiveAccountCount() {
        try {
            const [google, smtp, microsoft] = await Promise.all([
                GoogleUser.count({ where: { warmupStatus: 'active', is_connected: true } }),
                SmtpAccount.count({ where: { warmupStatus: 'active', is_connected: true } }),
                MicrosoftUser.count({ where: { warmupStatus: 'active', is_connected: true } })
            ]);

            return google + smtp + microsoft;
        } catch (error) {
            console.error('❌ Error counting active accounts:', error);
            return 0;
        }
    }

    async getBatchJobs(limit) {
        if (!this.redis.client.isOpen) {
            console.log('⏩ Redis not connected, skipping getBatchJobs');
            return [];
        }

        try {
            const now = Date.now();
            const jobKeys = await this.redis.client.zRangeByScore(
                'batch_warmup_queue',
                0,
                now,
                { LIMIT: { offset: 0, count: limit } }
            );

            // NEW: Only log if we actually found jobs
            if (jobKeys.length > 0) {
                console.log(`📦 Retrieved ${jobKeys.length} batch jobs from queue`);
            }

            const jobs = [];
            for (const jobKey of jobKeys) {
                const jobData = await this.redis.client.get(`scheduled_jobs:${jobKey}`);
                if (jobData) {
                    jobs.push({
                        key: jobKey,
                        data: JSON.parse(jobData)
                    });
                } else {
                    // Clean up orphaned job key
                    await this.redis.client.zRem('batch_warmup_queue', jobKey);
                }
            }

            return jobs;

        } catch (error) {
            console.error('❌ Error getting batch jobs:', error);
            return [];
        }
    }

    async processBatchJobs(channel) {
        console.log('🔍 Checking for batch jobs...');

        const batchJobs = await this.getBatchJobs(this.batchSize);

        if (batchJobs.length === 0) {
            console.log('📭 No batch jobs available');
            return; // EARLY RETURN - no infinite logging
        }

        console.log(`🏭 Processing ${batchJobs.length} batch jobs`);

        const startTime = Date.now();
        let successfulJobs = 0;
        let failedJobs = 0;

        const processingPromises = batchJobs.map(job =>
            this.processBatchJob(job, channel)
                .then(() => successfulJobs++)
                .catch(() => failedJobs++)
        );

        await Promise.allSettled(processingPromises);

        const duration = Date.now() - startTime;
        console.log(`📊 Batch Processing Complete:`);
        console.log(`   ✅ Successful: ${successfulJobs}`);
        console.log(`   ❌ Failed: ${failedJobs}`);
        console.log(`   ⏱️  Duration: ${duration}ms`);
        console.log(`   📈 Rate: ${(batchJobs.length / (duration / 1000)).toFixed(2)} jobs/sec`);
    }

    async processBatchJob(job, channel) {
        const { key, data } = job;
        const { account, plan } = data;

        try {
            console.log(`\n🏭 Processing batch for: ${account.email}`);
            console.log(`   📧 Emails to schedule: ${plan.emails.length}`);
            console.log(`   🎯 Send Limit: ${plan.sendLimit}`);

            // VALIDATE ACCOUNT EXISTS AND IS ACTIVE
            const activeAccount = await this.validateAccountActive(account);
            if (!activeAccount) {
                console.log(`   ⏩ Skipping: Account ${account.email} is no longer active`);
                await this.cleanupJob(key);
                return;
            }

            let scheduledEmails = 0;

            for (const emailPlan of plan.emails) {
                // VALIDATE POOL ACCOUNT EXISTS AND HAS CAPACITY
                const poolValid = await this.validatePoolAccount(emailPlan.poolEmail);
                if (!poolValid) {
                    console.log(`   ⏩ Skipping pool: ${emailPlan.poolEmail} is invalid`);
                    continue;
                }

                await this.createIndividualJob(activeAccount, emailPlan, channel);
                scheduledEmails++;
            }

            // Remove from batch queue after successful processing
            await this.cleanupJob(key);

            console.log(`   ✅ Batch completed: ${scheduledEmails} emails scheduled`);

        } catch (error) {
            console.error(`   ❌ Batch job failed for ${account.email}:`, error.message);

            // Reschedule with backoff
            await this.rescheduleBatchJob(key, data);
            throw error;
        }
    }

    // Validate that the warmup account is still active
    async validateAccountActive(account) {
        try {
            let activeAccount = null;

            // Check all account types to see if the account still exists and is active
            activeAccount = await GoogleUser.findOne({
                where: {
                    email: account.email,
                    warmupStatus: 'active',
                    is_connected: true
                }
            });

            if (!activeAccount) {
                activeAccount = await MicrosoftUser.findOne({
                    where: {
                        email: account.email,
                        warmupStatus: 'active',
                        is_connected: true
                    }
                });
            }

            if (!activeAccount) {
                activeAccount = await SmtpAccount.findOne({
                    where: {
                        email: account.email,
                        warmupStatus: 'active',
                        is_connected: true
                    }
                });
            }

            return activeAccount ? activeAccount.get({ plain: true }) : null;
        } catch (error) {
            console.error(`❌ Error validating account ${account.email}:`, error);
            return null;
        }
    }

    // Validate pool account exists and has capacity
    async validatePoolAccount(poolEmail) {
        try {
            // This would check if the pool account exists and has sending capacity
            // For now, we'll assume it's valid since pool validation happens in scheduler
            return true;
        } catch (error) {
            console.error(`❌ Error validating pool account ${poolEmail}:`, error);
            return false;
        }
    }

    // Clean up job from Redis
    async cleanupJob(key) {
        try {
            await this.redis.client.zRem('batch_warmup_queue', key);
            await this.redis.client.del(`scheduled_jobs:${key}`);
        } catch (error) {
            console.error(`❌ Error cleaning up job ${key}:`, error);
        }
    }

    async createIndividualJob(account, emailPlan, channel) {
        const accountType = this.getAccountType(account);

        const job = {
            timeSlot: new Date(Date.now() + emailPlan.delay).toISOString(),
            pairs: [{
                senderEmail: emailPlan.poolEmail,
                senderType: 'pool',
                receiverEmail: account.email,
                receiverType: accountType,
                direction: 'POOL_TO_WARMUP',
                replyRate: emailPlan.replyRate,
                scheduleDelay: emailPlan.delay,
                batchProcessed: true,
                accountData: account // Include full account data for the worker
            }],
            coordinated: true,
            individualSchedule: true,
            batchProcessed: true,
            batchWorkerId: this.workerId,
            accountType: accountType
        };

        await channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(job)), {
            persistent: true,
            priority: 3 // Lower priority for batch jobs
        });

        console.log(`      📨 Scheduled: ${emailPlan.poolEmail} → ${account.email} (${accountType}, delay: ${Math.round(emailPlan.delay / 60000)}min)`);
    }

    async rescheduleBatchJob(key, data) {
        const retryCount = data.retryCount || 0;

        if (retryCount >= 3) {
            console.log(`   🗑️  Max retries exceeded, removing batch job: ${key}`);
            await this.cleanupJob(key);
            return;
        }

        // Exponential backoff
        const backoffDelay = Math.min(300000, 60000 * Math.pow(2, retryCount)); // Max 5 minutes
        const newScore = Date.now() + backoffDelay;

        data.retryCount = retryCount + 1;
        await this.redis.client.zAdd('batch_warmup_queue', { score: newScore, value: key });
        await this.redis.storeScheduledJob(key, data);

        console.log(`   🔄 Rescheduled batch job (retry ${retryCount + 1}) in ${backackoffDelay / 1000}s`);
    }

    // ENHANCED: Proper account type detection using imported models
    getAccountType(account) {
        // Check based on model-specific fields
        if (account.access_token || account.refresh_token || account.provider === 'google') {
            return 'google';
        }
        if (account.microsoft_access_token || account.microsoft_refresh_token || account.provider === 'microsoft') {
            return 'microsoft';
        }
        if (account.smtp_host || account.smtp_port || account.provider === 'smtp') {
            return 'smtp';
        }

        console.warn(`⚠️  Unknown account type for: ${account.email}`);
        return 'unknown';
    }

    // Get account details from database
    async getAccountDetails(email, accountType) {
        try {
            let account = null;

            switch (accountType) {
                case 'google':
                    account = await GoogleUser.findOne({ where: { email } });
                    break;
                case 'microsoft':
                    account = await MicrosoftUser.findOne({ where: { email } });
                    break;
                case 'smtp':
                    account = await SmtpAccount.findOne({ where: { email } });
                    break;
                default:
                    // Try all models
                    account = await GoogleUser.findOne({ where: { email } }) ||
                        await MicrosoftUser.findOne({ where: { email } }) ||
                        await SmtpAccount.findOne({ where: { email } });
            }

            return account ? account.get({ plain: true }) : null;
        } catch (error) {
            console.error(`❌ Error getting account details for ${email}:`, error);
            return null;
        }
    }

    // NEW: Stop the batch worker gracefully
    async stop() {
        console.log('🛑 Stopping batch worker...');
        this.shouldRun = false;
        this.processing = false;

        // Wait for current processing to complete
        await this.delay(2000);

        await this.cleanup();
    }

    // NEW: Check if worker is running
    isRunning() {
        return this.shouldRun;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Health check method
    async healthCheck() {
        const redisConnected = this.redis.client.isOpen;
        let queueSize = 0;

        if (redisConnected) {
            try {
                queueSize = await this.redis.client.zCard('batch_warmup_queue');
            } catch (error) {
                console.error('❌ Error checking queue size:', error);
            }
        }

        return {
            workerId: this.workerId,
            processing: this.processing,
            batchSize: this.batchSize,
            redisConnected: redisConnected,
            queueSize: queueSize,
            status: this.processing ? 'processing' : 'waiting',
            shouldRun: this.shouldRun,
            checkInterval: this.checkInterval
        };
    }

    // Cleanup method
    async cleanup() {
        this.processing = false;
        this.shouldRun = false;
        if (this.redis.client.isOpen) {
            await this.redis.disconnect();
        }
    }
}

module.exports = { BatchWarmupWorker };