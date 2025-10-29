const GoogleUser = require("../models/GoogleUser");
const MicrosoftUser = require("../models/MicrosoftUser");
const SmtpAccount = require("../models/smtpAccounts");
const BatchWarmupScheduler = require("./batch-scheduler");
const { WarmupScheduler } = require("./Scheduler");

class HybridWarmupScheduler {
    constructor() {
        this.batchScheduler = new BatchWarmupScheduler();
        this.incrementalScheduler = new WarmupScheduler()

        this.mode = process.env.SCHEDULER_MODE || 'hybrid'; // hybrid, batch, or incremental
        this.scaleThreshold = parseInt(process.env.SCALE_THRESHOLD) || 200;
        this.isRunning = false;

        console.log('🚀 Hybrid Warmup Scheduler Initialized');
        console.log(`   Mode: ${this.mode}`);
        console.log(`   Scale Threshold: ${this.scaleThreshold} accounts`);
        console.log(`   Batch Size: ${process.env.BATCH_SIZE || 100}`);
        console.log(`   Batch Interval: ${process.env.BATCH_INTERVAL || 60000}ms`);
    }

    async startHybridScheduling() {
        if (this.isRunning) {
            console.log('🔄 Hybrid scheduler already running...');
            return;
        }

        this.isRunning = true;

        try {
            console.log('\n🎯 Starting HYBRID Warmup Scheduling...');
            console.log('📊 Checking account scale...');

            const accountCount = await this.getActiveAccountCount();
            const [google, smtp, microsoft] = await this.getDetailedAccountCounts();

            console.log('📈 Active Account Breakdown:');
            console.log(`   Google: ${google}, SMTP: ${smtp}, Microsoft: ${microsoft}`);
            console.log(`   TOTAL: ${accountCount} active warmup accounts`);

            // Force mode if specified in env
            const forcedMode = process.env.SCHEDULER_MODE;
            if (forcedMode && ['batch', 'incremental'].includes(forcedMode)) {
                console.log(`⚡ FORCED MODE: Using ${forcedMode.toUpperCase()} mode (from env)`);
                await this.startForcedMode(forcedMode, accountCount);
                return;
            }

            // Auto-detect mode based on scale
            if (accountCount > this.scaleThreshold) {
                console.log(`🏭 SCALE DETECTED: ${accountCount} accounts > ${this.scaleThreshold} threshold`);
                console.log('🚀 Switching to BATCH mode for optimal performance...');
                await this.startBatchMode();
            } else {
                console.log(`🎯 OPTIMAL SCALE: ${accountCount} accounts ≤ ${this.scaleThreshold} threshold`);
                console.log('🚀 Using INCREMENTAL mode for precise scheduling...');
                await this.startIncrementalMode();
            }

        } catch (error) {
            console.error('❌ Hybrid scheduling error:', error);
            this.isRunning = false;
            throw error;
        }
    }

    async startForcedMode(mode, accountCount) {
        if (mode === 'batch') {
            console.log(`🔧 Starting BATCH mode (forced)`);
            await this.startBatchMode();
        } else if (mode === 'incremental') {
            console.log(`🔧 Starting INCREMENTAL mode (forced)`);
            await this.startIncrementalMode();
        }
    }

    async startBatchMode() {
        try {
            console.log('\n🏭 ===== BATCH MODE ACTIVATED =====');
            console.log('📦 Processing accounts in optimized batches...');

            this.mode = 'batch';
            await this.batchScheduler.startBatchScheduling();

        } catch (error) {
            console.error('❌ Batch mode startup failed:', error);
            throw error;
        }
    }

    async startIncrementalMode() {
        try {
            console.log('\n🎯 ===== INCREMENTAL MODE ACTIVATED =====');
            console.log('⏱️  Processing accounts with precise timing...');

            this.mode = 'incremental';
            await this.incrementalScheduler.scheduleWarmup();

        } catch (error) {
            console.error('❌ Incremental mode startup failed:', error);
            throw error;
        }
    }

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

    async getDetailedAccountCounts() {
        try {
            const [google, smtp, microsoft] = await Promise.all([
                GoogleUser.count({ where: { warmupStatus: 'active', is_connected: true } }),
                SmtpAccount.count({ where: { warmupStatus: 'active', is_connected: true } }),
                MicrosoftUser.count({ where: { warmupStatus: 'active', is_connected: true } })
            ]);

            return [google, smtp, microsoft];
        } catch (error) {
            console.error('❌ Error getting detailed account counts:', error);
            return [0, 0, 0];
        }
    }

    async getSchedulerStatus() {
        const accountCount = await this.getActiveAccountCount();
        const [google, smtp, microsoft] = await this.getDetailedAccountCounts();

        return {
            mode: this.mode,
            isRunning: this.isRunning,
            accountCount: accountCount,
            accountBreakdown: {
                google: google,
                smtp: smtp,
                microsoft: microsoft
            },
            scaleThreshold: this.scaleThreshold,
            usingOptimalMode: accountCount > this.scaleThreshold ? 'batch' : 'incremental'
        };
    }

    stopScheduling() {
        this.isRunning = false;

        if (this.mode === 'batch') {
            this.batchScheduler.stopBatchScheduling();
        } else {
            this.incrementalScheduler.stopScheduler();
        }

        console.log('🛑 Hybrid scheduling stopped');
    }

    async triggerImmediateScheduling() {
        try {
            console.log('🚀 TRIGGER: Immediate hybrid scheduling requested...');

            if (this.isRunning) {
                console.log('🔄 Scheduler already running, stopping current cycle...');
                this.stopScheduling();
                await this.delay(2000); // Wait 2 seconds for clean shutdown
            }

            await this.startHybridScheduling();
            console.log('✅ TRIGGER: Immediate hybrid scheduling completed successfully');

        } catch (error) {
            console.error('❌ TRIGGER: Immediate hybrid scheduling failed:', error);
            throw error;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


}

// Create singleton instance
const hybridSchedulerInstance = new HybridWarmupScheduler();

// Export for use in main file
module.exports = {
    HybridWarmupScheduler,
    startHybridScheduling: () => hybridSchedulerInstance.startHybridScheduling(),
    stopHybridScheduling: () => hybridSchedulerInstance.stopScheduling(),
    triggerImmediateScheduling: () => hybridSchedulerInstance.triggerImmediateScheduling(),
    getSchedulerStatus: () => hybridSchedulerInstance.getSchedulerStatus(),
    hybridSchedulerInstance
};