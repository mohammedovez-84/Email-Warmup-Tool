const getChannel = require('../queues/rabbitConnection');

async function purgeWarmupQueue() {
    const channel = await getChannel();
    await channel.assertQueue('warmup_jobs', { durable: true });
    await channel.purgeQueue('warmup_jobs');
    console.log('warmup_jobs queue purged');
    await channel.close();
    process.exit(0);
}

purgeWarmupQueue().catch(console.error);
