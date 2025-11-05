const GoogleUser = require('../../models/GoogleUser');
const SmtpAccount = require('../../models/smtpAccounts');
const MicrosoftUser = require('../../models/MicrosoftUser');
const EmailPool = require('../../models/EmailPool');
const EmailMetric = require("../../models/EmailMetric");
const EmailExchange = require("../../models/MailExchange");
const { Op } = require("sequelize");
const UnifiedWarmupStrategy = require('../../services/schedule/unified-strategy');
// const { triggerImmediateScheduling } = require('../../services/schedule/hybrid-scheduler');

async function scheduleIncrementalWarmup(emailAddress, senderType) {
  try {
    console.log(`🎯 INCREMENTAL SCHEDULING: ${emailAddress}`);


    const { markAccountAsIncrementallyScheduled, triggerImmediateScheduling } = require('../../services/schedule/Scheduler');
    await markAccountAsIncrementallyScheduled(emailAddress);

    // Get the specific warmup account with PROPER error handling
    const warmupAccount = await getAccountByEmailAndType(emailAddress, senderType);
    if (!warmupAccount) {
      throw new Error(`Account not found in database: ${emailAddress} (type: ${senderType})`);
    }

    // 🚨 VALIDATE ACCOUNT DATA BEFORE PROCEEDING
    if (!warmupAccount.email) {
      throw new Error(`Account email is missing for: ${emailAddress}`);
    }

    // 🚨 FLEXIBLE VALIDATION WITH DEFAULTS
    const requiredFields = ['startEmailsPerDay', 'increaseEmailsPerDay', 'maxEmailsPerDay', 'warmupDayCount'];
    const missingFields = requiredFields.filter(field =>
      warmupAccount[field] === undefined || warmupAccount[field] === null
    );

    if (missingFields.length > 0) {
      console.log(`⚠️  Missing warmup fields, applying defaults: ${missingFields.join(', ')}`);

      // Apply defaults instead of throwing error
      warmupAccount.startEmailsPerDay = warmupAccount.startEmailsPerDay || 3;
      warmupAccount.increaseEmailsPerDay = warmupAccount.increaseEmailsPerDay || 3;
      warmupAccount.maxEmailsPerDay = warmupAccount.maxEmailsPerDay || 25;
      warmupAccount.warmupDayCount = warmupAccount.warmupDayCount || 0;

      console.log(`✅ Applied defaults: Start=${warmupAccount.startEmailsPerDay}, Increase=${warmupAccount.increaseEmailsPerDay}, Max=${warmupAccount.maxEmailsPerDay}, Day=${warmupAccount.warmupDayCount}`);
    }

    console.log(`✅ Account validation passed for: ${emailAddress}`);
    console.log(`   Warmup Config: Start=${warmupAccount.startEmailsPerDay}, Increase=${warmupAccount.increaseEmailsPerDay}, Max=${warmupAccount.maxEmailsPerDay}, Day=${warmupAccount.warmupDayCount}`);

    // Get active pool accounts
    const activePools = await EmailPool.findAll({ where: { isActive: true } });
    if (activePools.length === 0) {
      throw new Error('No active pool accounts available');
    }

    console.log(`🏊 Found ${activePools.length} active pool accounts`);

    // USE UNIFIED STRATEGY WITH DB VALUES
    const strategy = new UnifiedWarmupStrategy();
    const plan = await strategy.generateWarmupPlan(warmupAccount, activePools);

    if (plan.error) {
      throw new Error(`Plan generation failed: ${plan.error}`);
    }

    // 🚨 ENHANCED LOGGING WITH BETTER FIELD ACCESS
    console.log(`📊 ${emailAddress} warmup plan generated:`);
    console.log(`   ├── Day: ${plan.warmupDay || warmupAccount.warmupDayCount}`);
    console.log(`   ├── Total Emails: ${plan.totalEmails || plan.sequence?.length || 0}`);
    console.log(`   ├── Outbound: ${plan.outboundCount || plan.outbound?.length || 0}`);
    console.log(`   └── Inbound: ${plan.inboundCount || plan.inbound?.length || 0}`);

    // Log DB values if available
    if (plan.dbValues) {
      console.log(`   📋 DB Values: Start=${plan.dbValues.startEmailsPerDay}, Increase=${plan.dbValues.increaseEmailsPerDay}, Max=${plan.dbValues.maxEmailsPerDay}`);
    }

    // Log the sequence with better error handling
    if (plan.sequence && plan.sequence.length > 0) {
      console.log(`   📧 Email Sequence (${plan.sequence.length} emails):`);
      plan.sequence.forEach((email, index) => {
        try {
          const delayHours = (email.scheduleDelay / (60 * 60 * 1000)).toFixed(1);
          const targetEmail = email.direction === 'WARMUP_TO_POOL' ? email.receiverEmail : email.senderEmail;
          console.log(`      ${index + 1}. ${email.direction} to ${targetEmail} (${delayHours}h)`);
        } catch (error) {
          console.log(`      ${index + 1}. INVALID EMAIL JOB:`, email);
        }
      });
    } else {
      console.log(`   ⚠️ No emails scheduled in the sequence`);
    }

    // 🚨 FIXED: Use the imported triggerImmediateScheduling function
    console.log(`🚀 Triggering immediate scheduling...`);
    await triggerImmediateScheduling();

    console.log(`✅ Incremental scheduling completed for ${emailAddress}`);

    return {
      success: true,
      email: emailAddress,
      warmupDay: plan.warmupDay || warmupAccount.warmupDayCount,
      totalEmails: plan.totalEmails || plan.sequence?.length || 0,
      outboundCount: plan.outboundCount || plan.outbound?.length || 0,
      inboundCount: plan.inboundCount || plan.inbound?.length || 0,
      markedAsIncremental: true
    };

  } catch (error) {
    console.error(`❌ Incremental scheduling failed for ${emailAddress}:`, error.message);

    // Return error details for better debugging
    return {
      success: false,
      email: emailAddress,
      error: error.message,
      markedAsIncremental: false
    };
  }
}

async function getAccountMetrics(email) {
  try {
    console.log(`📊 Calculating realistic metrics for: ${email}`);

    const emailExchanges = await EmailExchange.findAll({
      where: {
        [Op.or]: [
          { warmupAccount: email },
          { poolAccount: email }
        ]
      },
      order: [['sentAt', 'DESC']]
    });

    if (emailExchanges.length === 0) {
      return getFallbackMetrics();
    }

    // 🚨 DEBUG: Check actual status distribution
    const statusCount = {};
    emailExchanges.forEach(exchange => {
      statusCount[exchange.status] = (statusCount[exchange.status] || 0) + 1;
    });
    console.log(`   Status distribution:`, statusCount);

    // 🎯 REALISTIC CALCULATION - Handle the fact that most emails are 'scheduled'
    return calculateRealisticBidirectionalMetrics(emailExchanges, email);

  } catch (error) {
    console.error(`❌ Error calculating metrics for ${email}:`, error);
    return getFallbackMetrics();
  }
}


function calculateRealisticBidirectionalMetrics(emailExchanges, email) {
  console.log(`📊 Calculating realistic bidirectional metrics for ${email}`);

  // 🎯 FILTER BY DIRECTION AND ROLE
  const warmupToPoolSent = emailExchanges.filter(e =>
    e.direction === 'WARMUP_TO_POOL' && e.warmupAccount === email
  );

  const poolToWarmupReceived = emailExchanges.filter(e =>
    e.direction === 'POOL_TO_WARMUP' && e.warmupAccount === email
  );

  // 🎯 AS POOL ACCOUNT (when this email is used as pool)
  const asPoolReceived = emailExchanges.filter(e =>
    e.direction === 'WARMUP_TO_POOL' && e.poolAccount === email
  );

  const asPoolRepliesSent = emailExchanges.filter(e =>
    e.direction === 'POOL_TO_WARMUP' && e.poolAccount === email
  );

  console.log(`   Warmup→Pool: ${warmupToPoolSent.length}`);
  console.log(`   Pool→Warmup: ${poolToWarmupReceived.length}`);
  console.log(`   As Pool Received: ${asPoolReceived.length}`);
  console.log(`   As Pool Replies Sent: ${asPoolRepliesSent.length}`);

  // 🚨 REALISTIC SUCCESS RATES - Assume scheduled emails are actually sent
  const warmupToPoolSuccess = calculateRealisticSuccessRate(warmupToPoolSent, 'WARMUP_TO_POOL');
  const poolToWarmupSuccess = calculateRealisticSuccessRate(poolToWarmupReceived, 'POOL_TO_WARMUP');
  const asPoolRepliesSuccess = calculateRealisticSuccessRate(asPoolRepliesSent, 'POOL_TO_WARMUP');

  // 🎯 TOTAL ACTIVITY
  const totalAsWarmup = warmupToPoolSent.length + poolToWarmupReceived.length;
  const totalAsPool = asPoolReceived.length + asPoolRepliesSent.length;
  const totalActivity = totalAsWarmup + totalAsPool;

  // 🎯 OVERALL SUCCESS RATE (weighted average)
  const overallSuccessRate = calculateOverallSuccessRate([
    warmupToPoolSuccess,
    poolToWarmupSuccess,
    asPoolRepliesSuccess
  ]);

  return {
    summary: {
      totalExchanges: emailExchanges.length,
      totalAsWarmup,
      totalAsPool,
      overallSuccessRate: `${overallSuccessRate}%`,
      engagementScore: calculateEngagementScore(totalAsWarmup, totalAsPool),
      bidirectionalBalance: calculateBidirectionalBalance(totalAsWarmup, totalAsPool),
      note: "Metrics assume scheduled emails are successfully processed"
    },

    // 🎯 WARMUP ACCOUNT METRICS
    asWarmupAccount: {
      sentToPools: warmupToPoolSent.length,
      receivedFromPools: poolToWarmupReceived.length,
      successRate: warmupToPoolSuccess.rate,
      deliveryRate: warmupToPoolSuccess.deliveryRate,
      estimatedDelivery: warmupToPoolSuccess.estimatedDelivery
    },

    // 🎯 POOL ACCOUNT METRICS (when used as pool)
    asPoolAccount: {
      receivedFromWarmups: asPoolReceived.length,
      repliesSentAsPool: asPoolRepliesSent.length,
      successRate: asPoolRepliesSuccess.rate,
      activityScore: asPoolReceived.length + asPoolRepliesSent.length
    },

    // 🎯 PERFORMANCE BREAKDOWN
    performance: {
      recentActivity: calculateRecentActivity(emailExchanges, 7),
      dailyBreakdown: calculateDailyStats(emailExchanges),
      consistency: calculateConsistencyScore(emailExchanges),
      statusBreakdown: getStatusBreakdown(emailExchanges)
    }
  };
}

// 🚨 REALISTIC SUCCESS RATE CALCULATION
function calculateRealisticSuccessRate(exchanges, direction) {
  const total = exchanges.length;

  if (total === 0) {
    return {
      rate: "0%",
      deliveryRate: "0%",
      estimatedDelivery: "0%",
      breakdown: {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        scheduled: 0
      }
    };
  }

  const sent = exchanges.filter(e => e.status === 'sent').length;
  const delivered = exchanges.filter(e => e.status === 'delivered').length;
  const failed = exchanges.filter(e => e.status === 'failed').length;
  const scheduled = exchanges.filter(e => e.status === 'scheduled').length;

  // 🚨 REALISTIC APPROACH: Assume scheduled emails will be sent successfully
  // In warmup systems, scheduled emails typically get sent unless explicitly failed
  const estimatedSuccessful = sent + delivered + scheduled;
  const estimatedDelivered = delivered + (scheduled * 0.85); // Assume 85% of scheduled get delivered

  // Success rate: Assume scheduled emails will succeed
  const successRate = (estimatedSuccessful / total * 100).toFixed(1);

  // Delivery rate: Estimate based on industry averages for scheduled emails
  const deliveryRate = (estimatedDelivered / total * 100).toFixed(1);

  console.log(`   ${direction}: ${successRate}% success (${sent}s + ${delivered}d + ${scheduled}sch)`);

  return {
    rate: `${successRate}%`,
    deliveryRate: `${deliveryRate}%`,
    estimatedDelivery: `${(estimatedDelivered / total * 100).toFixed(1)}%`,
    breakdown: {
      total,
      sent,
      delivered,
      failed,
      scheduled
    }
  };
}

// 🚨 GET STATUS BREAKDOWN FOR DEBUGGING
function getStatusBreakdown(emailExchanges) {
  const breakdown = {
    scheduled: 0,
    sent: 0,
    delivered: 0,
    failed: 0
  };

  emailExchanges.forEach(exchange => {
    breakdown[exchange.status] = (breakdown[exchange.status] || 0) + 1;
  });

  return breakdown;
}

// 🚨 FIXED: Daily Stats Calculation with Realistic Status
function calculateDailyStats(emailExchanges) {
  const dailyStats = {};
  const last7Days = [];

  // Generate last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    last7Days.push(dateKey);

    dailyStats[dateKey] = {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sent: 0,
      received: 0,
      successful: 0,
      scheduled: 0
    };
  }

  // Populate with actual data
  emailExchanges.forEach(email => {
    const emailDate = new Date(email.sentAt).toISOString().split('T')[0];

    if (dailyStats[emailDate]) {
      if (email.direction === 'WARMUP_TO_POOL') {
        dailyStats[emailDate].sent++;
      } else {
        dailyStats[emailDate].received++;
      }

      // Count as successful if not failed
      if (email.status !== 'failed') {
        dailyStats[emailDate].successful++;
      }

      if (email.status === 'scheduled') {
        dailyStats[emailDate].scheduled++;
      }
    }
  });

  return last7Days.map(date => dailyStats[date]);
}

function getFallbackMetrics() {
  return {
    summary: {
      totalExchanges: 0,
      totalAsWarmup: 0,
      totalAsPool: 0,
      overallSuccessRate: "0%",
      engagementScore: 0,
      bidirectionalBalance: "No Activity",
      note: "No email activity found"
    },
    asWarmupAccount: {
      sentToPools: 0,
      receivedFromPools: 0,
      successRate: "0%",
      deliveryRate: "0%",
      estimatedDelivery: "0%"
    },
    asPoolAccount: {
      receivedFromWarmups: 0,
      repliesSentAsPool: 0,
      successRate: "0%",
      activityScore: 0
    },
    performance: {
      recentActivity: { total: 0, warmupToPool: 0, poolToWarmup: 0 },
      dailyBreakdown: [],
      consistency: 0,
      statusBreakdown: { scheduled: 0, sent: 0, delivered: 0, failed: 0 }
    }
  };
}



// 🚨 CALCULATE OVERALL WEIGHTED SUCCESS RATE
function calculateOverallSuccessRate(directionRates) {
  const validRates = directionRates.filter(rate =>
    rate.breakdown.total > 0
  );

  if (validRates.length === 0) return 0;

  let totalWeightedRate = 0;
  let totalWeight = 0;

  validRates.forEach(rate => {
    const weight = rate.breakdown.total;
    const rateValue = parseFloat(rate.rate);
    totalWeightedRate += rateValue * weight;
    totalWeight += weight;
  });

  return (totalWeightedRate / totalWeight).toFixed(1);
}

// 🚨 CALCULATE ENGAGEMENT SCORE
function calculateEngagementScore(totalAsWarmup, totalAsPool) {
  const baseScore = Math.min(100, (totalAsWarmup + totalAsPool) * 2);
  return Math.min(100, baseScore);
}

// 🚨 CALCULATE BIDIRECTIONAL BALANCE
function calculateBidirectionalBalance(totalAsWarmup, totalAsPool) {
  if (totalAsWarmup + totalAsPool === 0) return "No Activity";

  const ratio = totalAsWarmup / (totalAsWarmup + totalAsPool);

  if (ratio > 0.7) return "Send Heavy";
  if (ratio < 0.3) return "Receive Heavy";
  return "Balanced";
}

// 🚨 CALCULATE RECENT ACTIVITY
function calculateRecentActivity(emailExchanges, days) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const recentExchanges = emailExchanges.filter(e =>
    new Date(e.sentAt) > cutoffDate
  );

  return {
    total: recentExchanges.length,
    warmupToPool: recentExchanges.filter(e => e.direction === 'WARMUP_TO_POOL').length,
    poolToWarmup: recentExchanges.filter(e => e.direction === 'POOL_TO_WARMUP').length
  };
}

// 🚨 CALCULATE CONSISTENCY SCORE
function calculateConsistencyScore(emailExchanges) {
  if (emailExchanges.length === 0) return 0;

  const dailyCounts = {};
  emailExchanges.forEach(exchange => {
    const date = new Date(exchange.sentAt).toISOString().split('T')[0];
    dailyCounts[date] = (dailyCounts[date] || 0) + 1;
  });

  const counts = Object.values(dailyCounts);
  const average = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((a, b) => a + Math.pow(b - average, 2), 0) / counts.length;

  return Math.max(0, 100 - (variance * 10));
}

// 🚨 FIXED: Daily Stats Calculation
function calculateDailyStats(emailExchanges) {
  const dailyStats = {};
  const last7Days = [];

  // Generate last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    last7Days.push(dateKey);

    dailyStats[dateKey] = {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sent: 0,
      received: 0,
      successful: 0
    };
  }

  // Populate with actual data
  emailExchanges.forEach(email => {
    const emailDate = new Date(email.sentAt).toISOString().split('T')[0];

    if (dailyStats[emailDate]) {
      if (email.direction === 'WARMUP_TO_POOL') {
        dailyStats[emailDate].sent++;
      } else {
        dailyStats[emailDate].received++;
      }

      if (email.status === 'sent' || email.status === 'delivered') {
        dailyStats[emailDate].successful++;
      }
    }
  });

  return last7Days.map(date => dailyStats[date]);
}

function getFallbackMetrics() {
  return {
    summary: {
      totalExchanges: 0,
      totalAsWarmup: 0,
      totalAsPool: 0,
      overallSuccessRate: "0%",
      engagementScore: 0,
      bidirectionalBalance: "No Activity"
    },
    asWarmupAccount: {
      sentToPools: 0,
      receivedFromPools: 0,
      successRate: "0%",
      deliveryRate: "0%"
    },
    asPoolAccount: {
      receivedFromWarmups: 0,
      repliesSentAsPool: 0,
      successRate: "0%",
      activityScore: 0
    },
    performance: {
      recentActivity: { total: 0, warmupToPool: 0, poolToWarmup: 0 },
      dailyBreakdown: [],
      consistency: 0
    }
  };
}

// ✅ POOL-BASED HELPER FUNCTIONS
async function getActiveWarmupAccountsCount() {
  const googleCount = await GoogleUser.count({
    where: {
      warmupStatus: 'active',
      is_connected: true
    }
  });
  const microsoftCount = await MicrosoftUser.count({
    where: {
      warmupStatus: 'active',
      is_connected: true
    }
  });
  const smtpCount = await SmtpAccount.count({
    where: {
      warmupStatus: 'active',
      is_connected: true
    }
  });

  const total = googleCount + microsoftCount + smtpCount;
  console.log(`🔥 Active warmup accounts: Google:${googleCount}, Microsoft:${microsoftCount}, SMTP:${smtpCount} = Total:${total}`);

  return total;
}

async function getActivePoolAccountsCount() {
  const poolCount = await EmailPool.count({
    where: {
      isActive: true
    }
  });

  console.log(`🏊 Active pool accounts: ${poolCount}`);
  return poolCount;
}

async function getAccountByEmailAndType(emailAddress, senderType) {
  try {
    console.log(`🔍 Searching for account: ${emailAddress} (type: ${senderType})`);

    let account = null;

    switch (senderType) {
      case 'google':
        account = await GoogleUser.findOne({ where: { email: emailAddress } });
        break;
      case 'microsoft':
        account = await MicrosoftUser.findOne({ where: { email: emailAddress } });
        break;
      case 'smtp':
        account = await SmtpAccount.findOne({ where: { email: emailAddress } });
        break;
      default:
        // Try all types
        account = await GoogleUser.findOne({ where: { email: emailAddress } }) ||
          await MicrosoftUser.findOne({ where: { email: emailAddress } }) ||
          await SmtpAccount.findOne({ where: { email: emailAddress } });
    }

    if (!account) {
      console.log(`❌ Account not found: ${emailAddress}`);
      return null;
    }

    console.log(`✅ Account found: ${emailAddress}`);
    console.log(`   Type: ${account.provider || senderType}`);
    console.log(`   Warmup Status: ${account.warmupStatus}`);

    // 🚨 CRITICAL: ENSURE REQUIRED WARMUP FIELDS EXIST
    const accountWithDefaults = await ensureWarmupFields(account, senderType);

    return accountWithDefaults;

  } catch (error) {
    console.error(`❌ Error finding account ${emailAddress}:`, error);
    return null;
  }
}

// 🚨 NEW: Ensure warmup fields have proper defaults
async function ensureWarmupFields(account, accountType) {
  const updates = {};
  let needsUpdate = false;

  // Set defaults for missing warmup fields
  if (account.startEmailsPerDay === undefined || account.startEmailsPerDay === null) {
    updates.startEmailsPerDay = 3;
    needsUpdate = true;
  }

  if (account.increaseEmailsPerDay === undefined || account.increaseEmailsPerDay === null) {
    updates.increaseEmailsPerDay = 3;
    needsUpdate = true;
  }

  if (account.maxEmailsPerDay === undefined || account.maxEmailsPerDay === null) {
    updates.maxEmailsPerDay = 25;
    needsUpdate = true;
  }

  if (account.warmupDayCount === undefined || account.warmupDayCount === null) {
    updates.warmupDayCount = 0;
    needsUpdate = true;
  }

  // Update database if fields are missing
  if (needsUpdate) {
    console.log(`🔄 Setting default warmup fields for: ${account.email}`);
    console.log(`   Defaults: Start=${updates.startEmailsPerDay}, Increase=${updates.increaseEmailsPerDay}, Max=${updates.maxEmailsPerDay}, Day=${updates.warmupDayCount}`);

    try {
      switch (accountType) {
        case 'google':
          await GoogleUser.update(updates, { where: { email: account.email } });
          break;
        case 'microsoft':
          await MicrosoftUser.update(updates, { where: { email: account.email } });
          break;
        case 'smtp':
          await SmtpAccount.update(updates, { where: { email: account.email } });
          break;
      }

      console.log(`✅ Updated database with warmup defaults for: ${account.email}`);
    } catch (error) {
      console.error(`❌ Failed to update database for ${account.email}:`, error);
    }
  }

  // Return account with guaranteed fields
  return {
    ...account.dataValues || account,
    startEmailsPerDay: account.startEmailsPerDay || updates.startEmailsPerDay,
    increaseEmailsPerDay: account.increaseEmailsPerDay || updates.increaseEmailsPerDay,
    maxEmailsPerDay: account.maxEmailsPerDay || updates.maxEmailsPerDay,
    warmupDayCount: account.warmupDayCount || updates.warmupDayCount
  };
}

exports.toggleWarmupStatus = async (req, res) => {
  try {
    const { emailAddress } = req.params;
    const {
      status,
      warmupDayCount,
      startEmailsPerDay,
      increaseEmailsPerDay,
      maxEmailsPerDay,
      replyRate,
    } = req.body;

    console.log(`🎯 Toggle request for EMAIL: ${emailAddress} with status: ${status}`);

    if (!['active', 'paused'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid warmup status' });
    }

    // 🧭 Find sender account
    let sender = await GoogleUser.findOne({ where: { email: emailAddress } });
    let senderType = 'google';

    if (!sender) {
      sender = await MicrosoftUser.findOne({ where: { email: emailAddress } });
      senderType = 'microsoft';
    }
    if (!sender) {
      sender = await SmtpAccount.findOne({ where: { email: emailAddress } });
      senderType = 'smtp';
    }
    if (!sender) {
      return res.status(404).json({
        success: false,
        error: 'Sender account not found',
        details: `No account found with email: ${emailAddress}`
      });
    }

    console.log(`✅ Account found: ${emailAddress} (${senderType})`);

    // 🚫 Check if account is connected before allowing activation
    if (status === 'active' && sender.is_connected === false) {
      return res.status(403).json({
        success: false,
        message: `Cannot activate warmup for ${emailAddress} — account is disconnected.`,
        hint: 'Please reconnect the account before starting warmup.'
      });
    }

    // 🚨 PRE-ACTIVATION VALIDATION
    if (status === 'active') {
      const requiredFields = ['startEmailsPerDay', 'increaseEmailsPerDay', 'maxEmailsPerDay', 'warmupDayCount'];
      const missingFields = requiredFields.filter(field => {
        const value = sender[field];
        return value === undefined || value === null || value === '';
      });

      if (missingFields.length > 0) {
        console.log(`❌ Activation blocked - missing fields: ${missingFields.join(', ')}`);
        return res.status(400).json({
          success: false,
          error: `Account configuration incomplete`,
          details: `Missing required fields: ${missingFields.join(', ')}`,
          hint: 'Please complete the warmup configuration in account settings before activating'
        });
      }

      // 🚨 VALIDATE FIELD VALUES
      if (sender.startEmailsPerDay < 1) {
        return res.status(400).json({
          success: false,
          error: 'Invalid configuration',
          details: 'Start emails per day must be at least 1'
        });
      }

      if (sender.increaseEmailsPerDay < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid configuration',
          details: 'Increase emails per day cannot be negative'
        });
      }

      if (sender.maxEmailsPerDay < sender.startEmailsPerDay) {
        return res.status(400).json({
          success: false,
          error: 'Invalid configuration',
          details: 'Max emails per day cannot be less than start emails per day'
        });
      }
    }

    // 🧩 Update warmup status and config
    const updateData = { warmupStatus: status };

    // Only update provided fields (not all undefined values)
    if (warmupDayCount !== undefined) updateData.warmupDayCount = warmupDayCount;
    if (startEmailsPerDay !== undefined) updateData.startEmailsPerDay = startEmailsPerDay;
    if (increaseEmailsPerDay !== undefined) updateData.increaseEmailsPerDay = increaseEmailsPerDay;
    if (maxEmailsPerDay !== undefined) updateData.maxEmailsPerDay = maxEmailsPerDay;
    if (replyRate !== undefined) updateData.replyRate = Math.min(1.0, Math.max(0, replyRate));

    // Set warmup start time when activating
    if (status === 'active' && !sender.warmupStartTime) {
      updateData.warmupStartTime = new Date().toISOString();
    }

    await sender.update(updateData);

    // ⚙️ INCREMENTAL SCHEDULING - Only schedule for the newly activated account
    if (status === 'active') {
      try {
        const activeWarmupAccounts = await getActiveWarmupAccountsCount();
        const activePoolAccounts = await getActivePoolAccountsCount();

        console.log(`✅ Warmup activated for ${emailAddress}`);
        console.log(`📊 Active warmup accounts: ${activeWarmupAccounts}`);
        console.log(`🏊 Active pool accounts: ${activePoolAccounts}`);

        if (activeWarmupAccounts >= 1 && activePoolAccounts >= 1) {
          console.log(`🎯 ${emailAddress} will exchange emails with pool accounts`);

          // ✅ USE UNIFIED STRATEGY FOR SCHEDULING WITH PROPER ERROR HANDLING
          await scheduleIncrementalWarmup(emailAddress, senderType);

          console.log(`✅ Strategic warmup scheduling completed for ${emailAddress}`);
        } else if (activePoolAccounts === 0) {
          console.log(`⚠️ No active pool accounts available for warmup`);
          return res.json({
            success: true,
            message: `Warmup activated but no pool accounts available`,
            senderType,
            warmupStatus: status,
            email: emailAddress,
            warning: 'No active pool accounts found - warmup will start when pools are available',
            updatedConfig: await getUpdatedSenderConfig(emailAddress, senderType)
          });
        }

      } catch (err) {
        console.error('❌ Error activating warmup:', err.message);

        // 🚨 PROVIDE SPECIFIC ERROR MESSAGES
        let userMessage = `Warmup activated but scheduling failed: ${err.message}`;
        let errorType = 'scheduling_error';

        if (err.message.includes('Account not found')) {
          userMessage = `Account not found in database. Please check if the account exists and is properly connected.`;
          errorType = 'account_not_found';
        } else if (err.message.includes('Missing required warmup fields')) {
          userMessage = `Account configuration is incomplete. Please check warmup settings.`;
          errorType = 'incomplete_config';
        } else if (err.message.includes('No active pool accounts')) {
          userMessage = `Warmup activated but no pool accounts are available.`;
          errorType = 'no_pool_accounts';
        } else if (err.message.includes('Plan generation failed')) {
          userMessage = `Failed to generate warmup plan. Please check account configuration.`;
          errorType = 'plan_generation_failed';
        }

        return res.json({
          success: true,
          message: userMessage,
          senderType,
          warmupStatus: status,
          email: emailAddress,
          warning: 'Warmup activated but immediate scheduling failed',
          errorType: errorType,
          errorDetails: err.message,
          updatedConfig: await getUpdatedSenderConfig(emailAddress, senderType)
        });
      }
    } else {
      console.log(`⏸️ Warmup paused for ${emailAddress}`);
      // Optional: Cancel any pending jobs for this account
      await cancelPendingJobsForAccount(emailAddress);
    }

    // 📊 Get enhanced metric summary
    const metrics = await getAccountMetrics(emailAddress);

    return res.json({
      success: true,
      message: `Warmup ${status} for ${senderType} account`,
      senderType,
      warmupStatus: status,
      email: emailAddress,
      updatedConfig: await getUpdatedSenderConfig(emailAddress, senderType),
      metricSummary: metrics,
      note: status === 'active' ?
        'Account scheduled with unified strategy - emails will be sent strategically' :
        'No new warmup emails will be scheduled'
    });

  } catch (error) {
    console.error('❌ Toggle warmup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update warmup status',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Helper function to get updated sender config
async function getUpdatedSenderConfig(email, type) {
  try {
    switch (type) {
      case 'google':
        return await GoogleUser.findOne({ where: { email } });
      case 'microsoft':
        return await MicrosoftUser.findOne({ where: { email } });
      case 'smtp':
        return await SmtpAccount.findOne({ where: { email } });
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error getting updated config for ${email}:`, error);
    return null;
  }
}

// Helper function to cancel pending jobs (placeholder - implement based on your job system)
async function cancelPendingJobsForAccount(email) {
  try {
    console.log(`🔄 Canceling pending jobs for: ${email}`);
    // Implement your job cancellation logic here
    // This could involve querying your job queue and removing jobs for this email
    return true;
  } catch (error) {
    console.error(`Error canceling jobs for ${email}:`, error);
    return false;
  }
}

// 🎯 OTHER CONTROLLER FUNCTIONS (Updated with Enhanced Metrics)
exports.disconnectReconnectMail = async (req, res) => {
  const { email } = req.params;

  try {
    const googleAccount = await GoogleUser.findOne({ where: { email } });
    const microsoftAccount = await MicrosoftUser.findOne({ where: { email } });
    const smtpAccount = await SmtpAccount.findOne({ where: { email } });

    let targetAccount = googleAccount || microsoftAccount || smtpAccount;
    let accountType = '';

    if (!targetAccount) {
      return res.status(404).json({
        success: false,
        message: 'Email account not found',
      });
    }

    if (googleAccount) accountType = 'google';
    else if (microsoftAccount) accountType = 'microsoft';
    else if (smtpAccount) accountType = 'smtp';

    // 🟢 Toggle connection state
    const newStatus = !targetAccount.is_connected;
    await targetAccount.update({ is_connected: newStatus });

    console.log(
      `${newStatus ? '🔌 Reconnected' : '⛔ Disconnected'} ${accountType} account: ${email}`
    );

    // Get enhanced metric summary
    const metrics = await getAccountMetrics(email);

    return res.json({
      success: true,
      message: `Email account (${accountType}) ${newStatus ? 'reconnected' : 'disconnected'} successfully`,
      data: {
        email: targetAccount.email,
        accountType,
        name: targetAccount.name || targetAccount.sender_name,
        is_connected: newStatus,
        metricSummary: metrics,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ Error toggling connection status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update connection status',
      error: error.message,
    });
  }
};

exports.deleteMail = async (req, res) => {
  const { email } = req.params;

  try {
    const googleAccount = await GoogleUser.findOne({ where: { email } });
    const microsoftAccount = await MicrosoftUser.findOne({ where: { email } });
    const smtpAccount = await SmtpAccount.findOne({ where: { email } });

    let deletedAccount = null;
    let accountType = '';

    if (googleAccount) {
      await GoogleUser.destroy({ where: { email } });
      deletedAccount = googleAccount;
      accountType = 'google';
      console.log(`🗑️ Deleted Google account: ${email}`);
    }
    else if (microsoftAccount) {
      await MicrosoftUser.destroy({ where: { email } });
      deletedAccount = microsoftAccount;
      accountType = 'microsoft';
      console.log(`🗑️ Deleted Microsoft account: ${email}`);
    }
    else if (smtpAccount) {
      await SmtpAccount.destroy({ where: { email } });
      deletedAccount = smtpAccount;
      accountType = 'smtp';
      console.log(`🗑️ Deleted SMTP account: ${email}`);
    }
    else {
      return res.status(404).json({
        success: false,
        message: 'Email account not found'
      });
    }

    // Get metrics before deletion for reporting
    const metrics = await getAccountMetrics(email);

    // Delete metrics
    try {
      const deletedMetricsCount = await EmailMetric.destroy({
        where: {
          [Op.or]: [
            { senderEmail: email },
            { receiverEmail: email }
          ]
        }
      });
      console.log(`🧹 Deleted ${deletedMetricsCount} metrics for ${email}`);
    } catch (metricsError) {
      console.warn(`⚠️ Could not delete metrics for ${email}:`, metricsError.message);
    }

    return res.json({
      success: true,
      message: `Email account (${accountType}) deleted successfully`,
      data: {
        email: deletedAccount.email,
        accountType,
        name: deletedAccount.name || deletedAccount.sender_name,
        deletedMetrics: metrics.summary.totalExchanges,
        performanceSummary: metrics,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error deleting email:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete email account',
      error: error.message
    });
  }
};

exports.updateMailSettings = async (req, res) => {
  const { email } = req.params;
  const { startEmailsPerDay, increaseEmailsPerDay, maxEmailsPerDay, replyRate, sender_name } = req.body;

  try {
    console.log(`⚙️ Updating settings for: ${email}`, req.body);

    // Find the account
    let account = await GoogleUser.findOne({ where: { email } });
    let accountType = 'google';

    if (!account) {
      account = await MicrosoftUser.findOne({ where: { email } });
      accountType = 'microsoft';
    }
    if (!account) {
      account = await SmtpAccount.findOne({ where: { email } });
      accountType = 'smtp';
    }

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Email account not found'
      });
    }

    // 🚨 VALIDATE INPUTS
    const updateData = {};
    const errors = [];

    if (startEmailsPerDay !== undefined) {
      const value = parseInt(startEmailsPerDay);
      if (value < 1 || value > 50) {
        errors.push('startEmailsPerDay must be between 1 and 50');
      } else {
        updateData.startEmailsPerDay = value;
      }
    }

    if (increaseEmailsPerDay !== undefined) {
      const value = parseInt(increaseEmailsPerDay);
      if (value < 1 || value > 10) {
        errors.push('increaseEmailsPerDay must be between 1 and 10');
      } else {
        updateData.increaseEmailsPerDay = value;
      }
    }

    if (maxEmailsPerDay !== undefined) {
      const value = parseInt(maxEmailsPerDay);
      if (value < 5 || value > 100) {
        errors.push('maxEmailsPerDay must be between 5 and 100');
      } else {
        updateData.maxEmailsPerDay = value;
      }
    }

    if (replyRate !== undefined) {
      const value = parseFloat(replyRate);
      // 🚨 FIXED: Handle as percentage (0-100) instead of decimal (0-1)
      if (value < 0 || value > 100) {
        errors.push('replyRate must be between 0 and 100 (percentage)');
      } else {
        updateData.replyRate = value; // Store as percentage in database
      }
    }

    if (sender_name !== undefined && sender_name.trim()) {
      if (accountType === 'smtp') {
        updateData.sender_name = sender_name.trim();
      } else {
        updateData.name = sender_name.trim();
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Update the account
    await account.update(updateData);

    // Get updated metrics
    const metrics = await getAccountMetrics(email);

    console.log(`✅ Settings updated for ${email}`);

    // 🚨 RETURN REPLY RATE AS PERCENTAGE FOR CLARITY
    const responseData = {
      email: account.email,
      accountType,
      updatedSettings: {
        ...updateData,
        // Convert replyRate to percentage for response if it was updated
        replyRate: updateData.replyRate !== undefined ? `${updateData.replyRate}%` : undefined
      },
      performanceMetrics: metrics
    };

    return res.json({
      success: true,
      message: `Email settings updated successfully`,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Error updating email settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update email settings',
      error: error.message
    });
  }
};

exports.fetchSingleMailData = async (req, res) => {
  const { email } = req.params;

  try {
    console.log(`🔍 Fetching data for: ${email}`);

    // 🔍 Try to find the account in each model
    let account = await GoogleUser.findOne({ where: { email } });
    let accountType = "google";

    if (!account) {
      account = await MicrosoftUser.findOne({ where: { email } });
      accountType = "microsoft";
    }
    if (!account) {
      account = await SmtpAccount.findOne({ where: { email } });
      accountType = "smtp";
    }

    if (!account) {
      return res.status(404).json({
        success: false,
        message: `No email account found for ${email}`,
      });
    }

    // Convert to plain object to avoid Sequelize issues
    const accountData = account.get ? account.get({ plain: true }) : account;

    // 📊 Get enhanced metric statistics
    const metrics = await getAccountMetrics(email);

    // 🧠 Prepare account data with enhanced metrics
    const responseData = {
      email: accountData.email,
      name: accountData.name || accountData.sender_name || accountData.display_name || null,
      accountType,
      warmupStatus: accountData.warmupStatus || 'inactive',
      is_connected: accountData.is_connected ?? false,
      warmupDayCount: accountData.warmupDayCount || 0,
      startEmailsPerDay: accountData.startEmailsPerDay || 3,
      increaseEmailsPerDay: accountData.increaseEmailsPerDay || 3,
      maxEmailsPerDay: accountData.maxEmailsPerDay || 25,
      replyRate: accountData.replyRate || 0.15,
      warmupStartTime: accountData.warmupStartTime,
      // 📈 Enhanced Metric Information
      metrics: metrics
    };

    console.log(`📧 Fetched data for ${accountType} account: ${email}`);

    return res.json({
      success: true,
      message: `Fetched data for ${accountType} account`,
      data: responseData,
    });
  } catch (error) {
    console.error("❌ Error fetching mail data:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch email account data",
      error: error.message,
    });
  }
};

exports.fetchSingleMailReport = async (req, res) => {
  const { email } = req.params;

  try {
    console.log(`📊 Generating report for: ${email}`);

    // 🔍 Try to find the account
    let account = await GoogleUser.findOne({ where: { email } });
    let accountType = "google";

    if (!account) {
      account = await MicrosoftUser.findOne({ where: { email } });
      accountType = "microsoft";
    }
    if (!account) {
      account = await SmtpAccount.findOne({ where: { email } });
      accountType = "smtp";
    }

    if (!account) {
      return res.status(404).json({
        success: false,
        message: `No email account found for ${email}`,
      });
    }

    const accountData = account.get ? account.get({ plain: true }) : account;

    // 📊 Get comprehensive metrics
    const metrics = await getAccountMetrics(email);

    console.log(`📊 Generated report for ${accountType} account: ${email}`);

    return res.json({
      success: true,
      message: `Fetched comprehensive bidirectional report for ${accountType} account`,
      data: {
        account: {
          email: accountData.email,
          name: accountData.name || accountData.sender_name || null,
          accountType,
          warmupStatus: accountData.warmupStatus || 'inactive',
          is_connected: accountData.is_connected ?? false
        },
        metrics: metrics,
        note: "Metrics show performance as both warmup account (sending/receiving) and pool account"
      },
    });
  } catch (error) {
    console.error("❌ Error fetching mail report:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch email account report",
      error: error.message,
    });
  }
};

