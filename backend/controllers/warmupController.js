const GoogleUser = require('../models/GoogleUser');
const SmtpAccount = require('../models/smtpAccounts');
const MicrosoftUser = require('../models/MicrosoftUser');
const EmailPool = require('../models/EmailPool');
const EmailMetric = require("../models/EmailMetric");
const { Op } = require("sequelize");
const UnifiedWarmupStrategy = require('../services/unified-strategy');
const { triggerImmediateScheduling } = require('../services/hybrid-scheduler');

async function scheduleIncrementalWarmup(emailAddress, senderType) {
  try {
    console.log(`🎯 Starting incremental scheduling for: ${emailAddress}`);

    // Get the specific warmup account with PROPER error handling
    const warmupAccount = await getAccountByEmailAndType(emailAddress, senderType);
    if (!warmupAccount) {
      throw new Error(`Account not found in database: ${emailAddress} (type: ${senderType})`);
    }

    // 🚨 VALIDATE ACCOUNT DATA BEFORE PROCEEDING
    if (!warmupAccount.email) {
      throw new Error(`Account email is missing for: ${emailAddress}`);
    }

    // 🚨 VALIDATE REQUIRED WARMUP FIELDS
    const requiredFields = ['startEmailsPerDay', 'increaseEmailsPerDay', 'maxEmailsPerDay', 'warmupDayCount'];
    const missingFields = requiredFields.filter(field => warmupAccount[field] === undefined || warmupAccount[field] === null);

    if (missingFields.length > 0) {
      throw new Error(`Missing required warmup fields for ${emailAddress}: ${missingFields.join(', ')}`);
    }

    console.log(`✅ Account validation passed for: ${emailAddress}`);
    console.log(`   Warmup Config: Start=${warmupAccount.startEmailsPerDay}, Increase=${warmupAccount.increaseEmailsPerDay}, Max=${warmupAccount.maxEmailsPerDay}, Day=${warmupAccount.warmupDayCount}`);

    // Get active pool accounts
    const activePools = await EmailPool.findAll({ where: { isActive: true } });
    if (activePools.length === 0) {
      throw new Error('No active pool accounts available');
    }

    // USE UNIFIED STRATEGY WITH DB VALUES
    const strategy = new UnifiedWarmupStrategy();
    const plan = await strategy.generateWarmupPlan(warmupAccount, activePools);

    if (plan.error) {
      throw new Error(`Plan generation failed: ${plan.error}`);
    }

    console.log(`📊 ${emailAddress} needs ${plan.totalEmails} emails today (Day ${plan.warmupDay})`);
    console.log(`   DB Values: Start=${plan.dbValues.startEmailsPerDay}, Increase=${plan.dbValues.increaseEmailsPerDay}, Max=${plan.dbValues.maxEmailsPerDay}`);
    console.log(`   Strategy: ${plan.outbound.length} outbound → ${plan.inbound.length} inbound`);

    // Log the sequence
    if (plan.sequence && plan.sequence.length > 0) {
      plan.sequence.forEach((email, index) => {
        const delayHours = (email.scheduleDelay / (60 * 60 * 1000)).toFixed(1);
        console.log(`   ${index + 1}. ${email.direction} to ${email.receiverEmail || email.senderEmail} (${delayHours}h)`);
      });
    } else {
      console.log(`   ⚠️ No emails scheduled in the sequence`);
    }

    // Schedule using hybrid scheduler's immediate scheduling
    await triggerImmediateScheduling();

    console.log(`✅ Incremental scheduling completed for ${emailAddress}`);

  } catch (error) {
    console.error(`❌ Incremental scheduling failed for ${emailAddress}:`, error.message);
    throw error;
  }
}

// 📊 ENHANCED METRIC CALCULATION FUNCTIONS
async function getAccountMetrics(emailAddress) {
  try {
    const metrics = await EmailMetric.findAll({
      where: {
        senderEmail: emailAddress
      },
      order: [['sentAt', 'DESC']]
    });

    const totalSent = metrics.length;
    const completed = metrics.filter(m => m.status === 'completed').length;
    const failed = metrics.filter(m => m.status === 'failed').length;
    const pending = metrics.filter(m => m.status === 'pending').length;

    const delivered = metrics.filter(m => m.deliveredInbox === true).length;
    const replied = metrics.filter(m => m.replied === true).length;

    const deliveryRate = totalSent > 0 ? (delivered / totalSent * 100).toFixed(1) : 0;
    const replyRate = totalSent > 0 ? (replied / totalSent * 100).toFixed(1) : 0;
    const successRate = totalSent > 0 ? (completed / totalSent * 100).toFixed(1) : 0;

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentMetrics = metrics.filter(m => new Date(m.sentAt) > sevenDaysAgo);

    const recentSent = recentMetrics.length;
    const recentDelivered = recentMetrics.filter(m => m.deliveredInbox === true).length;
    const recentReplied = recentMetrics.filter(m => m.replied === true).length;
    const recentDeliveryRate = recentSent > 0 ? (recentDelivered / recentSent * 100).toFixed(1) : 0;

    return {
      summary: {
        totalSent,
        completed,
        failed,
        pending,
        delivered,
        replied,
        successRate: `${successRate}%`,
        deliveryRate: `${deliveryRate}%`,
        replyRate: `${replyRate}%`
      },
      recentActivity: {
        last7Days: {
          sent: recentSent,
          delivered: recentDelivered,
          replied: recentReplied,
          deliveryRate: `${recentDeliveryRate}%`
        }
      },
      performance: {
        avgDeliveryRate: `${deliveryRate}%`,
        avgReplyRate: `${replyRate}%`,
        engagementScore: calculateEngagementScore(deliveryRate, replyRate)
      },
      lastSent: metrics[0]?.sentAt || null,
      lastDeliveryStatus: metrics[0]?.deliveredInbox ? 'Delivered' : 'Failed'
    };
  } catch (error) {
    console.error('Error calculating metrics:', error);
    return getFallbackMetrics();
  }
}

function calculateEngagementScore(deliveryRate, replyRate) {
  const score = (parseFloat(deliveryRate) * 0.7) + (parseFloat(replyRate) * 0.3);
  return Math.min(100, Math.round(score));
}

function getFallbackMetrics() {
  return {
    summary: {
      totalSent: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      delivered: 0,
      replied: 0,
      successRate: "0%",
      deliveryRate: "0%",
      replyRate: "0%"
    },
    recentActivity: {
      last7Days: {
        sent: 0,
        delivered: 0,
        replied: 0,
        deliveryRate: "0%"
      }
    },
    performance: {
      avgDeliveryRate: "0%",
      avgReplyRate: "0%",
      engagementScore: 0
    },
    lastSent: null,
    lastDeliveryStatus: 'No emails sent'
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

async function getAccountByEmailAndType(email, type) {
  try {
    console.log(`🔍 Searching for account: ${email} (type: ${type})`);

    let account = null;
    switch (type) {
      case 'google':
        account = await GoogleUser.findOne({
          where: {
            email: email,
            warmupStatus: 'active'
          },
          raw: true
        });
        break;
      case 'microsoft':
        account = await MicrosoftUser.findOne({
          where: {
            email: email,
            warmupStatus: 'active'
          },
          raw: true
        });
        break;
      case 'smtp':
        account = await SmtpAccount.findOne({
          where: {
            email: email,
            warmupStatus: 'active'
          },
          raw: true
        });
        break;
      default:
        console.log(`❌ Unknown account type: ${type}`);
        return null;
    }

    if (!account) {
      console.log(`❌ Account not found: ${email} (type: ${type})`);
      return null;
    }

    // 🚨 VALIDATE ACCOUNT HAS REQUIRED FIELDS
    console.log(`✅ Account found: ${account.email}`);
    console.log(`   Warmup Status: ${account.warmupStatus}`);
    console.log(`   Is Connected: ${account.is_connected}`);
    console.log(`   Warmup Config: Start=${account.startEmailsPerDay}, Increase=${account.increaseEmailsPerDay}, Max=${account.maxEmailsPerDay}, Day=${account.warmupDayCount}`);

    return account;
  } catch (error) {
    console.error(`❌ Error finding account ${email}:`, error);
    return null;
  }
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
        deletedMetrics: metrics.summary.totalSent,
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
    // Find the account in any table
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

    // Prepare update data
    const updateData = {};

    if (startEmailsPerDay !== undefined) updateData.startEmailsPerDay = parseInt(startEmailsPerDay);
    if (increaseEmailsPerDay !== undefined) updateData.increaseEmailsPerDay = parseInt(increaseEmailsPerDay);
    if (maxEmailsPerDay !== undefined) updateData.maxEmailsPerDay = parseInt(maxEmailsPerDay);
    if (replyRate !== undefined) updateData.replyRate = Math.min(0.25, parseFloat(replyRate)); // Cap at 25%

    // Handle sender_name (different field names in different models)
    if (sender_name !== undefined) {
      if (accountType === 'smtp') {
        updateData.sender_name = sender_name;
      } else {
        updateData.name = sender_name;
      }
    }

    // Update the account
    await account.update(updateData);

    // Get enhanced metric summary
    const metrics = await getAccountMetrics(email);

    console.log(`✅ Settings updated for ${email} (${accountType})`);

    return res.json({
      success: true,
      message: `Email settings updated successfully for ${accountType} account`,
      data: {
        email: account.email,
        accountType: accountType,
        updatedSettings: updateData,
        performanceMetrics: metrics
      }
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
    // 🔍 Try to find the account in each model
    let account =
      (await GoogleUser.findOne({ where: { email } })) ||
      (await MicrosoftUser.findOne({ where: { email } })) ||
      (await SmtpAccount.findOne({ where: { email } }));

    if (!account) {
      return res.status(404).json({
        success: false,
        message: `No email account found for ${email}`,
      });
    }

    // 🧩 Detect account type
    let accountType = "unknown";
    if (account instanceof GoogleUser) accountType = "google";
    else if (account instanceof MicrosoftUser) accountType = "microsoft";
    else if (account instanceof SmtpAccount) accountType = "smtp";

    // 📊 Get enhanced metric statistics
    const metrics = await getAccountMetrics(email);

    // 🧠 Prepare account data with enhanced metrics
    const accountData = {
      email: account.email,
      name: account.name || account.sender_name || null,
      accountType,
      warmupStatus: account.warmupStatus,
      is_connected: account.is_connected ?? true,
      warmupDayCount: account.warmupDayCount,
      startEmailsPerDay: account.startEmailsPerDay,
      increaseEmailsPerDay: account.increaseEmailsPerDay,
      maxEmailsPerDay: account.maxEmailsPerDay,
      replyRate: account.replyRate,
      warmupStartTime: account.warmupStartTime,
      // 📈 Enhanced Metric Information
      metrics: metrics
    };

    console.log(`📧 Fetched data with enhanced metrics for ${accountType} account: ${email}`);

    return res.json({
      success: true,
      message: `Fetched data for ${accountType} account (${email})`,
      data: accountData,
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
    // 🔍 Try to find the account in each model
    let account =
      (await GoogleUser.findOne({ where: { email } })) ||
      (await MicrosoftUser.findOne({ where: { email } })) ||
      (await SmtpAccount.findOne({ where: { email } }));

    if (!account) {
      return res.status(404).json({
        success: false,
        message: `No email account found for ${email}`,
      });
    }

    // 🧩 Detect account type
    let accountType = "unknown";
    if (account instanceof GoogleUser) accountType = "google";
    else if (account instanceof MicrosoftUser) accountType = "microsoft";
    else if (account instanceof SmtpAccount) accountType = "smtp";

    // 📊 Get detailed metrics for comprehensive report
    const sentMetrics = await EmailMetric.findAll({
      where: { senderEmail: email },
      order: [['sentAt', 'DESC']]
    });

    const receivedMetrics = await EmailMetric.findAll({
      where: { receiverEmail: email },
      order: [['sentAt', 'DESC']]
    });

    // Calculate comprehensive metrics
    const totalSent = sentMetrics.length;
    const totalReceived = receivedMetrics.length;
    const deliveredEmails = sentMetrics.filter(metric => metric.deliveredInbox).length;
    const repliedEmails = sentMetrics.filter(metric => metric.replied).length;
    const completedEmails = sentMetrics.filter(metric => metric.status === 'completed').length;
    const failedEmails = sentMetrics.filter(metric => metric.status === 'failed').length;

    // Calculate rates
    const deliveryRate = totalSent > 0 ? (deliveredEmails / totalSent * 100).toFixed(1) : 0;
    const replyRate = totalSent > 0 ? (repliedEmails / totalSent * 100).toFixed(1) : 0;
    const successRate = totalSent > 0 ? (completedEmails / totalSent * 100).toFixed(1) : 0;

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSent = sentMetrics.filter(m => new Date(m.sentAt) > sevenDaysAgo).length;
    const recentReplies = sentMetrics.filter(m => m.replied && new Date(m.sentAt) > sevenDaysAgo).length;
    const recentDelivered = sentMetrics.filter(m => m.deliveredInbox && new Date(m.sentAt) > sevenDaysAgo).length;
    const recentDeliveryRate = recentSent > 0 ? (recentDelivered / recentSent * 100).toFixed(1) : 0;

    // 🧠 Prepare account data
    const accountData = {
      email: account.email,
      name: account.name || account.sender_name || null,
      accountType,
      warmupStatus: account.warmupStatus,
      is_connected: account.is_connected ?? true,
    };

    // 📈 Comprehensive metric report
    const metricReport = {
      overview: {
        totalSent,
        totalReceived,
        delivered: deliveredEmails,
        replied: repliedEmails,
        completed: completedEmails,
        failed: failedEmails,
        successRate: `${successRate}%`,
        deliveryRate: `${deliveryRate}%`,
        replyRate: `${replyRate}%`
      },
      performance: {
        recentActivity: {
          last7Days: {
            sent: recentSent,
            replies: recentReplies,
            delivered: recentDelivered,
            deliveryRate: `${recentDeliveryRate}%`
          }
        },
        engagementScore: calculateEngagementScore(deliveryRate, replyRate),
        bestPerforming: {
          day: this.calculateBestDay(sentMetrics),
          time: this.calculateBestTime(sentMetrics)
        }
      },
      timeline: this.calculateSimplifiedDailyPerformance(sentMetrics),
      recentEmails: sentMetrics.slice(0, 10).map(metric => ({
        id: metric.id,
        subject: metric.subject,
        receiver: metric.receiverEmail,
        sentAt: metric.sentAt,
        status: metric.status,
        delivered: metric.deliveredInbox,
        replied: metric.replied,
        error: metric.error
      }))
    };

    console.log(`📊 Generated comprehensive metric report for ${accountType} account: ${email}`);

    return res.json({
      success: true,
      message: `Fetched comprehensive report for ${accountType} account (${email})`,
      data: {
        account: accountData,
        metrics: metricReport,
        report: await this.calculateSimplifiedEmailReport(email)
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

// Keep all your existing helper functions below...
exports.calculateSimplifiedEmailReport = async (email) => {
  try {
    const sentMetrics = await EmailMetric.findAll({
      where: { senderEmail: email },
      order: [['sentAt', 'DESC']]
    });

    if (sentMetrics.length === 0) {
      return this.getSimplifiedFallbackReport();
    }

    const totalSent = sentMetrics.length;
    const deliveredEmails = sentMetrics.filter(metric => metric.deliveredInbox).length;
    const repliedEmails = sentMetrics.filter(metric => metric.replied).length;

    const deliveryRate = totalSent > 0 ? (deliveredEmails / totalSent * 100).toFixed(1) : 0;
    const replyRate = totalSent > 0 ? (repliedEmails / totalSent * 100).toFixed(1) : 0;

    const engagementScore = calculateEngagementScore(deliveryRate, replyRate);

    const dailyPerformance = this.calculateSimplifiedDailyPerformance(sentMetrics);
    const bestTime = this.calculateBestTime(sentMetrics);
    const bestDay = this.calculateBestDay(sentMetrics);

    return {
      overview: {
        totalSent,
        replies: repliedEmails,
        avgDeliverability: `${deliveryRate}%`,
        engagementScore: `${engagementScore}%`
      },
      insights: {
        bestDay,
        peakTime: bestTime,
        reputation: engagementScore
      },
      metrics: {
        replyRate: `${replyRate}%`,
        deliveryRate: `${deliveryRate}%`,
        engagementRate: `${engagementScore}%`
      },
      benchmarking: {
        deliverability: {
          current: `${deliveryRate}%`,
          industry: "85%"
        },
        replyRate: {
          current: `${replyRate}%`,
          industry: "Previous"
        }
      },
      reputation: {
        senderReputation: engagementScore,
        inboxPlacement: Math.round(parseFloat(deliveryRate)),
        audienceHealth: engagementScore
      },
      dailyPerformance: dailyPerformance,
      volumeTrend: {
        labels: dailyPerformance.map(day => day.date),
        data: dailyPerformance.map(day => day.sent)
      }
    };

  } catch (error) {
    console.error('❌ Error calculating simplified email report:', error);
    return this.getSimplifiedFallbackReport();
  }
};

exports.calculateSimplifiedDailyPerformance = (sentMetrics) => {
  const dailyStats = {};

  // Get last 7 days including today
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const dateKey = date.toLocaleDateString('en-US', {
      timeZone: "Asia/Kolkata",
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const shortDate = date.toLocaleDateString('en-US', {
      timeZone: "Asia/Kolkata",
      month: 'short',
      day: 'numeric'
    });

    dailyStats[dateKey] = {
      date: shortDate,
      sent: 0,
      delivered: 0,
      replied: 0,
      status: "0%"
    };
  }

  // Populate with actual data
  sentMetrics.forEach(metric => {
    const metricDate = new Date(metric.sentAt);
    metricDate.setHours(0, 0, 0, 0);

    const dateKey = metricDate.toLocaleDateString('en-US', {
      timeZone: "Asia/Kolkata",
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    if (dailyStats[dateKey]) {
      dailyStats[dateKey].sent++;
      if (metric.deliveredInbox) dailyStats[dateKey].delivered++;
      if (metric.replied) dailyStats[dateKey].replied++;

      // Calculate status (delivery rate)
      dailyStats[dateKey].status = dailyStats[dateKey].sent > 0 ?
        `${Math.round((dailyStats[dateKey].delivered / dailyStats[dateKey].sent) * 100)}%` : "0%";
    }
  });

  // Convert to array and ensure proper order
  return Object.values(dailyStats).sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });
};

exports.calculateBestTime = (sentMetrics) => {
  if (sentMetrics.length === 0) return "11:00";

  const hourCount = {};
  sentMetrics.forEach(metric => {
    const hour = new Date(metric.sentAt).getHours();
    hourCount[hour] = (hourCount[hour] || 0) + 1;
  });

  const bestHour = Object.keys(hourCount).reduce((a, b) =>
    hourCount[a] > hourCount[b] ? a : b
  );

  return `${bestHour}:00`;
};

exports.calculateBestDay = (sentMetrics) => {
  if (sentMetrics.length === 0) return "Friday";

  const dayCount = {};
  sentMetrics.forEach(metric => {
    const day = new Date(metric.sentAt).toLocaleDateString('en-US', {
      timeZone: "Asia/Kolkata",
      weekday: 'long'
    });
    dayCount[day] = (dayCount[day] || 0) + 1;
  });

  return Object.keys(dayCount).reduce((a, b) =>
    dayCount[a] > dayCount[b] ? a : b
  );
};

exports.getSimplifiedFallbackReport = () => {
  return {
    overview: {
      totalSent: 0,
      replies: 0,
      avgDeliverability: "0%",
      engagementScore: "0%"
    },
    insights: {
      bestDay: "N/A",
      peakTime: "N/A",
      reputation: 0
    },
    metrics: {
      replyRate: "0%",
      deliveryRate: "0%",
      engagementRate: "0%"
    },
    benchmarking: {
      deliverability: { current: "0%", industry: "85%" },
      replyRate: { current: "0%", industry: "Previous" }
    },
    reputation: {
      senderReputation: 0,
      inboxPlacement: 0,
      audienceHealth: 0
    },
    dailyPerformance: [],
    volumeTrend: {
      labels: [],
      data: []
    }
  };
};

// Export the scheduleIncrementalWarmup function if needed elsewhere
module.exports.scheduleIncrementalWarmup = scheduleIncrementalWarmup;