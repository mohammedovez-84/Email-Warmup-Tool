const GoogleUser = require('../models/GoogleUser');
const SmtpAccount = require('../models/smtpAccounts');
const MicrosoftUser = require('../models/MicrosoftUser');
const { scheduleIntelligentWarmup } = require('../services/Scheduler');

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
      warmupStartTime,
      warmupEndTime,
      timezone,
      preferredSendInterval
    } = req.body;

    console.log(`Toggle request for EMAIL: ${emailAddress} with status: ${status}`);

    if (!['active', 'paused'].includes(status)) {
      return res.status(400).json({ error: 'Invalid warmup status' });
    }

    // Find sender in any table
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
    if (!sender) return res.status(404).json({ error: 'Sender account not found' });

    // Update warmup status and configuration
    const updateData = { warmupStatus: status };

    // Add optional fields if provided
    if (warmupDayCount !== undefined) updateData.warmupDayCount = warmupDayCount;
    if (startEmailsPerDay !== undefined) updateData.startEmailsPerDay = startEmailsPerDay;
    if (increaseEmailsPerDay !== undefined) updateData.increaseEmailsPerDay = increaseEmailsPerDay;
    if (maxEmailsPerDay !== undefined) updateData.maxEmailsPerDay = maxEmailsPerDay;
    if (replyRate !== undefined) updateData.replyRate = Math.min(0.25, replyRate); // Cap at 25%
    if (warmupStartTime !== undefined) updateData.warmupStartTime = warmupStartTime;
    if (warmupEndTime !== undefined) updateData.warmupEndTime = warmupEndTime;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (preferredSendInterval !== undefined) updateData.preferredSendInterval = preferredSendInterval;

    await sender.update(updateData);

    // If activating warmup, schedule intelligent warmup
    if (status === 'active') {
      try {
        await scheduleIntelligentWarmup();
        console.log(`✅ Intelligent warmup scheduled for ${emailAddress}`);
      } catch (err) {
        console.error('❌ Error scheduling warmup:', err);
        // Don't fail the request if scheduling fails
      }
    }

    // Get updated sender info
    const updatedSender = await (() => {
      switch (senderType) {
        case 'google': return GoogleUser.findOne({ where: { email: emailAddress } });
        case 'microsoft': return MicrosoftUser.findOne({ where: { email: emailAddress } });
        case 'smtp': return SmtpAccount.findOne({ where: { email: emailAddress } });
      }
    })();

    return res.json({
      message: `Warmup ${status} for ${senderType} account (${emailAddress})`,
      senderType: senderType,
      warmupStatus: status,
      updatedConfig: updatedSender.toJSON()
    });
  } catch (error) {
    console.error('Toggle warmup error:', error);
    res.status(500).json({ error: 'Failed to update warmup status' });
  }
};