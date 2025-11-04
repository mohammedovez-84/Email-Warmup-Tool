const { Op } = require('sequelize');
const EmailExchange = require('../../models/MailExchange');
const GoogleUser = require('../../models/GoogleUser');
const MicrosoftUser = require('../../models/MicrosoftUser');
const SmtpAccount = require('../../models/smtpAccounts');
const EmailPool = require('../../models/EmailPool');
const volumeInitializer = require('./volume-initializer');

class VolumeEnforcement {
    constructor() {
        this.strictMode = true;
        this.blockedAccounts = new Map();
        this.sentCounts = new Map();
        this.pendingIncrements = new Map();
        this.initialized = false;
        this.initializationPromise = null;
    }

    // 🚨 INITIALIZE VOLUME ENFORCEMENT
    async initialize() {
        if (this.initialized) return true;

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = (async () => {
            console.log('🔧 INITIALIZING VOLUME ENFORCEMENT SERVICE...');
            await volumeInitializer.initializeAllAccounts();
            await this.initializeSentCounts();
            this.initialized = true;
            console.log('✅ VOLUME ENFORCEMENT INITIALIZED');
            return true;
        })();

        return this.initializationPromise;
    }

    // 🚨 Initialize sent counts
    async initializeSentCounts() {
        try {
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
            throw error;
        }
    }

    // 🚨 DEBUG: Find source of extra counts
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

    // 🚨 UPDATED: Get account volume limit - only for external use
    async getAccountVolumeLimit(email, accountType = 'warmup') {
        try {
            const limit = await this.getAccountVolumeLimitInternal(email, accountType);

            // Only run debug if there's a count mismatch (optional - can be removed)
            const sentToday = await this.getSentTodayCount(email, accountType);
            if (sentToday > limit) {
                console.log(`🚨 COUNT MISMATCH: ${email} has ${sentToday} sent but limit is ${limit}`);
                // You can call debug here if needed, but it might break the flow
            }

            return limit;

        } catch (error) {
            console.error(`❌ Volume calculation error for ${email}:`, error);
            return 3; // Safe default
        }
    }

    // 🚨 FIXED: Volume calculation with proper database field inspection
    async getAccountVolumeLimitInternal(email, accountType = 'warmup') {
        try {
            if (accountType === 'pool') {
                const pool = await EmailPool.findOne({ where: { email } });
                const limit = pool?.maxEmailsPerDay || 50;
                console.log(`📊 POOL LIMIT: ${email} - ${limit}`);
                return limit;
            }

            const account = await GoogleUser.findOne({ where: { email } }) ||
                await MicrosoftUser.findOne({ where: { email } }) ||
                await SmtpAccount.findOne({ where: { email } });

            if (!account) {
                console.log(`❌ Account not found: ${email}`);
                return 3; // Safe default
            }



            // 🚨 FIXED: Extract values properly - check for different field naming conventions
            const startEmailsPerDay = this.ensureNumber(
                account.startEmailsPerDay || account.start_emails_per_day || account.startEmailsPerDay || 3,
                3
            );
            const increaseEmailsPerDay = this.ensureNumber(
                account.increaseEmailsPerDay || account.increase_emails_per_day || account.increaseEmailsPerDay || 3,
                3
            );
            const maxEmailsPerDay = this.ensureNumber(
                account.maxEmailsPerDay || account.max_emails_per_day || account.maxEmailsPerDay || 25,
                25
            );
            const warmupDayCount = this.ensureNumber(
                account.warmupDayCount || account.warmup_day_count || account.warmupDayCount || 0,
                0
            );

            console.log(`📈 VOLUME CALCULATION for ${email}:`);
            console.log(`   ├── Start: ${startEmailsPerDay}`);
            console.log(`   ├── Increase: ${increaseEmailsPerDay}`);
            console.log(`   ├── Max: ${maxEmailsPerDay}`);
            console.log(`   ├── Day Count: ${warmupDayCount}`);
            console.log(`   └── Type: ${account.provider || 'smtp'}`);

            let volume = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
            volume = Math.min(volume, maxEmailsPerDay);
            volume = Math.min(volume, 25);
            volume = Math.max(1, volume);

            console.log(`   📊 FINAL VOLUME: ${volume}`);
            return volume;

        } catch (error) {
            console.error(`❌ Internal volume calculation error for ${email}:`, error);
            return 3; // Safe default
        }
    }
    // 🚨 FIXED: Check if account can send email - use internal calculation
    async canAccountSendEmail(accountEmail, accountType = 'warmup') {
        await this.initialize();

        if (this.blockedAccounts.has(accountEmail)) {
            const reason = this.blockedAccounts.get(accountEmail);
            console.log(`🚫 HARD BLOCKED: ${accountEmail} - ${reason}`);
            return false;
        }

        const [volumeLimit, sentToday] = await Promise.all([
            this.getAccountVolumeLimitInternal(accountEmail, accountType), // Use INTERNAL
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

    // 🚨 NEW: Force update account limits to fix the mismatch
    async forceUpdateAccountLimits(email, newLimit) {
        try {
            console.log(`🔄 FORCE UPDATING ACCOUNT LIMITS: ${email} → ${newLimit}`);

            let account = await GoogleUser.findOne({ where: { email } }) ||
                await MicrosoftUser.findOne({ where: { email } }) ||
                await SmtpAccount.findOne({ where: { email } });

            if (!account) {
                console.log(`❌ Account not found for force update: ${email}`);
                return false;
            }

            // Calculate what warmupDayCount would give us the desired limit
            // Using formula: volume = start + (increase * dayCount)
            // So: dayCount = (volume - start) / increase

            const startEmailsPerDay = this.ensureNumber(account.startEmailsPerDay, 3);
            const increaseEmailsPerDay = this.ensureNumber(account.increaseEmailsPerDay, 3);

            let requiredDayCount = Math.ceil((newLimit - startEmailsPerDay) / increaseEmailsPerDay);
            requiredDayCount = Math.max(0, requiredDayCount); // Can't be negative

            console.log(`📊 CALCULATING REQUIRED DAY COUNT:`);
            console.log(`   ├── Target Limit: ${newLimit}`);
            console.log(`   ├── Start: ${startEmailsPerDay}`);
            console.log(`   ├── Increase: ${increaseEmailsPerDay}`);
            console.log(`   └── Required Day Count: ${requiredDayCount}`);

            // Update the account
            if (account instanceof GoogleUser) {
                await GoogleUser.update({ warmupDayCount: requiredDayCount }, { where: { email } });
            } else if (account instanceof MicrosoftUser) {
                await MicrosoftUser.update({ warmupDayCount: requiredDayCount }, { where: { email } });
            } else if (account instanceof SmtpAccount) {
                await SmtpAccount.update({ warmupDayCount: requiredDayCount }, { where: { email } });
            }

            console.log(`✅ FORCE UPDATED: ${email} → Day ${requiredDayCount} (Limit: ${newLimit})`);
            return true;

        } catch (error) {
            console.error(`❌ Error force updating account limits for ${email}:`, error);
            return false;
        }
    }

    // 🚨 FIXED: Get emails sent today - PREVENT DOUBLE COUNTING
    async getSentTodayCount(email, accountType = 'warmup', forceRefresh = false) {
        try {
            if (forceRefresh || !this.sentCounts.has(email)) {
                const today = new Date();
                const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

                // 🚨 CRITICAL FIX: Count based on account type to prevent double counting
                let whereClause = {
                    sentAt: {
                        [Op.gte]: startOfDay,
                        [Op.lt]: endOfDay
                    },
                    status: {
                        [Op.in]: ['sent', 'delivered']
                    }
                };

                // 🚨 FIX: Only count emails where this account was the SENDER
                if (accountType === 'warmup') {
                    // For warmup accounts, count only when they sent TO pool
                    whereClause.warmupAccount = email;
                    whereClause.direction = 'WARMUP_TO_POOL';
                } else {
                    // For pool accounts, count only when they sent TO warmup  
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
            // console.log(`📨 SENT TODAY (CACHED): ${email} - ${cachedCount} emails (${accountType})`);
            return cachedCount;

        } catch (error) {
            console.error(`❌ Sent count error for ${email}:`, error);
            return 0;
        }
    }

    // 🚨 FIXED: Increment sent count - PREVENT DOUBLE COUNTING
    async incrementSentCount(email, count = 1, accountType = 'warmup') {
        try {
            // 🚨 CRITICAL: Check current state BEFORE incrementing
            const currentCount = this.sentCounts.get(email) || 0;
            const currentPending = this.pendingIncrements.get(email) || 0;

            // 🚨 Get the actual limit to validate
            const volumeLimit = await this.getAccountVolumeLimitInternal(email, accountType);

            console.log(`📈 PRE-INCREMENT CHECK: ${email}`);
            console.log(`   ├── Current Count: ${currentCount}`);
            console.log(`   ├── Current Pending: ${currentPending}`);
            console.log(`   ├── Volume Limit: ${volumeLimit}`);
            console.log(`   ├── Would Become: ${currentCount + count}`);
            console.log(`   └── Account Type: ${accountType}`);

            // 🚨 VALIDATION: Don't exceed limit
            if (currentCount + count > volumeLimit) {
                console.log(`🚨 BLOCKED INCREMENT: ${email} would exceed limit (${currentCount + count} > ${volumeLimit})`);
                return currentCount;
            }

            // 🚨 ACTUAL INCREMENT
            const newCount = currentCount + count;
            this.sentCounts.set(email, newCount);

            // 🚨 Update pending (this gets removed when email is actually sent)
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

    // 🚨 Update database count
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

    // 🚨 FIXED: Track sent email - ensure proper counting
    async trackSentEmail(warmupEmail, poolEmail, direction) {
        try {
            console.log(`📝 TRACKING ACTUAL SENT: ${warmupEmail} ↔ ${poolEmail} (${direction})`);

            // 🚨 CRITICAL: Only increment the SENDER's count
            if (direction === 'WARMUP_TO_POOL') {
                // Warmup account is the sender
                await this.incrementSentCount(warmupEmail, 1, 'warmup');
                console.log(`✅ ACTUAL SENT TRACKED: ${warmupEmail} (warmup sender)`);
            } else if (direction === 'POOL_TO_WARMUP') {
                // Pool account is the sender  
                await this.incrementSentCount(poolEmail, 1, 'pool');
                console.log(`✅ ACTUAL SENT TRACKED: ${poolEmail} (pool sender)`);
            }

            // Remove from pending increments for BOTH accounts (since pending was added for both during scheduling)
            const warmupPending = this.pendingIncrements.get(warmupEmail) || 0;
            const poolPending = this.pendingIncrements.get(poolEmail) || 0;

            this.pendingIncrements.set(warmupEmail, Math.max(0, warmupPending - 1));
            this.pendingIncrements.set(poolEmail, Math.max(0, poolPending - 1));

            console.log(`📉 PENDING UPDATED: ${warmupEmail}=${this.pendingIncrements.get(warmupEmail)}, ${poolEmail}=${this.pendingIncrements.get(poolEmail)}`);

        } catch (error) {
            console.error('❌ Error tracking sent email:', error);
        }
    }

    // 🚨 FIXED: Get daily summary - use internal calculation to avoid debug errors
    async getDailySummary(email, accountType = 'warmup') {
        try {
            const [volumeLimit, sentToday] = await Promise.all([
                this.getAccountVolumeLimitInternal(email, accountType), // Use INTERNAL without debug
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

            console.log(`📈 DAILY SUMMARY: ${email}`);
            console.log(`   ├── Sent: ${sentToday}/${volumeLimit}`);
            console.log(`   ├── Pending: ${pending}`);
            console.log(`   ├── Total: ${totalUsed}/${volumeLimit}`);
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
                pending: 0,
                totalUsed: 0,
                volumeLimit: 3,
                remaining: 3,
                percentage: 0,
                canSendMore: true
            };
        }
    }
    // 🚨 NEW: Force reset counts for specific account
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

    // 🚨 Reset for new day
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

    // 🚨 FIXED: Get max emails to schedule - use internal calculation
    async getMaxEmailsToSchedule(accountEmail, accountType = 'warmup') {
        try {
            const [volumeLimit, sentToday] = await Promise.all([
                this.getAccountVolumeLimitInternal(accountEmail, accountType), // Use INTERNAL
                this.getSentTodayCount(accountEmail, accountType)
            ]);

            const pending = this.pendingIncrements.get(accountEmail) || 0;
            const totalUsed = sentToday + pending;
            const remaining = Math.max(0, volumeLimit - totalUsed);

            console.log(`📊 SCHEDULING LIMIT: ${accountEmail}`);
            console.log(`   ├── Limit: ${volumeLimit}`);
            console.log(`   ├── Sent: ${sentToday}`);
            console.log(`   ├── Pending: ${pending}`);
            console.log(`   └── Can Schedule: ${remaining} emails`);

            return remaining;

        } catch (error) {
            console.error(`❌ Scheduling limit error for ${accountEmail}:`, error);
            return 0;
        }
    }
    // 🚨 FIXED: Get remaining capacity - use internal calculation
    async getRemainingCapacity(email, accountType = 'warmup') {
        try {
            const [volumeLimit, sentToday] = await Promise.all([
                this.getAccountVolumeLimitInternal(email, accountType), // Use INTERNAL
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

    // 🚨 Utility methods
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

    forceUnblock(email) {
        this.blockedAccounts.delete(email);
        console.log(`🔓 FORCE UNBLOCK: ${email}`);
    }

    getAccountStatus(email) {
        return {
            sentCount: this.sentCounts.get(email) || 0,
            pending: this.pendingIncrements.get(email) || 0,
            blocked: this.blockedAccounts.has(email),
            blockedReason: this.blockedAccounts.get(email)
        };
    }

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
}

const volumeEnforcement = new VolumeEnforcement();
module.exports = volumeEnforcement;