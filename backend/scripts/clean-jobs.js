const getChannel = require('../queues/rabbitConnection');
const RedisScheduler = require('../services/redis-scheduler');

async function cleanupInvalidJobs() {
    console.log('🚨 EMERGENCY QUEUE CLEANUP STARTED...');

    const channel = await getChannel();
    const redis = new RedisScheduler();

    let purgedCount = 0;
    let processedCount = 0;

    // Clean RabbitMQ queue
    try {
        const queueInfo = await channel.assertQueue('warmup_jobs', { durable: true });
        console.log(`📊 Queue has ${queueInfo.messageCount} messages`);

        // Purge all messages
        await channel.purgeQueue('warmup_jobs');
        console.log(`🗑️ Purged ${queueInfo.messageCount} messages from RabbitMQ`);
        purgedCount = queueInfo.messageCount;
    } catch (error) {
        console.error('❌ Error cleaning RabbitMQ:', error.message);
    }

    // Clean Redis scheduled jobs
    try {
        const scheduledJobs = await redis.getAllScheduledJobs();
        console.log(`📊 Redis has ${Object.keys(scheduledJobs).length} scheduled jobs`);

        for (const jobKey of Object.keys(scheduledJobs)) {
            await redis.removeScheduledJob(jobKey);
            processedCount++;
        }
        console.log(`🗑️ Removed ${processedCount} jobs from Redis`);
    } catch (error) {
        console.error('❌ Error cleaning Redis:', error.message);
    }

    console.log('✅ QUEUE CLEANUP COMPLETED!');
    console.log(`📊 Results:`);
    console.log(`   - RabbitMQ: ${purgedCount} messages purged`);
    console.log(`   - Redis: ${processedCount} jobs removed`);

    process.exit(0);
}

cleanupInvalidJobs().catch(console.error);