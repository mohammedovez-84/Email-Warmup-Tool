const VolumeEnforcement = require('./volume-enforcement');

class DailyResetService {
    constructor() {
        this.volumeEnforcement = new VolumeEnforcement();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        await this.volumeEnforcement.initialize();
        this.initialized = true;
        console.log('✅ DAILY RESET SERVICE READY');
    }

    async performDailyReset() {
        try {
            console.log('🔄 STARTING DAILY RESET PROCESS...');

            // Ensure service is initialized
            await this.initialize();

            // Reset volume enforcement
            await this.volumeEnforcement.resetForNewDay();

            // Reset warmup day counts in database
            await this.incrementWarmupDayCounts();

            // Reset pool account usage
            await this.resetPoolAccountUsage();

            console.log('✅ DAILY RESET COMPLETED SUCCESSFULLY');

        } catch (error) {
            console.error('❌ DAILY RESET ERROR:', error);
            throw error;
        }
    }

    async incrementWarmupDayCounts() {
        try {
            const { Op } = require('sequelize');
            const GoogleUser = require('../../models/GoogleUser');
            const MicrosoftUser = require('../../models/MicrosoftUser');
            const SmtpAccount = require('../../models/smtpAccounts');

            // Increment day count for all active warmup accounts
            await GoogleUser.update(
                { warmupDayCount: require('sequelize').literal('COALESCE(warmupDayCount, 0) + 1') },
                { where: { active: true } }
            );

            await MicrosoftUser.update(
                { warmupDayCount: require('sequelize').literal('COALESCE(warmupDayCount, 0) + 1') },
                { where: { active: true } }
            );

            await SmtpAccount.update(
                { warmupDayCount: require('sequelize').literal('COALESCE(warmupDayCount, 0) + 1') },
                { where: { active: true } }
            );

            console.log('📈 INCREMENTED WARMUP DAY COUNTS');

        } catch (error) {
            console.error('❌ Error incrementing warmup day counts:', error);
        }
    }

    async resetPoolAccountUsage() {
        try {
            const EmailPool = require('../../models/EmailPool');

            // Reset daily usage for all pool accounts
            await EmailPool.update(
                {
                    dailyUsage: 0,
                    lastReset: new Date()
                },
                { where: {} }
            );

            console.log('🔄 RESET POOL ACCOUNT USAGE');

        } catch (error) {
            console.error('❌ Error resetting pool account usage:', error);
        }
    }

    // Get reset status
    async getResetStatus() {
        return {
            volumeEnforcementInitialized: this.initialized,
            dailyCountsSize: this.volumeEnforcement.dailyCounts?.size || 0,
            blockedAccountsSize: this.volumeEnforcement.blockedAccounts?.size || 0
        };
    }
}

// 🚨 IMPORTANT: Export a singleton instance
module.exports = new DailyResetService();