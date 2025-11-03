// worker-runner.js
require('dotenv').config();
const { sequelize } = require('../config/db');
const WarmupWorker = require('./warmup');
const { BatchWarmupWorker } = require('./batch-worker');

(async () => {
    try {
        // Database connection
        await sequelize.authenticate();
        console.log('✅ Worker DB connection established');

        // Start regular warmup worker
        const warmupWorker = new WarmupWorker();
        warmupWorker.consumeWarmupJobs().catch(err => {
            console.error('❌ Warmup Worker Error:', err);
        });
        console.log('🧠 Warmup Consumer Worker started and waiting for jobs...');

        // Start batch warmup worker (if enabled)
        if (process.env.ENABLE_BATCH_WORKER === 'true') {
            const batchWorker = new BatchWarmupWorker();
            batchWorker.consumeBatchWarmupJobs().catch(err => {
                console.error('❌ Batch Worker Error:', err);
            });
            console.log('🏭 Batch Warmup Worker started and waiting for batch jobs...');
        } else {
            console.log('⏩ Batch Worker disabled (set ENABLE_BATCH_WORKER=true to enable)');
        }

        // Log worker configuration
        console.log('\n📊 Worker Configuration:');
        console.log(`   Regular Worker: ✅ Active`);
        console.log(`   Batch Worker: ${process.env.ENABLE_BATCH_WORKER === 'true' ? '✅ Active' : '❌ Disabled'}`);
        console.log(`   Batch Processing Limit: ${process.env.BATCH_PROCESSING_LIMIT || 50}`);
        console.log(`   Min Job Interval: ${process.env.MIN_JOB_INTERVAL || 180000}ms`);

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down workers gracefully...');
            process.exit(0);
        });

    } catch (err) {
        console.error('❌ Worker startup failed:', err);
        process.exit(1);
    }
})();