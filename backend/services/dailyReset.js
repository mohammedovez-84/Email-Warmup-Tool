// services/dailyResetService.js
const VolumeEnforcement = require('./volume-enforcement');

class DailyResetService {
    constructor() {
        this.lastResetDate = null;
    }

    async performDailyReset() {
        try {
            const today = new Date().toDateString();

            // Check if we already reset today
            if (this.lastResetDate === today) {
                console.log('✅ Daily reset already performed today');
                return;
            }

            console.log('🔄 PERFORMING DAILY RESET - INCREMENTING WARMUP DAYS...');


            await VolumeEnforcement.resetForNewDay();

            this.lastResetDate = today;
            console.log('✅ DAILY RESET COMPLETE - All warmup days incremented');

        } catch (error) {
            console.error('❌ Daily reset error:', error);
        }
    }

    // Check if reset is needed (for cron job)
    async checkAndResetIfNeeded() {
        const today = new Date().toDateString();
        if (this.lastResetDate !== today) {
            await this.performDailyReset();
        }
    }
}

const dailyResetService = new DailyResetService();
module.exports = dailyResetService;