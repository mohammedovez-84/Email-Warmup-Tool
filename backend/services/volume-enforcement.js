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
        this.sentCounts = new Map(); // In-memory cache for real-time tracking
        this.initialized = false;
    }

    // 🚨 INITIALIZE VOLUME ENFORCEMENT
    async initialize() {
        if (this.initialized) return;

        console.log('🔧 INITIALIZING VOLUME ENFORCEMENT SERVICE...');
        await volumeInitializer.initializeAllAccounts();

        // Pre-populate sent counts from database
        await this.initializeSentCounts();

        this.initialized = true;
        console.log('✅ VOLUME ENFORCEMENT SERVICE READY');
    }

    // 🚨 NEW: Initialize sent counts from database
    async initializeSentCounts() {
        try {
            console.log('📊 INITIALIZING SENT COUNTS FROM DATABASE...');

            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

            // Get all exchanges from today
            const todaysExchanges = await EmailExchange.findAll({
                where: {
                    sentAt: {
                        [Op.gte]: startOfDay
                    },
                    status: {
                        [Op.in]: ['sent', 'delivered']
                    }
                }
            });

            // Count emails per account
            const counts = {};
            todaysExchanges.forEach(exchange => {
                // Count warmup accounts
                if (exchange.warmupAccount) {
                    counts[exchange.warmupAccount] = (counts[exchange.warmupAccount] || 0) + 1;
                }
                // Count pool accounts  
                if (exchange.poolAccount) {
                    counts[exchange.poolAccount] = (counts[exchange.poolAccount] || 0) + 1;
                }
            });

            // Store in memory cache
            Object.entries(counts).forEach(([email, count]) => {
                this.sentCounts.set(email, count);
            });

            console.log(`📊 LOADED ${Object.keys(counts).length} ACCOUNT COUNTS FROM DATABASE`);
        } catch (error) {
            console.error('❌ Error initializing sent counts:', error);
        }
    }

    // 🚨 MAIN: Check if account can send email - FIXED
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

    // 🚨 FIXED: Get emails sent today - uses both cache and database
    async getSentTodayCount(email, accountType = 'warmup') {
        try {
            // Check memory cache first for real-time accuracy
            if (this.sentCounts.has(email)) {
                const cachedCount = this.sentCounts.get(email);
                console.log(`📨 SENT TODAY (CACHED): ${email} - ${cachedCount} emails`);
                return cachedCount;
            }

            // Fallback to database count
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
                        [Op.in]: ['sent', 'delivered']
                    }
                }
            });

            // Update cache
            this.sentCounts.set(email, sentToday);

            console.log(`📨 SENT TODAY (DB): ${email} - ${sentToday} emails`);
            return sentToday;
        } catch (error) {
            console.error(`❌ Sent count error for ${email}:`, error);
            return 999; // Fail safe
        }
    }

    // 🚨 NEW: Increment sent count immediately when email is scheduled
    async incrementSentCount(email, count = 1, accountType = 'warmup') {
        try {
            const currentCount = this.sentCounts.get(email) || 0;
            const newCount = currentCount + count;
            this.sentCounts.set(email, newCount);

            console.log(`📈 INCREMENTED COUNT: ${email} - ${currentCount} → ${newCount} (${accountType})`);

            // Also update database for persistence
            await this.updateDatabaseCount(email, accountType);

        } catch (error) {
            console.error(`❌ Error incrementing sent count for ${email}:`, error);
        }
    }

    // 🚨 NEW: Update database count for an account
    async updateDatabaseCount(email, accountType = 'warmup') {
        try {
            const sentToday = this.sentCounts.get(email) || 0;
            const currentTime = new Date();

            if (accountType === 'warmup') {
                let account = await GoogleUser.findOne({ where: { email } }) ||
                    await MicrosoftUser.findOne({ where: { email } }) ||
                    await SmtpAccount.findOne({ where: { email } });

                if (account) {
                    const updates = {
                        current_day_sent: sentToday,
                        last_reset_date: currentTime
                    };

                    if (account instanceof GoogleUser) {
                        await GoogleUser.update(updates, { where: { email } });
                    } else if (account instanceof MicrosoftUser) {
                        await MicrosoftUser.update(updates, { where: { email } });
                    } else if (account instanceof SmtpAccount) {
                        await SmtpAccount.update(updates, { where: { email } });
                    }
                }
            } else if (accountType === 'pool') {
                await EmailPool.update({
                    currentDaySent: sentToday,
                    lastResetDate: currentTime
                }, { where: { email } });
            }

            console.log(`💾 UPDATED DATABASE: ${email} - ${sentToday} emails`);
        } catch (error) {
            console.error(`❌ Error updating database count for ${email}:`, error);
        }
    }

    // 🚨 NEW: Track email immediately when scheduled (FIXES THE ISSUE)
    async trackScheduledEmail(warmupEmail, poolEmail, direction) {
        try {
            console.log(`📝 TRACKING SCHEDULED: ${warmupEmail} ↔ ${poolEmail} (${direction})`);

            // Increment counts immediately
            if (direction === 'WARMUP_TO_POOL') {
                await this.incrementSentCount(warmupEmail, 1, 'warmup');
                await this.incrementSentCount(poolEmail, 1, 'pool');
            } else if (direction === 'POOL_TO_WARMUP') {
                await this.incrementSentCount(poolEmail, 1, 'pool');
                await this.incrementSentCount(warmupEmail, 1, 'warmup');
            }

            console.log(`✅ SCHEDULED EMAIL TRACKED: ${warmupEmail} and ${poolEmail} counts updated`);

        } catch (error) {
            console.error('❌ Error tracking scheduled email:', error);
        }
    }

    // 🚨 NEW: Get real-time count (memory cache only)
    getRealTimeCount(email) {
        return this.sentCounts.get(email) || 0;
    }

    // 🚨 FIXED: Get account volume limit - MATCHES computeEmailsToSend exactly
    async getAccountVolumeLimit(email, accountType = 'warmup') {
        try {
            if (accountType === 'pool') {
                const pool = await EmailPool.findOne({ where: { email } });
                return pool?.maxEmailsPerDay || 50;
            }

            const account = await GoogleUser.findOne({ where: { email } }) ||
                await MicrosoftUser.findOne({ where: { email } }) ||
                await SmtpAccount.findOne({ where: { email } });

            if (!account) {
                console.log(`❌ Account not found: ${email}`);
                return 0;
            }

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

            // 🚨 CRITICAL: Use EXACT SAME calculation as computeEmailsToSend
            let volume = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
            volume = Math.min(volume, maxEmailsPerDay);
            volume = Math.min(volume, 25); // Match RATE_LIMIT_CONFIG.maxEmailsPerDay
            volume = Math.max(1, volume); // Ensure at least 1

            console.log(`   📊 FINAL VOLUME: ${volume}`);

            return volume;

        } catch (error) {
            console.error(`❌ Volume calculation error for ${email}:`, error);
            return 0;
        }
    }

    // 🚨 Get daily summary
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

    // 🚨 Get max emails to schedule
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

    // 🚨 Get remaining capacity
    async getRemainingCapacity(email, accountType = 'warmup') {
        try {
            const volumeLimit = await this.getAccountVolumeLimit(email, accountType);
            const sentToday = await this.getSentTodayCount(email, accountType);
            return Math.max(0, volumeLimit - sentToday);
        } catch (error) {
            console.error(`❌ Error getting remaining capacity for ${email}:`, error);
            return 0;
        }
    }

    // 🚨 FIXED: Reset for new day
    async resetForNewDay() {
        try {
            console.log('🔄 RESETTING FOR NEW DAY...');

            // Reset daily counts for all accounts
            await volumeInitializer.resetAllDailyCounts();

            // Increment warmup day count for active accounts
            await this.incrementWarmupDayForActiveAccounts();

            // Clear memory cache
            const previouslyBlocked = Array.from(this.blockedAccounts.keys());
            this.blockedAccounts.clear();
            this.sentCounts.clear();

            console.log(`✅ NEW DAY RESET: Cleared ${previouslyBlocked.length} blocked accounts and reset counts`);
            return previouslyBlocked;

        } catch (error) {
            console.error('❌ Error resetting for new day:', error);
        }
    }

    // 🚨 ADD TO VolumeEnforcement class
    async reverseScheduledEmail(email, direction) {
        try {
            console.log(`🔄 REVERSING scheduled email count for: ${email}`);

            // Decrement the sent count
            const currentCount = this.sentCounts.get(email) || 0;
            if (currentCount > 0) {
                this.sentCounts.set(email, currentCount - 1);
                console.log(`   📉 Count reversed: ${currentCount} → ${currentCount - 1}`);
            }

            // Remove from blocked accounts if now under limit
            if (this.blockedAccounts.has(email)) {
                const volumeLimit = await this.getAccountVolumeLimit(email, direction === 'WARMUP_TO_POOL' ? 'warmup' : 'pool');
                const newCount = this.sentCounts.get(email) || 0;

                if (newCount < volumeLimit) {
                    this.blockedAccounts.delete(email);
                    console.log(`   🔓 Unblocked: ${email} (${newCount}/${volumeLimit})`);
                }
            }

            // Update database count
            await this.updateDatabaseCount(email, direction === 'WARMUP_TO_POOL' ? 'warmup' : 'pool');

        } catch (error) {
            console.error(`❌ Error reversing scheduled email for ${email}:`, error);
        }
    }
    // 🚨 ADD THIS METHOD TO YOUR VolumeEnforcement CLASS
    async trackSentEmail(warmupEmail, poolEmail, direction) {
        try {
            console.log(`📝 TRACKING ACTUAL SENT: ${warmupEmail} ↔ ${poolEmail} (${direction})`);

            // 🚨 CRITICAL: Only increment counts for the SENDER
            if (direction === 'WARMUP_TO_POOL') {
                await this.incrementSentCount(warmupEmail, 1, 'warmup');
                console.log(`✅ ACTUAL SENT TRACKED: ${warmupEmail} (warmup) count incremented`);
            } else if (direction === 'POOL_TO_WARMUP') {
                await this.incrementSentCount(poolEmail, 1, 'pool');
                console.log(`✅ ACTUAL SENT TRACKED: ${poolEmail} (pool) count incremented`);
            }

        } catch (error) {
            console.error('❌ Error tracking sent email:', error);
        }
    }
    // 🚨 Increment warmup day for active accounts
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

    // 🚨 Increment warmup day count
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

    // 🚨 Reset warmup progression
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
                this.forceUnblock(email);
            }
        } catch (error) {
            console.error(`❌ Error resetting warmup progression for ${email}:`, error);
        }
    }

    // 🚨 Get warmup progression status
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

    // 🚨 Force unblock account
    forceUnblock(email) {
        this.blockedAccounts.delete(email);
        console.log(`🔓 FORCE UNBLOCK: ${email}`);
    }

    // 🚨 Get blocked accounts
    getBlockedAccounts() {
        return Object.fromEntries(this.blockedAccounts);
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