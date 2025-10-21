require('dotenv').config();
const { sequelize } = require('../config/db');
const { IntelligentWarmupWorker } = require('./warmup');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Worker DB connection established');

        const worker = new IntelligentWarmupWorker();
        await worker.consumeWarmupJobs();

        console.log('🧠 Warmup Worker started and waiting for jobs...');
    } catch (err) {
        console.error('❌ Worker startup failed:', err);
        process.exit(1);
    }
})();
