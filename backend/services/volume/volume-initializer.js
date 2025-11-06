// services/volumeInitializer.js
const GoogleUser = require('../../models/GoogleUser');
const MicrosoftUser = require('../../models/MicrosoftUser');
const SmtpAccount = require('../../models/smtpAccounts');
const EmailPool = require('../../models/EmailPool');
const { sequelize } = require('../../config/db');

class VolumeInitializer {
    constructor() {
        this.initialized = false;
        this.maxRetries = 5;
        this.retryDelay = 3000; // 3 seconds
    }

    async initializeAllAccounts() {
        try {
            console.log('🚀 INITIALIZING VOLUME ENFORCEMENT FOR ALL ACCOUNTS...');

            // 🚨 CRITICAL: Wait for tables to be created first
            await this.waitForTables();

            // Initialize Google accounts
            const googleAccounts = await GoogleUser.findAll({
                where: { warmupStatus: 'active' }
            });

            for (const account of googleAccounts) {
                await this.initializeAccount(account, 'google');
            }

            // Initialize Microsoft accounts
            const microsoftAccounts = await MicrosoftUser.findAll({
                where: { warmupStatus: 'active' }
            });

            for (const account of microsoftAccounts) {
                await this.initializeAccount(account, 'microsoft');
            }

            // Initialize SMTP accounts
            const smtpAccounts = await SmtpAccount.findAll({
                where: { warmupStatus: 'active' }
            });

            for (const account of smtpAccounts) {
                await this.initializeAccount(account, 'smtp');
            }

            // Initialize Pool accounts
            const poolAccounts = await EmailPool.findAll({
                where: { isActive: true }
            });

            for (const account of poolAccounts) {
                await this.initializePoolAccount(account);
            }

            this.initialized = true;
            console.log('✅ VOLUME INITIALIZATION COMPLETED SUCCESSFULLY');

        } catch (error) {
            console.error('❌ VOLUME INITIALIZATION ERROR:', error);
            throw error; // Re-throw to handle in calling code
        }
    }

    // 🚨 NEW: Wait for tables to be created
    async waitForTables() {
        console.log('⏳ Waiting for database tables to be ready...');

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                // Test if tables exist by running a simple query
                await GoogleUser.findOne({ limit: 1 });
                await MicrosoftUser.findOne({ limit: 1 });
                await SmtpAccount.findOne({ limit: 1 });
                await EmailPool.findOne({ limit: 1 });

                console.log('✅ Database tables are ready');
                return true;

            } catch (error) {
                if (attempt < this.maxRetries) {
                    console.log(`⏳ Tables not ready yet, retrying in ${this.retryDelay / 1000}s... (${attempt}/${this.maxRetries})`);
                    await this.delay(this.retryDelay);
                } else {
                    console.error('❌ Tables never became ready after maximum retries');
                    throw new Error(`Database tables not ready after ${this.maxRetries} attempts: ${error.message}`);
                }
            }
        }
    }

    // 🚨 NEW: Utility delay function
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async initializeAccount(account, type) {
        try {
            const updates = {};
            let needsUpdate = false;

            // Ensure warmupDayCount starts from 0 for new accounts
            if (account.warmupDayCount === undefined || account.warmupDayCount === null) {
                updates.warmupDayCount = 0;
                needsUpdate = true;
            }

            // Ensure startEmailsPerDay is set (default: 3)
            if (!account.startEmailsPerDay) {
                updates.startEmailsPerDay = 3;
                needsUpdate = true;
            }

            // Ensure increaseEmailsPerDay is set (default: 3)
            if (!account.increaseEmailsPerDay) {
                updates.increaseEmailsPerDay = 3;
                needsUpdate = true;
            }

            // Ensure maxEmailsPerDay is set (default: 25)
            if (!account.maxEmailsPerDay) {
                updates.maxEmailsPerDay = 25;
                needsUpdate = true;
            }

            // Reset current_day_sent for new day
            updates.current_day_sent = 0;
            updates.last_reset_date = new Date();
            needsUpdate = true;

            if (needsUpdate) {
                switch (type) {
                    case 'google':
                        await GoogleUser.update(updates, { where: { id: account.id } });
                        break;
                    case 'microsoft':
                        await MicrosoftUser.update(updates, { where: { id: account.id } });
                        break;
                    case 'smtp':
                        await SmtpAccount.update(updates, { where: { id: account.id } });
                        break;
                }
                console.log(`   ✅ Initialized ${type} account: ${account.email}`);
            }

        } catch (error) {
            console.error(`❌ Error initializing ${type} account ${account.email}:`, error);
        }
    }

    async initializePoolAccount(account) {
        try {
            const updates = {};
            let needsUpdate = false;

            // Ensure maxEmailsPerDay is set for pool accounts
            if (!account.maxEmailsPerDay) {
                updates.maxEmailsPerDay = 50;
                needsUpdate = true;
            }

            // Reset currentDaySent for new day
            updates.currentDaySent = 0;
            updates.lastResetDate = new Date();
            needsUpdate = true;

            if (needsUpdate) {
                await EmailPool.update(updates, { where: { id: account.id } });
            }

        } catch (error) {
            console.error(`❌ Error initializing pool account ${account.email}:`, error);
        }
    }

    async resetAllDailyCounts() {
        try {
            console.log('🔄 RESETTING ALL DAILY COUNTS...');

            const resetDate = new Date();

            // Reset Google accounts
            await GoogleUser.update(
                {
                    current_day_sent: 0,
                    last_reset_date: resetDate
                },
                { where: { warmupStatus: 'active' } }
            );

            // Reset Microsoft accounts
            await MicrosoftUser.update(
                {
                    current_day_sent: 0,
                    last_reset_date: resetDate
                },
                { where: { warmupStatus: 'active' } }
            );

            // Reset SMTP accounts
            await SmtpAccount.update(
                {
                    current_day_sent: 0,
                    last_reset_date: resetDate
                },
                { where: { warmupStatus: 'active' } }
            );

            // Reset Pool accounts
            await EmailPool.update(
                {
                    currentDaySent: 0,
                    lastResetDate: resetDate
                },
                { where: { isActive: true } }
            );

            console.log('✅ ALL DAILY COUNTS RESET COMPLETE');

        } catch (error) {
            console.error('❌ ERROR RESETTING DAILY COUNTS:', error);
        }
    }

}

const volumeInitializer = new VolumeInitializer();
module.exports = volumeInitializer;