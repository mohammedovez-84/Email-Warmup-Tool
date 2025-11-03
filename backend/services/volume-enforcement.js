// services/volumeEnforcement.js - COMPLETE VERSION WITH ALL METHODS
const { Op } = require('sequelize');
const EmailExchange = require('../models/MailExchange');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const EmailPool = require('../models/EmailPool');
const volumeInitializer = require('./volume-initializer');

class VolumeEnforcement {
    constructor() {
        this.strictMode = true;
        this.blockedAccounts = new Map();
        this.sentCounts = new Map();
        this.initialized = false;
    }

    // 🚨 INITIALIZE VOLUME ENFORCEMENT
    async initialize() {
        if (this.initialized) return;

        console.log('🔧 INITIALIZING VOLUME ENFORCEMENT SERVICE...');
        await volumeInitializer.initializeAllAccounts();
        this.initialized = true;
        console.log('✅ VOLUME ENFORCEMENT SERVICE READY');
    }

    // 🚨 MAIN: Check if account can send email
    async canAccountSendEmail(accountEmail, accountType = 'warmup') {
        try {
            // Ensure initialization
            if (!this.initialized) {
                await this.initialize();
            }

            if (this.blockedAccounts.has(accountEmail)) {
                const reason = this.blockedAccounts.get(accountEmail);
                console.log(`🚫 HARD BLOCKED: ${accountEmail} - ${reason}`);
                return false;
            }

            const volumeLimit = await this.getAccountVolumeLimit(accountEmail, accountType);
            const sentToday = await this.getSentTodayCount(accountEmail, accountType);

            console.log(`📊 VOLUME CHECK: ${accountEmail} (${accountType}) - ${sentToday}/${volumeLimit}`);

            if (sentToday >= volumeLimit) {
                console.log(`💥 BLOCKING: ${accountEmail} - ${sentToday}/${volumeLimit} emails sent`);
                this.blockedAccounts.set(accountEmail, `Limit reached: ${sentToday}/${volumeLimit}`);
                return false;
            }

            console.log(`✅ ALLOWED: ${accountEmail} - ${sentToday}/${volumeLimit} emails`);
            return true;

        } catch (error) {
            console.error(`❌ Volume check error for ${accountEmail}:`, error);
            this.blockedAccounts.set(accountEmail, `Error in volume check`);
            return false;
        }
    }

    // 🚨 NEW: Account for reply emails in volume limits
    async trackReplyEmail(warmupEmail, poolEmail) {
        try {
            console.log(`📨 TRACKING REPLY: ${poolEmail} → ${warmupEmail}`);

            // Increment pool account sent count (reply counts against pool limits)
            await this.incrementSentCount(poolEmail, 1, 'pool');

            // Note: Warmup account receiving reply doesn't count against their outbound limit
            // but we might want to track this for analytics

        } catch (error) {
            console.error(`❌ Error tracking reply email:`, error);
        }
    }

    // 🚨 NEW: Check if this is a reply to existing conversation
    async isReplyToExistingConversation(warmupEmail, poolEmail) {
        try {
            const existingExchange = await EmailExchange.findOne({
                where: {
                    warmupAccount: warmupEmail,
                    poolAccount: poolEmail,
                    direction: 'WARMUP_TO_POOL',
                    status: 'sent'
                },
                order: [['sentAt', 'DESC']]
            });

            return !!existingExchange;
        } catch (error) {
            console.error(`❌ Error checking existing conversation:`, error);
            return false;
        }
    }

    // 🚨 IMPROVED: Get account volume limit with proper warmup progression
    async getAccountVolumeLimit(email, accountType = 'warmup') {
        try {
            if (accountType === 'pool') {
                const pool = await EmailPool.findOne({ where: { email } });
                return pool?.maxEmailsPerDay || 50;
            }

            // Get warmup account with proper defaults
            const account = await GoogleUser.findOne({ where: { email } }) ||
                await MicrosoftUser.findOne({ where: { email } }) ||
                await SmtpAccount.findOne({ where: { email } });

            if (!account) {
                console.log(`❌ Account not found: ${email}`);
                return 0;
            }

            // Use actual values from database with proper defaults
            const startEmailsPerDay = this.ensureNumber(account.startEmailsPerDay, 3);
            const increaseEmailsPerDay = this.ensureNumber(account.increaseEmailsPerDay, 3);
            const maxEmailsPerDay = this.ensureNumber(account.maxEmailsPerDay, 25);
            const warmupDayCount = this.ensureNumber(account.warmupDayCount, 0);

            console.log(`📈 VOLUME CALCULATION for ${email}:`);
            console.log(`   ├── Start: ${startEmailsPerDay}`);
            console.log(`   ├── Increase: ${increaseEmailsPerDay}`);
            console.log(`   ├── Max: ${maxEmailsPerDay}`);
            console.log(`   ├── Day Count: ${warmupDayCount}`);
            console.log(`   └── Type: ${account.provider || 'smtp'}`);

            // Calculate volume based on warmup progression
            let volume = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
            volume = Math.min(volume, maxEmailsPerDay);
            volume = Math.max(1, volume); // At least 1 email per day

            console.log(`   📊 FINAL VOLUME: ${volume}`);

            return volume;

        } catch (error) {
            console.error(`❌ Volume calculation error for ${email}:`, error);
            return 0;
        }
    }

    // 🚨 Add this method to your VolumeEnforcement class in services/volumeEnforcement.js
    async getDailySummary(email, accountType = 'warmup') {
        try {
            const volumeLimit = await this.getAccountVolumeLimit(email, accountType);
            const sentToday = await this.getSentTodayCount(email, accountType);
            const remaining = Math.max(0, volumeLimit - sentToday);

            const summary = {
                email,
                accountType,
                sentToday,
                volumeLimit,
                remaining,
                percentage: volumeLimit > 0 ? Math.round((sentToday / volumeLimit) * 100) : 0,
                canSendMore: remaining > 0
            };

            console.log(`📈 DAILY SUMMARY: ${email}`);
            console.log(`   ├── Sent: ${sentToday}/${volumeLimit}`);
            console.log(`   ├── Remaining: ${remaining}`);
            console.log(`   ├── Percentage: ${summary.percentage}%`);
            console.log(`   └── Can Send More: ${summary.canSendMore}`);

            return summary;

        } catch (error) {
            console.error(`❌ Error getting daily summary for ${email}:`, error);
            return {
                email,
                error: 'Failed to get summary',
                sentToday: 0,
                volumeLimit: 0,
                remaining: 0,
                percentage: 0,
                canSendMore: false
            };
        }
    }

    // 🚨 IMPROVED: Get emails sent today with better counting
    async getSentTodayCount(email, accountType = 'warmup') {
        try {
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

            const sentToday = await EmailExchange.count({
                where: {
                    [accountType === 'warmup' ? 'warmupAccount' : 'poolAccount']: email,
                    sentAt: {
                        [Op.gte]: startOfDay,
                        [Op.lt]: endOfDay
                    },
                    status: {
                        [Op.in]: ['sent', 'delivered'] // Only count successfully sent emails
                    }
                }
            });

            console.log(`📨 SENT TODAY: ${email} - ${sentToday} emails`);

            return sentToday;
        } catch (error) {
            console.error(`❌ Sent count error for ${email}:`, error);
            return 999; // Fail safe - return high number to block sending
        }
    }

    // 🚨 NEW: Increment warmup day count for accounts
    async incrementWarmupDayCount(email) {
        try {
            let account = await GoogleUser.findOne({ where: { email } }) ||
                await MicrosoftUser.findOne({ where: { email } }) ||
                await SmtpAccount.findOne({ where: { email } });

            if (account) {
                const currentDayCount = this.ensureNumber(account.warmupDayCount, 0);
                const newDayCount = currentDayCount + 1;

                if (account instanceof GoogleUser) {
                    await GoogleUser.update({ warmupDayCount: newDayCount }, { where: { email } });
                } else if (account instanceof MicrosoftUser) {
                    await MicrosoftUser.update({ warmupDayCount: newDayCount }, { where: { email } });
                } else if (account instanceof SmtpAccount) {
                    await SmtpAccount.update({ warmupDayCount: newDayCount }, { where: { email } });
                }

                console.log(`📈 INCREMENTED WARMUP DAY: ${email} - Day ${newDayCount}`);
                return newDayCount;
            }
        } catch (error) {
            console.error(`❌ Error incrementing warmup day count for ${email}:`, error);
        }
        return 0;
    }

    // 🚨 NEW: Reset warmup progression
    async resetWarmupProgression(email) {
        try {
            let account = await GoogleUser.findOne({ where: { email } }) ||
                await MicrosoftUser.findOne({ where: { email } }) ||
                await SmtpAccount.findOne({ where: { email } });

            if (account) {
                const updates = {
                    warmupDayCount: 0,
                    current_day_sent: 0,
                    last_reset_date: new Date()
                };

                if (account instanceof GoogleUser) {
                    await GoogleUser.update(updates, { where: { email } });
                } else if (account instanceof MicrosoftUser) {
                    await MicrosoftUser.update(updates, { where: { email } });
                } else if (account instanceof SmtpAccount) {
                    await SmtpAccount.update(updates, { where: { email } });
                }

                console.log(`🔄 RESET WARMUP: ${email} - Back to day 0`);
                this.forceUnblock(email); // Unblock if previously blocked
            }
        } catch (error) {
            console.error(`❌ Error resetting warmup progression for ${email}:`, error);
        }
    }

    // 🚨 NEW: Get warmup progression status
    async getWarmupProgression(email) {
        try {
            const volumeLimit = await this.getAccountVolumeLimit(email, 'warmup');
            const sentToday = await this.getSentTodayCount(email, 'warmup');
            const remaining = Math.max(0, volumeLimit - sentToday);

            let account = await GoogleUser.findOne({ where: { email } }) ||
                await MicrosoftUser.findOne({ where: { email } }) ||
                await SmtpAccount.findOne({ where: { email } });

            const warmupDayCount = account ? this.ensureNumber(account.warmupDayCount, 0) : 0;

            return {
                email,
                warmupDay: warmupDayCount,
                sentToday,
                volumeLimit,
                remaining,
                percentage: volumeLimit > 0 ? Math.round((sentToday / volumeLimit) * 100) : 0,
                canSendMore: remaining > 0,
                isBlocked: this.blockedAccounts.has(email)
            };
        } catch (error) {
            console.error(`❌ Error getting warmup progression for ${email}:`, error);
            return null;
        }
    }

    // 🚨 IMPROVED: Get max emails to schedule
    async getMaxEmailsToSchedule(accountEmail, accountType = 'warmup') {
        try {
            const volumeLimit = await this.getAccountVolumeLimit(accountEmail, accountType);
            const sentToday = await this.getSentTodayCount(accountEmail, accountType);
            const remaining = Math.max(0, volumeLimit - sentToday);

            console.log(`📊 SCHEDULING LIMIT: ${accountEmail}`);
            console.log(`   ├── Limit: ${volumeLimit}`);
            console.log(`   ├── Sent: ${sentToday}`);
            console.log(`   └── Can Schedule: ${remaining} emails`);

            return remaining;

        } catch (error) {
            console.error(`❌ Scheduling limit error for ${accountEmail}:`, error);
            return 0;
        }
    }

    // 🚨 UTILITY: Ensure number with default
    ensureNumber(value, defaultValue = 0) {
        if (typeof value === 'number' && !isNaN(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed)) return parsed;
        }
        return defaultValue;
    }

    // 🚨 Reset for new day with warmup progression
    async resetForNewDay() {
        try {
            console.log('🔄 RESETTING FOR NEW DAY...');

            // Reset daily counts for all accounts
            await volumeInitializer.resetAllDailyCounts();

            // Increment warmup day count for active accounts
            await this.incrementWarmupDayForActiveAccounts();

            const previouslyBlocked = Array.from(this.blockedAccounts.keys());
            this.blockedAccounts.clear();
            this.sentCounts.clear();

            console.log(`✅ NEW DAY RESET: Cleared ${previouslyBlocked.length} blocked accounts`);
            return previouslyBlocked;

        } catch (error) {
            console.error('❌ Error resetting for new day:', error);
        }
    }

    // 🚨 NEW: Increment warmup day for all active accounts
    async incrementWarmupDayForActiveAccounts() {
        try {
            console.log('📈 INCREMENTING WARMUP DAY FOR ALL ACTIVE ACCOUNTS...');

            const googleAccounts = await GoogleUser.findAll({ where: { warmupStatus: 'active' } });
            const microsoftAccounts = await MicrosoftUser.findAll({ where: { warmupStatus: 'active' } });
            const smtpAccounts = await SmtpAccount.findAll({ where: { warmupStatus: 'active' } });

            const allAccounts = [...googleAccounts, ...microsoftAccounts, ...smtpAccounts];

            for (const account of allAccounts) {
                await this.incrementWarmupDayCount(account.email);
            }

            console.log(`✅ INCREMENTED WARMUP DAY FOR ${allAccounts.length} ACCOUNTS`);
        } catch (error) {
            console.error('❌ Error incrementing warmup days:', error);
        }
    }

    // 🚨 Get real-time capacity (with pending)
    async getRealTimeCapacity(email, accountType = 'warmup') {
        try {
            const volumeLimit = await this.getAccountVolumeLimit(email, accountType);
            const sentToday = await this.getSentTodayCount(email, accountType);
            const remaining = Math.max(0, volumeLimit - sentToday);

            console.log(`📊 REAL-TIME CAPACITY: ${email}`);
            console.log(`   ├── Limit: ${volumeLimit}`);
            console.log(`   ├── Sent: ${sentToday}`);
            console.log(`   └── Remaining: ${remaining}`);

            return remaining;
        } catch (error) {
            console.error(`❌ Error getting real-time capacity:`, error);
            return 0;
        }
    }

    // 🚨 Track pending emails
    trackPendingEmail(accountEmail, count = 1) {
        console.log(`📝 TRACKING: ${accountEmail} has ${count} pending emails`);
        // We're not using pending counts for now to keep it simple
    }

    // 🚨 Complete pending email
    completePendingEmail(accountEmail, count = 1) {
        console.log(`📝 COMPLETED: ${accountEmail} completed ${count} pending emails`);
        // We're not using pending counts for now to keep it simple
    }

    // 🚨 Reset for new day
    resetForNewDay() {
        const previouslyBlocked = Array.from(this.blockedAccounts.keys());
        this.blockedAccounts.clear();
        this.sentCounts.clear();
        console.log(`🔄 RESET: Cleared ${previouslyBlocked.length} blocked accounts`);
        return previouslyBlocked;
    }

    // 🚨 Get blocked accounts
    getBlockedAccounts() {
        return Object.fromEntries(this.blockedAccounts);
    }

    // 🚨 Force unblock account
    forceUnblock(email) {
        this.blockedAccounts.delete(email);
        console.log(`🔓 FORCE UNBLOCK: ${email}`);
    }

    // 🚨 Reset pending counts
    resetPendingCounts(email = null) {
        console.log(`🔄 RESET PENDING: ${email || 'all accounts'}`);
    }

    // 🚨 Get pending counts
    getPendingCounts() {
        return {};
    }
}

// Create and export instance
const volumeEnforcement = new VolumeEnforcement();
module.exports = volumeEnforcement;