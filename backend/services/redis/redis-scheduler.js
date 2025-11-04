const redis = require('redis');

class RedisScheduler {
    constructor(redisUrl = 'redis://localhost:6379') {
        this.client = redis.createClient({
            url: redisUrl,
            socket: {
                reconnectStrategy: (retries) => {
                    console.log(`🔄 Redis reconnecting... attempt ${retries}`);
                    return Math.min(retries * 100, 5000);
                }
            }
        });

        this.client.on('error', (err) => console.error('❌ Redis Client Error:', err.message));
        this.client.on('connect', () => console.log('✅ Redis connected for scheduler persistence'));
        this.client.on('ready', () => console.log('🚀 Redis ready for operations'));
        this.client.on('end', () => console.log('🔴 Redis connection closed'));

        this.connect();
    }

    // FIXED: Use this.client instead of this.redis
    async getDailyVolume(key) {
        if (!this.client.isOpen) {
            console.log('⏩ Redis not connected, skipping getDailyVolume');
            return 0;
        }
        try {
            const volume = await this.client.get(`daily_volume:${key}`);
            return volume ? parseInt(volume, 10) : 0;
        } catch (error) {
            console.error('❌ Error getting daily volume:', error.message);
            return 0;
        }
    }

    async incrementDailyVolume(key, count = 1) {
        if (!this.client.isOpen) {
            console.log('⏩ Redis not connected, skipping incrementDailyVolume');
            return;
        }
        try {
            await this.client.incrBy(`daily_volume:${key}`, count);
        } catch (error) {
            console.error('❌ Error incrementing daily volume:', error.message);
        }
    }

    async clearVolumeKey(key) {
        if (!this.client.isOpen) {
            console.log('⏩ Redis not connected, skipping clearVolumeKey');
            return;
        }
        try {
            await this.client.del(`daily_volume:${key}`);
        } catch (error) {
            console.error('❌ Error clearing volume key:', error.message);
        }
    }

    async getAllVolumeKeys() {
        if (!this.client.isOpen) {
            console.log('⏩ Redis not connected, skipping getAllVolumeKeys');
            return [];
        }
        try {
            const keys = await this.client.keys('daily_volume:*');
            return keys;
        } catch (error) {
            console.error('❌ Error getting volume keys:', error.message);
            return [];
        }
    }

    async connect() {
        try {
            await this.client.connect();
        } catch (error) {
            console.error('❌ Failed to connect to Redis:', error.message);
            // Don't throw - let the scheduler work without Redis in fallback mode
        }
    }

    // Store incremental schedule for recovery
    async storeIncrementalSchedule(warmupEmail, schedule) {
        if (!this.client.isOpen) {
            console.log('⏩ Redis not connected, skipping storeIncrementalSchedule');
            return;
        }

        const key = `incremental:${warmupEmail}`;
        try {
            await this.client.setEx(key, 48 * 60 * 60, JSON.stringify(schedule)); // 48h TTL
            console.log(`💾 Stored incremental schedule for ${warmupEmail}`);
        } catch (error) {
            console.error('❌ Error storing incremental schedule:', error.message);
        }
    }

    // Get incremental schedule for recovery
    async getIncrementalSchedule(warmupEmail) {
        if (!this.client.isOpen) {
            console.log('⏩ Redis not connected, skipping getIncrementalSchedule');
            return null;
        }

        const key = `incremental:${warmupEmail}`;
        try {
            const schedule = await this.client.get(key);
            return schedule ? JSON.parse(schedule) : null;
        } catch (error) {
            console.error('❌ Error getting incremental schedule:', error.message);
            return null;
        }
    }

    // Store scheduled job for recovery
    async storeScheduledJob(jobKey, jobData) {
        if (!this.client.isOpen) {
            console.log('⏩ Redis not connected, skipping storeScheduledJob');
            return;
        }

        try {
            await this.client.hSet('scheduled_jobs', jobKey, JSON.stringify({
                ...jobData,
                storedAt: new Date().toISOString()
            }));
        } catch (error) {
            console.error('❌ Error storing scheduled job:', error.message);
        }
    }

    // Get all scheduled jobs for recovery
    async getAllScheduledJobs() {
        if (!this.client.isOpen) {
            console.log('⏩ Redis not connected, skipping getAllScheduledJobs');
            return {};
        }

        try {
            const jobs = await this.client.hGetAll('scheduled_jobs');
            const result = {};
            for (const [key, value] of Object.entries(jobs)) {
                result[key] = JSON.parse(value);
            }
            return result;
        } catch (error) {
            console.error('❌ Error getting scheduled jobs:', error.message);
            return {};
        }
    }

    // Remove job from Redis when executed
    async removeScheduledJob(jobKey) {
        if (!this.client.isOpen) {
            console.log('⏩ Redis not connected, skipping removeScheduledJob');
            return;
        }

        try {
            await this.client.hDel('scheduled_jobs', jobKey);
        } catch (error) {
            console.error('❌ Error removing scheduled job:', error.message);
        }
    }

    // Store pool usage for recovery
    async storePoolUsage(poolEmail, usageData) {
        if (!this.client.isOpen) {
            console.log('⏩ Redis not connected, skipping storePoolUsage');
            return;
        }

        const key = `pool_usage:${poolEmail}`;
        try {
            await this.client.setEx(key, 24 * 60 * 60, JSON.stringify({
                ...usageData,
                updatedAt: new Date().toISOString()
            }));
        } catch (error) {
            console.error('❌ Error storing pool usage:', error.message);
        }
    }

    // Get pool usage for recovery
    async getPoolUsage(poolEmail) {
        if (!this.client.isOpen) {
            console.log('⏩ Redis not connected, skipping getPoolUsage');
            return null;
        }

        const key = `pool_usage:${poolEmail}`;
        try {
            const usage = await this.client.get(key);
            return usage ? JSON.parse(usage) : null;
        } catch (error) {
            console.error('❌ Error getting pool usage:', error.message);
            return null;
        }
    }

    // Health check
    async healthCheck() {
        if (!this.client.isOpen) {
            return { status: 'disconnected', message: 'Redis client not connected' };
        }

        try {
            await this.client.ping();
            return { status: 'connected', message: 'Redis is healthy' };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }

    // Close connection gracefully
    async disconnect() {
        if (this.client.isOpen) {
            await this.client.quit();
        }
    }
}

module.exports = RedisScheduler;