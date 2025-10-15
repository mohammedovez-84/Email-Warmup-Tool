
const getChannel = require('./rabbitConnection');

const QUEUE_NAME = 'warmup_jobs';

async function publishWarmupJob(payload) {
    const channel = await getChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(payload)), { persistent: true });
}

async function consumeWarmupJobs(callback) {
    const channel = await getChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    channel.consume(QUEUE_NAME, async (msg) => {
        if (msg !== null) {
            const job = JSON.parse(msg.content.toString());

            try {
                await callback(job);
                channel.ack(msg);
            } catch (err) {
                console.error('Job failed:', err);
                channel.nack(msg);
            }
        }
    });
}

module.exports = {
    publishWarmupJob,
    consumeWarmupJobs,
    QUEUE_NAME
};

