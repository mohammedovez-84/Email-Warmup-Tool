const { Op } = require('sequelize');
const GoogleUser = require('../../models/GoogleUser');
const MicrosoftUser = require('../../models/MicrosoftUser');
const SmtpAccount = require('../../models/smtpAccounts');
const EmailPool = require('../../models/EmailPool');
const EmailExchange = require('../../models/MailExchange');

class VolumeEnforcement {
    constructor() {
        this.strictMode = true;
        this.blockedAccounts = new Map();
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
            this.initialized = true;
            console.log('✅ VOLUME ENFORCEMENT INITIALIZED');
            return true;
        })();

        return this.initializationPromise;
    }

    // 🚨 FIXED: Get account volume limit
    async getAccountVolumeLimit(email, accountType = 'warmup') {
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

            let volume = startEmailsPerDay + (increaseEmailsPerDay * warmupDayCount);
            volume = Math.min(volume, maxEmailsPerDay);
            volume = Math.max(1, volume);

            console.log(`   📊 FINAL VOLUME: ${volume}`);
            return volume;

        } catch (error) {
            console.error(`❌ Volume calculation error for ${email}:`, error);
            return 3; // Safe default
        }
    }

    // 🚨 FIXED: Get emails sent today with proper date range
    async getSentTodayCount(email, accountType = 'warmup') {
        try {
            // 🚨 CRITICAL FIX: Use proper timezone-aware date calculation
            const today = new Date();

            // Get start of today in local timezone, then convert to UTC
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const startOfDayUTC = new Date(startOfDay.getTime() - startOfDay.getTimezoneOffset() * 60000);

            // Get start of tomorrow in local timezone, then convert to UTC  
            const startOfTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
            const startOfTomorrowUTC = new Date(startOfTomorrow.getTime() - startOfTomorrow.getTimezoneOffset() * 60000);

            console.log(`📅 DATE RANGE for ${email}:`);
            console.log(`   Local Today: ${today.toISOString()}`);
            console.log(`   Start of Day (UTC): ${startOfDayUTC.toISOString()}`);
            console.log(`   End of Day (UTC): ${startOfTomorrowUTC.toISOString()}`);

            let sentCount = 0;

            if (accountType === 'pool') {
                // 🚨 COUNT POOL EMAILS FROM EMAILEXCHANGE
                const poolSentCount = await EmailExchange.count({
                    where: {
                        poolAccount: email,
                        direction: 'POOL_TO_WARMUP',
                        status: {
                            [Op.in]: ['sent', 'delivered']
                        },
                        sentAt: {
                            [Op.between]: [startOfDayUTC, startOfTomorrowUTC]
                        }
                    }
                });

                // Also get from pool table as fallback
                const pool = await EmailPool.findOne({ where: { email } });
                const poolTableCount = pool?.currentDaySent || 0;

                // 🚨 USE THE LOWER COUNT TO BE SAFE
                sentCount = Math.min(poolSentCount, poolTableCount);
                console.log(`📨 POOL SENT TODAY: ${email} - ${sentCount} emails (Exchange: ${poolSentCount}, Table: ${poolTableCount})`);

            } else {
                // 🚨 COUNT WARMUP EMAILS FROM EMAILEXCHANGE
                const warmupSentCount = await EmailExchange.count({
                    where: {
                        warmupAccount: email,
                        direction: 'WARMUP_TO_POOL',
                        status: {
                            [Op.in]: ['sent', 'delivered']
                        },
                        sentAt: {
                            [Op.between]: [startOfDayUTC, startOfTomorrowUTC]
                        }
                    }
                });

                // Also get from warmup tables as fallback
                const account = await GoogleUser.findOne({ where: { email } }) ||
                    await MicrosoftUser.findOne({ where: { email } }) ||
                    await SmtpAccount.findOne({ where: { email } });

                const warmupTableCount = account?.current_day_sent || 0;

                // 🚨 USE THE LOWER COUNT TO BE SAFE
                sentCount = Math.min(warmupSentCount, warmupTableCount);
                console.log(`📨 WARMUP SENT TODAY: ${email} - ${sentCount} emails (Exchange: ${warmupSentCount}, Table: ${warmupTableCount})`);
            }

            return sentCount;

        } catch (error) {
            console.error(`❌ Sent count error for ${email}:`, error);

            // Fallback to table count only
            if (accountType === 'pool') {
                const pool = await EmailPool.findOne({ where: { email } });
                return pool?.currentDaySent || 0;
            } else {
                const account = await GoogleUser.findOne({ where: { email } }) ||
                    await MicrosoftUser.findOne({ where: { email } }) ||
                    await SmtpAccount.findOne({ where: { email } });
                return account?.current_day_sent || 0;
            }
        }
    }

    // 🚨 FIXED: Check if account can send email
    async canAccountSendEmail(accountEmail, accountType = 'warmup') {
        await this.initialize();

        if (this.blockedAccounts.has(accountEmail)) {
            const reason = this.blockedAccounts.get(accountEmail);
            console.log(`🚫 HARD BLOCKED: ${accountEmail} - ${reason}`);
            return false;
        }

        const [volumeLimit, sentToday] = await Promise.all([
            this.getAccountVolumeLimit(accountEmail, accountType),
            this.getSentTodayCount(accountEmail, accountType)
        ]);

        console.log(`📊 VOLUME CHECK: ${accountEmail} (${accountType}) - ${sentToday}/${volumeLimit}`);

        if (sentToday >= volumeLimit) {
            console.log(`💥 BLOCKING: ${accountEmail} - ${sentToday}/${volumeLimit}`);
            this.blockedAccounts.set(accountEmail, `Limit reached: ${sentToday}/${volumeLimit}`);
            return false;
        }

        return true;
    }

    // 🚨 FIXED: Increment sent count
    async incrementSentCount(email, count = 1, accountType = 'warmup') {
        try {
            // This should update the database record
            if (accountType === 'warmup') {
                let account = await GoogleUser.findOne({ where: { email } }) ||
                    await MicrosoftUser.findOne({ where: { email } }) ||
                    await SmtpAccount.findOne({ where: { email } });

                if (account) {
                    const newCount = (account.current_day_sent || 0) + count;

                    if (account instanceof GoogleUser) {
                        await GoogleUser.update({ current_day_sent: newCount }, { where: { email } });
                    } else if (account instanceof MicrosoftUser) {
                        await MicrosoftUser.update({ current_day_sent: newCount }, { where: { email } });
                    } else if (account instanceof SmtpAccount) {
                        await SmtpAccount.update({ current_day_sent: newCount }, { where: { email } });
                    }

                    console.log(`✅ Database updated: ${email} - ${newCount} sent`);
                    return newCount;
                }
            } else if (accountType === 'pool') {
                const pool = await EmailPool.findOne({ where: { email } });
                if (pool) {
                    const newCount = (pool.currentDaySent || 0) + count;
                    await EmailPool.update({ currentDaySent: newCount }, { where: { email } });
                    console.log(`✅ Pool database updated: ${email} - ${newCount} sent`);
                    return newCount;
                }
            }

            throw new Error(`Account not found: ${email}`);

        } catch (error) {
            console.error(`❌ Error incrementing sent count for ${email}:`, error);
            throw error;
        }
    }

    // 🚨 CRITICAL: Ensure this reads from database
    async getSentTodayCount(email, accountType = 'warmup') {
        try {
            if (accountType === 'pool') {
                const pool = await EmailPool.findOne({ where: { email } });
                return pool?.currentDaySent || 0;
            } else {
                const account = await GoogleUser.findOne({ where: { email } }) ||
                    await MicrosoftUser.findOne({ where: { email } }) ||
                    await SmtpAccount.findOne({ where: { email } });

                return account?.current_day_sent || 0;
            }
        } catch (error) {
            console.error(`❌ Error getting sent count for ${email}:`, error);
            return 0;
        }
    }
    // 🚨 MISSING METHOD: Get max emails to schedule
    async getMaxEmailsToSchedule(accountEmail, accountType = 'warmup') {
        try {
            const [volumeLimit, sentToday] = await Promise.all([
                this.getAccountVolumeLimit(accountEmail, accountType),
                this.getSentTodayCount(accountEmail, accountType)
            ]);

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

    // 🚨 MISSING METHOD: Reverse scheduled email
    async reverseScheduledEmail(targetEmail, direction) {
        try {
            console.log(`🔄 REVERSING SCHEDULED COUNT: ${targetEmail} (${direction})`);

            const accountType = direction === 'WARMUP_TO_POOL' ? 'warmup' : 'pool';
            const currentCount = await this.getSentTodayCount(targetEmail, accountType);

            if (currentCount > 0) {
                const newCount = currentCount - 1;

                if (accountType === 'warmup') {
                    let account = await GoogleUser.findOne({ where: { email: targetEmail } }) ||
                        await MicrosoftUser.findOne({ where: { email: targetEmail } }) ||
                        await SmtpAccount.findOne({ where: { email: targetEmail } });

                    if (account) {
                        if (account instanceof GoogleUser) {
                            await GoogleUser.update({ current_day_sent: newCount }, { where: { email: targetEmail } });
                        } else if (account instanceof MicrosoftUser) {
                            await MicrosoftUser.update({ current_day_sent: newCount }, { where: { email: targetEmail } });
                        } else if (account instanceof SmtpAccount) {
                            await SmtpAccount.update({ current_day_sent: newCount }, { where: { email: targetEmail } });
                        }
                    }
                } else {
                    await EmailPool.update({ currentDaySent: newCount }, { where: { email: targetEmail } });
                }

                console.log(`✅ REVERSED COUNT: ${targetEmail} - ${currentCount} → ${newCount}`);
            }

        } catch (error) {
            console.error(`❌ Error reversing scheduled email for ${targetEmail}:`, error);
        }
    }

    // 🚨 FIXED: Get daily summary
    async getDailySummary(email, accountType = 'warmup') {
        try {
            const [volumeLimit, sentToday] = await Promise.all([
                this.getAccountVolumeLimit(email, accountType),
                this.getSentTodayCount(email, accountType)
            ]);

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
                volumeLimit: 3,
                remaining: 3,
                percentage: 0,
                canSendMore: true
            };
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


}

const volumeEnforcement = new VolumeEnforcement();
module.exports = volumeEnforcement;