require('dotenv').config();
const { sequelize } = require('../config/db');
const { WarmupWorker } = require('./warmup');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Worker DB connection established');

        const worker = new WarmupWorker();
        await worker.consumeWarmupJobs();

        console.log('🧠 Warmup Consumer Worker started and waiting for jobs...');
    } catch (err) {
        console.error('❌ Worker startup failed:', err);
        process.exit(1);
    }
})();
