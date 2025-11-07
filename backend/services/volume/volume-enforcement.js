const { Op } = require('sequelize');
const GoogleUser = require('../../models/GoogleUser');
const MicrosoftUser = require('../../models/MicrosoftUser');
const SmtpAccount = require('../../models/smtpAccounts');
const EmailPool = require('../../models/EmailPool');
const EmailExchange = require('../../models/MailExchange');
const EmailMetric = require('../../models/EmailMetric');

const VolumeInitializer = require('./volume-initializer');
const ReplyTracking = require('../../models/ReplyTracking');

class VolumeEnforcement {
    constructor() {
        this.strictMode = true;
        this.blockedAccounts = new Map();
        this.sentCounts = new Map();
        this.pendingIncrements = new Map();
        this.initialized = false;
        this.initializationPromise = null;
        this.initializationAttempts = 0;
        this.maxInitializationAttempts = 3;
    }

    // 🚨 IMPROVED: Graceful initialization with retries
    async initialize() {
        if (this.initialized) return true;

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = (async () => {
            console.log('🔧 INITIALIZING VOLUME ENFORCEMENT SERVICE...');

            try {
                await VolumeInitializer.initializeAllAccounts();
                await this.initializeSentCounts();
                this.initialized = true;
                console.log('✅ VOLUME ENFORCEMENT INITIALIZED');
                return true;
            } catch (error) {
                this.initializationAttempts++;

                if (this.initializationAttempts < this.maxInitializationAttempts) {
                    console.log(`🔄 Initialization failed, retrying in 5 seconds... (${this.initializationAttempts}/${this.maxInitializationAttempts})`);
                    await this.delay(5000);
                    this.initializationPromise = null; // Reset promise for retry
                    return await this.initialize(); // Recursive retry
                } else {
                    console.error('❌ VOLUME ENFORCEMENT INITIALIZATION FAILED AFTER MAX RETRIES');
                    this.initialized = false;
                    throw error;
                }
            }
        })();

        return this.initializationPromise;
    }

    // 🚨 NEW: Delay utility
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 🚨 IMPROVED: Initialize sent counts with table check
    async initializeSentCounts() {
        try {
            // Quick check if EmailExchange table exists
            try {
                await EmailExchange.findOne({ limit: 1 });
            } catch (error) {
                console.log('⏳ EmailExchange table not ready yet, skipping sent counts initialization');
                this.sentCounts.clear();
                this.pendingIncrements.clear();
                return;
            }

            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

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

            this.sentCounts.clear();
            this.pendingIncrements.clear();

            const counts = {};
            todaysExchanges.forEach(exchange => {
                if (exchange.warmupAccount) {
                    counts[exchange.warmupAccount] = (counts[exchange.warmupAccount] || 0) + 1;
                }
                if (exchange.poolAccount) {
                    counts[exchange.poolAccount] = (counts[exchange.poolAccount] || 0) + 1;
                }
            });

            Object.entries(counts).forEach(([email, count]) => {
                this.sentCounts.set(email, count);
            });

            console.log(`📊 INITIALIZED SENT COUNTS: ${this.sentCounts.size} accounts`);

        } catch (error) {
            console.error('❌ Error initializing sent counts:', error);
            // Don't throw - just start with empty counts
            this.sentCounts.clear();
            this.pendingIncrements.clear();
        }
    }


    // In your VolumeEnforcement - enhance with reply tracking
    async getAccountVolumeLimitInternal(email, accountType = 'warmup') {
        try {
            if (accountType === 'pool') {
                const pool = await EmailPool.findOne({ where: { email } });
                return pool?.maxEmailsPerDay || 50;
            }

            const account = await GoogleUser.findOne({ where: { email } }) ||
                await MicrosoftUser.findOne({ where: { email } }) ||
                await SmtpAccount.findOne({ where: { email } });

            if (!account) return 3;

            // 🎯 GET BASE VOLUME
            const startEmailsPerDay = account.startEmailsPerDay || 3;
            const increaseEmailsPerDay = account.increaseEmailsPerDay || 3;
            const maxEmailsPerDay = account.maxEmailsPerDay || 25;
            const warmupDayCount = account.warmupDayCount || 0;

            let volume = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
            volume = Math.min(volume, maxEmailsPerDay);
            volume = Math.min(volume, 25);
            volume = Math.max(1, volume);

            // 🎯 APPLY REPLY-BASED ADJUSTMENT
            const replyAdjustedVolume = await this.applyReplyBasedAdjustment(email, volume, warmupDayCount);

            return replyAdjustedVolume;

        } catch (error) {
            console.error(`❌ Volume calculation error for ${email}:`, error);
            return 3;
        }
    }

    // In volume-enforcement.js - ADD THIS METHOD
    async canAccountSendEmail(accountEmail, accountType = 'warmup') {
        await this.initialize();

        if (this.blockedAccounts.has(accountEmail)) {
            const reason = this.blockedAccounts.get(accountEmail);
            console.log(`🚫 HARD BLOCKED: ${accountEmail} - ${reason}`);
            return false;
        }

        const [volumeLimit, sentToday] = await Promise.all([
            this.getAccountVolumeLimitInternal(accountEmail, accountType),
            this.getSentTodayCount(accountEmail, accountType)
        ]);

        const pending = this.pendingIncrements.get(accountEmail) || 0;
        const totalCount = sentToday + pending;

        console.log(`📊 VOLUME CHECK: ${accountEmail} (${accountType}) - ${sentToday}/${volumeLimit} + ${pending} pending = ${totalCount}/${volumeLimit}`);

        if (totalCount >= volumeLimit) {
            console.log(`💥 BLOCKING: ${accountEmail} - ${totalCount}/${volumeLimit} (includes ${pending} pending)`);
            this.blockedAccounts.set(accountEmail, `Limit reached: ${totalCount}/${volumeLimit}`);
            return false;
        }

        return true;
    }
    // 🎯 NEW: Apply reply-based adjustments
    async applyReplyBasedAdjustment(email, baseVolume, warmupDayCount) {
        try {
            const { Op } = require('sequelize');
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 3); // Last 3 days

            // Get recent reply performance
            const replies = await ReplyTracking.count({
                where: {
                    originalSender: email,
                    repliedAt: { [Op.gte]: startDate }
                }
            });

            const sentEmails = await EmailExchange.count({
                where: {
                    warmupAccount: email,
                    sentAt: { [Op.gte]: startDate },
                    direction: 'WARMUP_TO_POOL'
                }
            });

            const replyRate = sentEmails > 0 ? replies / sentEmails : 0;

            let adjustment = 0;

            // 🎯 ADJUST BASED ON ACTUAL PERFORMANCE
            if (replyRate > 0.3 && replies >= 3) {
                adjustment = 2; // High performer - boost
            } else if (replyRate > 0.15 && replies >= 2) {
                adjustment = 1; // Good performer
            } else if (replyRate < 0.05 && sentEmails >= 5) {
                adjustment = -1; // Low engagement - reduce
            }

            // 🎯 SCALE ADJUSTMENT BASED ON WARMUP STAGE
            let adjustedVolume = baseVolume + adjustment;

            if (warmupDayCount <= 2) {
                adjustedVolume = Math.min(8, adjustedVolume); // Early stage cap
            } else if (warmupDayCount <= 7) {
                adjustedVolume = Math.min(20, adjustedVolume); // Mid stage cap
            }

            adjustedVolume = Math.max(1, Math.min(25, adjustedVolume));

            console.log(`🎯 REPLY-ADJUSTED VOLUME for ${email}: ${baseVolume} → ${adjustedVolume} (replies: ${replies}/${sentEmails}, rate: ${(replyRate * 100).toFixed(1)}%)`);

            return adjustedVolume;

        } catch (error) {
            console.error(`❌ Reply adjustment error for ${email}:`, error);
            return baseVolume; // Fallback to base volume
        }
    }


    // 🚨 MISSING: Check if account can send email
    async canAccountSendEmail(accountEmail, accountType = 'warmup') {
        await this.initialize();

        if (this.blockedAccounts.has(accountEmail)) {
            const reason = this.blockedAccounts.get(accountEmail);
            console.log(`🚫 HARD BLOCKED: ${accountEmail} - ${reason}`);
            return false;
        }

        const [volumeLimit, sentToday] = await Promise.all([
            this.getAccountVolumeLimitInternal(accountEmail, accountType),
            this.getSentTodayCount(accountEmail, accountType)
        ]);

        const pending = this.pendingIncrements.get(accountEmail) || 0;
        const totalCount = sentToday + pending;

        console.log(`📊 VOLUME CHECK: ${accountEmail} (${accountType}) - ${sentToday}/${volumeLimit} + ${pending} pending = ${totalCount}/${volumeLimit}`);

        if (totalCount >= volumeLimit) {
            console.log(`💥 BLOCKING: ${accountEmail} - ${totalCount}/${volumeLimit} (includes ${pending} pending)`);
            this.blockedAccounts.set(accountEmail, `Limit reached: ${totalCount}/${volumeLimit}`);
            return false;
        }

        return true;
    }

    // 🚨 MISSING: Get emails sent today
    async getSentTodayCount(email, accountType = 'warmup', forceRefresh = false) {
        try {
            if (forceRefresh || !this.sentCounts.has(email)) {
                const today = new Date();
                const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

                let whereClause = {
                    sentAt: {
                        [Op.gte]: startOfDay,
                        [Op.lt]: endOfDay
                    },
                    status: {
                        [Op.in]: ['sent', 'delivered']
                    }
                };

                // Count based on account type to prevent double counting
                if (accountType === 'warmup') {
                    whereClause.warmupAccount = email;
                    whereClause.direction = 'WARMUP_TO_POOL';
                } else {
                    whereClause.poolAccount = email;
                    whereClause.direction = 'POOL_TO_WARMUP';
                }

                const sentToday = await EmailExchange.count({
                    where: whereClause
                });

                this.sentCounts.set(email, sentToday);
                console.log(`📨 SENT TODAY (DB REFRESH): ${email} - ${sentToday} emails (${accountType})`);
                return sentToday;
            }

            const cachedCount = this.sentCounts.get(email);
            return cachedCount;

        } catch (error) {
            console.error(`❌ Sent count error for ${email}:`, error);
            return 0;
        }
    }

    // 🚨 MISSING: Increment sent count
    async incrementSentCount(email, count = 1, accountType = 'warmup') {
        try {
            const currentCount = this.sentCounts.get(email) || 0;
            const currentPending = this.pendingIncrements.get(email) || 0;
            const volumeLimit = await this.getAccountVolumeLimitInternal(email, accountType);

            console.log(`📈 PRE-INCREMENT CHECK: ${email}`);
            console.log(`   ├── Current Count: ${currentCount}`);
            console.log(`   ├── Current Pending: ${currentPending}`);
            console.log(`   ├── Volume Limit: ${volumeLimit}`);
            console.log(`   ├── Would Become: ${currentCount + count}`);
            console.log(`   └── Account Type: ${accountType}`);

            // Don't exceed limit
            if (currentCount + count > volumeLimit) {
                console.log(`🚨 BLOCKED INCREMENT: ${email} would exceed limit (${currentCount + count} > ${volumeLimit})`);
                return currentCount;
            }

            const newCount = currentCount + count;
            this.sentCounts.set(email, newCount);
            this.pendingIncrements.set(email, currentPending + count);

            console.log(`✅ INCREMENTED COUNT: ${email} - ${currentCount} → ${newCount} (${accountType})`);

            // Update database in background
            this.updateDatabaseCount(email, accountType).catch(error => {
                console.error(`❌ Background database update failed for ${email}:`, error);
            });

            return newCount;

        } catch (error) {
            console.error(`❌ Error incrementing sent count for ${email}:`, error);
            throw error;
        }
    }

    // 🚨 MISSING: Update database count
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

    // 🚨 MISSING: Track sent email
    async trackSentEmail(warmupEmail, poolEmail, direction) {
        try {
            console.log(`📝 TRACKING ACTUAL SENT: ${warmupEmail} ↔ ${poolEmail} (${direction})`);

            if (direction === 'WARMUP_TO_POOL') {
                await this.incrementSentCount(warmupEmail, 1, 'warmup');
                console.log(`✅ ACTUAL SENT TRACKED: ${warmupEmail} (warmup sender)`);
            } else if (direction === 'POOL_TO_WARMUP') {
                await this.incrementSentCount(poolEmail, 1, 'pool');
                console.log(`✅ ACTUAL SENT TRACKED: ${poolEmail} (pool sender)`);
            }

            // Remove from pending increments
            const warmupPending = this.pendingIncrements.get(warmupEmail) || 0;
            const poolPending = this.pendingIncrements.get(poolEmail) || 0;

            this.pendingIncrements.set(warmupEmail, Math.max(0, warmupPending - 1));
            this.pendingIncrements.set(poolEmail, Math.max(0, poolPending - 1));

            console.log(`📉 PENDING UPDATED: ${warmupEmail}=${this.pendingIncrements.get(warmupEmail)}, ${poolEmail}=${this.pendingIncrements.get(poolEmail)}`);

        } catch (error) {
            console.error('❌ Error tracking sent email:', error);
        }
    }

    // 🚨 MISSING: Get daily summary
    async getDailySummary(email, accountType = 'warmup') {
        try {
            const [volumeLimit, sentToday] = await Promise.all([
                this.getAccountVolumeLimitInternal(email, accountType),
                this.getSentTodayCount(email, accountType)
            ]);

            const pending = this.pendingIncrements.get(email) || 0;
            const totalUsed = sentToday + pending;
            const remaining = Math.max(0, volumeLimit - totalUsed);

            const summary = {
                email,
                accountType,
                sentToday,
                pending,
                totalUsed,
                volumeLimit,
                remaining,
                percentage: volumeLimit > 0 ? Math.round((totalUsed / volumeLimit) * 100) : 0,
                canSendMore: remaining > 0
            };

            // console.log(`📈 DAILY SUMMARY: ${email}`);
            // console.log(`   ├── Sent: ${sentToday}/${volumeLimit}`);
            // console.log(`   ├── Pending: ${pending}`);
            // console.log(`   ├── Total: ${totalUsed}/${volumeLimit}`);
            // console.log(`   ├── Remaining: ${remaining}`);
            // console.log(`   ├── Percentage: ${summary.percentage}%`);
            // console.log(`   └── Can Send More: ${summary.canSendMore}`);

            return summary;

        } catch (error) {
            console.error(`❌ Error getting daily summary for ${email}:`, error);
            return {
                email,
                error: 'Failed to get summary',
                sentToday: 0,
                pending: 0,
                totalUsed: 0,
                volumeLimit: 3,
                remaining: 3,
                percentage: 0,
                canSendMore: true
            };
        }
    }

    // 🚨 MISSING: Get max emails to schedule
    async getMaxEmailsToSchedule(accountEmail, accountType = 'warmup') {
        try {
            const [volumeLimit, sentToday] = await Promise.all([
                this.getAccountVolumeLimitInternal(accountEmail, accountType),
                this.getSentTodayCount(accountEmail, accountType)
            ]);

            const pending = this.pendingIncrements.get(accountEmail) || 0;
            const totalUsed = sentToday + pending;
            const remaining = Math.max(0, volumeLimit - totalUsed);

            // console.log(`📊 SCHEDULING LIMIT: ${accountEmail}`);
            // console.log(`   ├── Limit: ${volumeLimit}`);
            // console.log(`   ├── Sent: ${sentToday}`);
            // console.log(`   ├── Pending: ${pending}`);
            // console.log(`   └── Can Schedule: ${remaining} emails`);

            return remaining;

        } catch (error) {
            console.error(`❌ Scheduling limit error for ${accountEmail}:`, error);
            return 0;
        }
    }

    // 🚨 MISSING: Reverse scheduled email
    async reverseScheduledEmail(email, direction) {
        try {
            console.log(`🔄 REVERSING scheduled email count for: ${email}`);

            const currentCount = this.sentCounts.get(email) || 0;
            if (currentCount > 0) {
                this.sentCounts.set(email, currentCount - 1);
            }

            const currentPending = this.pendingIncrements.get(email) || 0;
            if (currentPending > 0) {
                this.pendingIncrements.set(email, currentPending - 1);
            }

            if (this.blockedAccounts.has(email)) {
                this.blockedAccounts.delete(email);
                console.log(`🔓 Unblocked: ${email}`);
            }

            console.log(`📉 Count reversed: ${email} (cache: ${this.sentCounts.get(email)}, pending: ${this.pendingIncrements.get(email)})`);

        } catch (error) {
            console.error(`❌ Error reversing scheduled email for ${email}:`, error);
        }
    }

    // 🚨 MISSING: Utility methods
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

    // 🚨 MISSING: Force unblock
    forceUnblock(email) {
        this.blockedAccounts.delete(email);
        console.log(`🔓 FORCE UNBLOCK: ${email}`);
    }

    // 🚨 MISSING: Get account status
    getAccountStatus(email) {
        return {
            sentCount: this.sentCounts.get(email) || 0,
            pending: this.pendingIncrements.get(email) || 0,
            blocked: this.blockedAccounts.has(email),
            blockedReason: this.blockedAccounts.get(email)
        };
    }

    // 🚨 MISSING: Reset for new day
    async resetForNewDay() {
        try {
            console.log('🔄 RESETTING FOR NEW DAY...');

            const previouslyBlocked = Array.from(this.blockedAccounts.keys());
            this.blockedAccounts.clear();
            this.sentCounts.clear();
            this.pendingIncrements.clear();

            await volumeInitializer.resetAllDailyCounts();
            await this.incrementWarmupDayForActiveAccounts();
            await this.initializeSentCounts();

            console.log(`✅ NEW DAY RESET: Cleared ${previouslyBlocked.length} blocked accounts`);
            return previouslyBlocked;

        } catch (error) {
            console.error('❌ Error resetting for new day:', error);
            throw error;
        }
    }

    // 🚨 MISSING: Increment warmup day for active accounts
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

    // 🚨 MISSING: Increment warmup day count
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

    // 🚨 MISSING: Debug count issue
    async debugCountIssue(email, accountType = 'warmup') {
        try {
            console.log(`🔍 DEBUGGING COUNT ISSUE FOR: ${email}`);

            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

            const dbCount = await EmailExchange.count({
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

            const cacheCount = this.sentCounts.get(email) || 0;
            const pendingCount = this.pendingIncrements.get(email) || 0;
            const volumeLimit = await this.getAccountVolumeLimitInternal(email, accountType);

            console.log(`🔍 DEBUG RESULTS for ${email}:`);
            console.log(`   ├── Database Count: ${dbCount}`);
            console.log(`   ├── Cache Count: ${cacheCount}`);
            console.log(`   ├── Pending Count: ${pendingCount}`);
            console.log(`   ├── Volume Limit: ${volumeLimit}`);
            console.log(`   ├── Cache vs DB Diff: ${cacheCount - dbCount}`);
            console.log(`   └── Total (Cache + Pending): ${cacheCount + pendingCount}`);

            return {
                dbCount,
                cacheCount,
                pendingCount,
                volumeLimit,
                cacheDbDiff: cacheCount - dbCount,
                totalEffective: cacheCount + pendingCount
            };

        } catch (error) {
            console.error(`❌ Debug error for ${email}:`, error);
            return null;
        }
    }

    // 🚨 MISSING: Force reset account counts
    async forceResetAccountCounts(email, accountType = 'warmup') {
        try {
            console.log(`🔄 FORCE RESETTING COUNTS FOR: ${email}`);

            // Get actual database count
            const dbCount = await this.getSentTodayCount(email, accountType, true);

            // Reset cache to match database
            this.sentCounts.set(email, dbCount);
            this.pendingIncrements.set(email, 0);
            this.blockedAccounts.delete(email);

            // Update database to match
            await this.updateDatabaseCount(email, accountType);

            console.log(`✅ FORCE RESET COMPLETE: ${email} = ${dbCount} emails`);
            return dbCount;

        } catch (error) {
            console.error(`❌ Force reset error for ${email}:`, error);
            throw error;
        }
    }

    // 🚨 MISSING: Get remaining capacity
    async getRemainingCapacity(email, accountType = 'warmup') {
        try {
            const [volumeLimit, sentToday] = await Promise.all([
                this.getAccountVolumeLimitInternal(email, accountType),
                this.getSentTodayCount(email, accountType)
            ]);

            const pending = this.pendingIncrements.get(email) || 0;
            const totalUsed = sentToday + pending;
            return Math.max(0, volumeLimit - totalUsed);
        } catch (error) {
            console.error(`❌ Error getting remaining capacity for ${email}:`, error);
            return 0;
        }
    }
}

// const volumeEnforcement = new VolumeEnforcement();
module.exports = VolumeEnforcement;