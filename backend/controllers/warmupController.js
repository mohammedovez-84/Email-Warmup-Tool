const GoogleUser = require('../models/GoogleUser');
const SmtpAccount = require('../models/smtpAccounts');
const MicrosoftUser = require('../models/MicrosoftUser');
const EmailPool = require('../models/EmailPool');
const EmailMetric = require("../models/EmailMetric");
const { Op } = require("sequelize");
const { triggerImmediateScheduling } = require('../services/Scheduler');

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

    console.log(`Toggle request for EMAIL: ${emailAddress} with status: ${status}`);

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
    if (!sender) return res.status(404).json({ success: false, error: 'Sender account not found' });

    // 🚫 Check if account is connected before allowing activation
    if (status === 'active' && sender.is_connected === false) {
      return res.status(403).json({
        success: false,
        message: `Cannot activate warmup for ${emailAddress} — account is disconnected.`,
        hint: 'Please reconnect the account before starting warmup.'
      });
    }

    // 🧩 Update warmup status and config
    const updateData = { warmupStatus: status };

    // Only update provided fields (not all undefined values)
    if (warmupDayCount !== undefined) updateData.warmupDayCount = warmupDayCount;
    if (startEmailsPerDay !== undefined) updateData.startEmailsPerDay = startEmailsPerDay;
    if (increaseEmailsPerDay !== undefined) updateData.increaseEmailsPerDay = increaseEmailsPerDay;
    if (maxEmailsPerDay !== undefined) updateData.maxEmailsPerDay = maxEmailsPerDay;
    if (replyRate !== undefined) updateData.replyRate = Math.min(1.0, Math.max(0, replyRate));

    await sender.update(updateData);

    // ⚙️ POOL-BASED WARMUP LOGIC WITH IMMEDIATE SCHEDULING
    if (status === 'active') {
      try {
        const activeWarmupAccounts = await getActiveWarmupAccountsCount();
        const activePoolAccounts = await getActivePoolAccountsCount();

        console.log(`✅ Warmup activated for ${emailAddress}`);
        console.log(`📊 Active warmup accounts: ${activeWarmupAccounts}`);
        console.log(`🏊 Active pool accounts: ${activePoolAccounts}`);

        if (activeWarmupAccounts >= 1 && activePoolAccounts >= 1) {
          console.log(`🎯 ${emailAddress} will exchange emails with pool accounts`);
          console.log(`🚀 Triggering immediate scheduling...`);

          // ✅ IMMEDIATE SCHEDULING - NO WAITING!
          await triggerImmediateScheduling();

          console.log(`✅ Immediate scheduling completed for ${emailAddress}`);
        } else if (activePoolAccounts === 0) {
          console.log(`⚠️ No active pool accounts available for warmup`);
          return res.json({
            success: true,
            message: `Warmup activated but no pool accounts available`,
            senderType,
            warmupStatus: status,
            email: emailAddress,
            warning: 'No active pool accounts found - warmup will start when pools are available',
            updatedConfig: sender.toJSON()
          });
        }

      } catch (err) {
        console.error('❌ Error activating warmup:', err);
        return res.json({
          success: true,
          message: `Warmup activated but scheduling failed: ${err.message}`,
          senderType,
          warmupStatus: status,
          email: emailAddress,
          warning: 'Warmup activated but immediate scheduling failed',
          updatedConfig: sender.toJSON()
        });
      }
    } else {
      console.log(`⏸️ Warmup paused for ${emailAddress}`);
      console.log(`📝 No new warmup → pool emails will be scheduled`);
    }

    // 🧾 Get updated sender info
    const updatedSender = await (() => {
      switch (senderType) {
        case 'google': return GoogleUser.findOne({ where: { email: emailAddress } });
        case 'microsoft': return MicrosoftUser.findOne({ where: { email: emailAddress } });
        case 'smtp': return SmtpAccount.findOne({ where: { email: emailAddress } });
      }
    })();

    // 📊 Get metric summary
    const metrics = await EmailMetric.findAll({
      where: { senderEmail: emailAddress }
    });

    const totalSent = metrics.length;
    const delivered = metrics.filter(m => m.deliveredInbox).length;
    const replied = metrics.filter(m => m.replied).length;
    const deliveryRate = totalSent > 0 ? (delivered / totalSent * 100).toFixed(1) : 0;

    return res.json({
      success: true,
      message: `Warmup ${status} for ${senderType} account`,
      senderType,
      warmupStatus: status,
      email: emailAddress,
      updatedConfig: updatedSender.toJSON(),
      metricSummary: {
        totalSent,
        delivered,
        replied,
        deliveryRate: `${deliveryRate}%`
      },
      note: status === 'active' ?
        'Account scheduled immediately - emails will be sent within minutes' :
        'No new warmup emails will be scheduled'
    });
  } catch (error) {
    console.error('Toggle warmup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update warmup status',
      details: error.message
    });
  }
};

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

    // Get metric summary
    const metrics = await EmailMetric.findAll({
      where: { senderEmail: email }
    });

    const totalSent = metrics.length;
    const delivered = metrics.filter(m => m.deliveredInbox).length;
    const deliveryRate = totalSent > 0 ? (delivered / totalSent * 100).toFixed(1) : 0;

    return res.json({
      success: true,
      message: `Email account (${accountType}) ${newStatus ? 'reconnected' : 'disconnected'} successfully`,
      data: {
        email: targetAccount.email,
        accountType,
        name: targetAccount.name || targetAccount.sender_name,
        is_connected: newStatus,
        metricSummary: {
          totalSent,
          delivered,
          deliveryRate: `${deliveryRate}%`
        },
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
    const metrics = await EmailMetric.findAll({
      where: { senderEmail: email }
    });

    const totalSent = metrics.length;
    const delivered = metrics.filter(m => m.deliveredInbox).length;
    const deliveryRate = totalSent > 0 ? (delivered / totalSent * 100).toFixed(1) : 0;

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
        deletedMetrics: totalSent,
        performanceSummary: {
          totalSent,
          delivered,
          deliveryRate: `${deliveryRate}%`
        },
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

    // Get metric summary
    const metrics = await EmailMetric.findAll({
      where: { senderEmail: email }
    });

    const totalSent = metrics.length;
    const delivered = metrics.filter(m => m.deliveredInbox).length;
    const replied = metrics.filter(m => m.replied).length;
    const deliveryRate = totalSent > 0 ? (delivered / totalSent * 100).toFixed(1) : 0;
    const actualReplyRate = totalSent > 0 ? (replied / totalSent * 100).toFixed(1) : 0;

    console.log(`✅ Settings updated for ${email} (${accountType})`);

    return res.json({
      success: true,
      message: `Email settings updated successfully for ${accountType} account`,
      data: {
        email: account.email,
        accountType: accountType,
        updatedSettings: updateData,
        performanceMetrics: {
          totalSent,
          delivered,
          replied,
          deliveryRate: `${deliveryRate}%`,
          actualReplyRate: `${actualReplyRate}%`
        }
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

    // 📊 Get metric statistics for this email
    const metrics = await EmailMetric.findAll({
      where: { senderEmail: email }
    });

    // Calculate basic metrics
    const totalSent = metrics.length;
    const delivered = metrics.filter(m => m.deliveredInbox).length;
    const replied = metrics.filter(m => m.replied).length;
    const opened = metrics.filter(m => m.opened).length;
    const clicked = metrics.filter(m => m.clicked).length;
    const bounced = metrics.filter(m => m.bounced).length;

    const deliveryRate = totalSent > 0 ? (delivered / totalSent * 100).toFixed(1) : 0;
    const replyRate = totalSent > 0 ? (replied / totalSent * 100).toFixed(1) : 0;
    const openRate = totalSent > 0 ? (opened / totalSent * 100).toFixed(1) : 0;
    const clickRate = totalSent > 0 ? (clicked / totalSent * 100).toFixed(1) : 0;
    const bounceRate = totalSent > 0 ? (bounced / totalSent * 100).toFixed(1) : 0;

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentSent = metrics.filter(m => new Date(m.sentAt) > sevenDaysAgo).length;
    const recentReplied = metrics.filter(m => m.replied && new Date(m.sentAt) > sevenDaysAgo).length;

    // 🧠 Prepare response data with metrics
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
      warmupEndTime: account.warmupEndTime,
      timezone: account.timezone,
      preferredSendInterval: account.preferredSendInterval,
      // 📈 Metric Information
      metrics: {
        summary: {
          totalSent,
          delivered,
          replied,
          opened,
          clicked,
          bounced
        },
        rates: {
          deliveryRate: `${deliveryRate}%`,
          replyRate: `${replyRate}%`,
          openRate: `${openRate}%`,
          clickRate: `${clickRate}%`,
          bounceRate: `${bounceRate}%`
        },
        recentActivity: {
          last7Days: {
            sent: recentSent,
            replied: recentReplied
          }
        },
        lastSent: metrics.length > 0 ?
          new Date(Math.max(...metrics.filter(m => m.sentAt).map(m => new Date(m.sentAt)))) :
          null,
        performanceScore: this.calculatePerformanceScore(deliveryRate, replyRate, openRate, clickRate)
      }
    };

    console.log(`📧 Fetched data with metrics for ${accountType} account: ${email}`);

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

    // Calculate detailed metrics
    const totalSent = sentMetrics.length;
    const totalReceived = receivedMetrics.length;
    const deliveredEmails = sentMetrics.filter(metric => metric.deliveredInbox).length;
    const repliedEmails = sentMetrics.filter(metric => metric.replied).length;
    const openedEmails = sentMetrics.filter(metric => metric.opened).length;
    const clickedEmails = sentMetrics.filter(metric => metric.clicked).length;
    const bouncedEmails = sentMetrics.filter(metric => metric.bounced).length;

    // Calculate rates
    const deliveryRate = totalSent > 0 ? (deliveredEmails / totalSent * 100).toFixed(1) : 0;
    const replyRate = totalSent > 0 ? (repliedEmails / totalSent * 100).toFixed(1) : 0;
    const openRate = totalSent > 0 ? (openedEmails / totalSent * 100).toFixed(1) : 0;
    const clickRate = totalSent > 0 ? (clickedEmails / totalSent * 100).toFixed(1) : 0;
    const bounceRate = totalSent > 0 ? (bouncedEmails / totalSent * 100).toFixed(1) : 0;

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSent = sentMetrics.filter(m => new Date(m.sentAt) > sevenDaysAgo).length;
    const recentReplies = sentMetrics.filter(m => m.replied && new Date(m.sentAt) > sevenDaysAgo).length;

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
      summary: {
        totalSent,
        totalReceived,
        delivered: deliveredEmails,
        replied: repliedEmails,
        opened: openedEmails,
        clicked: clickedEmails,
        bounced: bouncedEmails
      },
      rates: {
        deliveryRate: `${deliveryRate}%`,
        replyRate: `${replyRate}%`,
        openRate: `${openRate}%`,
        clickRate: `${clickRate}%`,
        bounceRate: `${bounceRate}%`,
        engagementRate: `${clickRate}%`
      },
      performance: {
        recentActivity: {
          last7Days: {
            sent: recentSent,
            replies: recentReplies
          }
        },
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
        opened: metric.opened,
        clicked: metric.clicked
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

// SIMPLIFIED REPORT CALCULATION - Only what's needed for frontend
exports.calculateSimplifiedEmailReport = async (email) => {
  try {
    // Get sent metrics only (we don't need received metrics for current UI)
    const sentMetrics = await EmailMetric.findAll({
      where: { senderEmail: email },
      order: [['sentAt', 'DESC']]
    });

    if (sentMetrics.length === 0) {
      return this.getSimplifiedFallbackReport();
    }

    // Calculate essential metrics for UI
    const totalSent = sentMetrics.length;
    const deliveredEmails = sentMetrics.filter(metric => metric.deliveredInbox).length;
    const repliedEmails = sentMetrics.filter(metric => metric.replied).length;

    // Calculate rates
    const deliveryRate = totalSent > 0 ? (deliveredEmails / totalSent * 100).toFixed(1) : 0;
    const replyRate = totalSent > 0 ? (repliedEmails / totalSent * 100).toFixed(1) : 0;

    // Get open and click counts (assuming these fields exist in EmailMetric)
    const openedEmails = sentMetrics.filter(metric => metric.opened).length;
    const clickedEmails = sentMetrics.filter(metric => metric.clicked).length;

    const openRate = totalSent > 0 ? (openedEmails / totalSent * 100).toFixed(1) : 0;
    const clickRate = totalSent > 0 ? (clickedEmails / totalSent * 100).toFixed(1) : 0;

    // Calculate engagement score (simplified)
    const engagementScore = Math.round(
      (parseFloat(deliveryRate) * 0.4) +
      (parseFloat(replyRate) * 0.3) +
      (parseFloat(openRate) * 0.2) +
      (parseFloat(clickRate) * 0.1)
    );

    // Get daily performance for last 7 days
    const dailyPerformance = this.calculateSimplifiedDailyPerformance(sentMetrics);

    // Get best performing time
    const bestTime = this.calculateBestTime(sentMetrics);

    // Get best day
    const bestDay = this.calculateBestDay(sentMetrics);

    return {
      // Overview Section Data
      overview: {
        totalSent,
        replies: repliedEmails,
        avgDeliverability: `${deliveryRate}%`,
        engagementScore: `${engagementScore}%`
      },

      // Quick Insights Data
      insights: {
        bestDay,
        peakTime: bestTime,
        reputation: engagementScore
      },

      // Key Metrics Data
      metrics: {
        replyRate: `${replyRate}%`,
        openRate: `${openRate}%`,
        clickRate: `${clickRate}%`,
        engagementRate: `${clickRate}%`
      },

      // Performance Benchmarking Data
      benchmarking: {
        deliverability: {
          current: `${deliveryRate}%`,
          industry: "85%"
        },
        replyRate: {
          current: `${replyRate}%`,
          industry: "Previous"
        },
        openRate: {
          current: `${openRate}%`,
          industry: "Previous"
        },
        clickRate: {
          current: `${clickRate}%`,
          industry: "Previous"
        }
      },

      // Sender Reputation Metrics
      reputation: {
        senderReputation: engagementScore,
        inboxPlacement: Math.round(parseFloat(deliveryRate)),
        audienceHealth: engagementScore
      },

      // Daily Performance Table Data
      dailyPerformance: dailyPerformance,

      // Email Volume Trend Data
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
      opened: 0,
      clicked: 0,
      replies: 0,
      bounce: 0,
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
      if (metric.opened) dailyStats[dateKey].opened++;
      if (metric.clicked) dailyStats[dateKey].clicked++;
      if (metric.replied) dailyStats[dateKey].replies++;
      // Assuming bounce data - you might need to track this separately
      dailyStats[dateKey].bounce = metric.bounced ? 1 : 0;

      // Calculate status (delivery rate)
      const delivered = metric.deliveredInbox ? 1 : 0;
      dailyStats[dateKey].status = dailyStats[dateKey].sent > 0 ?
        `${Math.round((delivered / dailyStats[dateKey].sent) * 100)}%` : "0%";
    }
  });

  // Convert to array and ensure proper order
  return Object.values(dailyStats).sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });
};

exports.calculateBestTime = (sentMetrics) => {
  if (sentMetrics.length === 0) return "11:00"; // Default

  const hourCount = {};
  sentMetrics.forEach(metric => {
    const hour = new Date(metric.sentAt).getHours();
    hourCount[hour] = (hourCount[hour] || 0) + 1;
  });

  // Find hour with most sends
  const bestHour = Object.keys(hourCount).reduce((a, b) =>
    hourCount[a] > hourCount[b] ? a : b
  );

  return `${bestHour}:00`;
};

exports.calculateBestDay = (sentMetrics) => {
  if (sentMetrics.length === 0) return "Friday"; // Default

  const dayCount = {};
  sentMetrics.forEach(metric => {
    const day = new Date(metric.sentAt).toLocaleDateString('en-US', {
      timeZone: "Asia/Kolkata",
      weekday: 'long'
    });
    dayCount[day] = (dayCount[day] || 0) + 1;
  });

  // Find day with most sends
  return Object.keys(dayCount).reduce((a, b) =>
    dayCount[a] > dayCount[b] ? a : b
  );
};

exports.calculatePerformanceScore = (deliveryRate, replyRate, openRate, clickRate) => {
  const score = (
    (parseFloat(deliveryRate) * 0.4) +
    (parseFloat(replyRate) * 0.3) +
    (parseFloat(openRate) * 0.2) +
    (parseFloat(clickRate) * 0.1)
  );
  return Math.min(100, Math.round(score));
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
      openRate: "0%",
      clickRate: "0%",
      engagementRate: "0%"
    },
    benchmarking: {
      deliverability: { current: "0%", industry: "85%" },
      replyRate: { current: "0%", industry: "Previous" },
      openRate: { current: "0%", industry: "Previous" },
      clickRate: { current: "0%", industry: "Previous" }
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