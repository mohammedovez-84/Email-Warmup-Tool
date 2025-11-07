const nodemailer = require('nodemailer');
const axios = require('axios');
const tokenManager = require('../../utils/token-manager');
const crypto = require('crypto');
const emailQueue = new Map();

// Single message ID generator
function generateMessageId(senderEmail) {
  const domain = senderEmail.split('@')[1] || 'emailwarmup.service';
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  return `<${timestamp}.${randomString}@${domain}>`;
}

// Helper functions
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p\s*\/?>/gi, '\n\n')
    .replace(/<div\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

function extractNameFromEmail(email) {
  if (!email) return "User";
  const localPart = email.split("@")[0];
  return localPart.split(/[._-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function isStandardEmailProvider(email) {
  if (!email) return false;
  const standardProviders = [
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
    'yahoo.com', 'ymail.com', 'aol.com', 'icloud.com', 'me.com',
    'protonmail.com', 'proton.me'
  ];
  const domain = email.toLowerCase().split('@')[1];
  return standardProviders.includes(domain);
}

// Core email sending functions
async function sendOutlookWithGraphAPI(senderConfig, emailData) {
  try {
    console.log('   🔐 Using Microsoft Graph API for Outlook account...');

    const validTokens = await tokenManager.refreshOutlookToken(senderConfig);
    if (!validTokens || !validTokens.access_token) {
      throw new Error('Graph API authentication failed - please reauthenticate');
    }

    const messageId = generateMessageId(senderConfig.email);

    const message = {
      message: {
        subject: emailData.subject,
        body: {
          contentType: "HTML",
          content: emailData.html
        },
        toRecipients: [{
          emailAddress: {
            address: emailData.to
          }
        }]
      },
      saveToSentItems: "true"
    };

    console.log(`   📤 Sending email via Graph API with Message-ID: ${messageId}`);
    const response = await axios.post(
      'https://graph.microsoft.com/v1.0/me/sendMail',
      message,
      {
        headers: {
          'Authorization': `Bearer ${validTokens.access_token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'EmailWarmupTool/1.0'
        },
        timeout: 30000
      }
    );

    console.log(`✅ Email sent successfully via Graph API`);

    if (validTokens !== senderConfig) {
      await tokenManager.updateTokensInDatabase(senderConfig.email, validTokens);
    }

    return {
      success: true,
      messageId: messageId,
      usedAuth: 'GraphAPI',
      deliveredInbox: true,
      skipImapCheck: true,
      graphApiResponse: response.status
    };

  } catch (error) {
    console.error('❌ Graph API failed:', error.response?.data || error.message);
    const errorMessage = error.response?.data?.error?.message || error.message;
    const requiresReauth = errorMessage.includes('InvalidAuthenticationToken') ||
      errorMessage.includes('AuthenticationFailed') ||
      errorMessage.includes('token') ||
      error.response?.status === 401;

    if (requiresReauth) {
      console.log('   🔐 Graph API requires reauthentication');
      await markAccountForReauth(senderConfig.email);
    }

    return {
      success: false,
      error: `Graph API failed: ${errorMessage}`,
      requiresReauth: requiresReauth,
      graphApiError: true
    };
  }
}

async function sendGmailWithSMTP(senderConfig, emailData) {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   📧 Using Gmail SMTP (attempt ${attempt}/${maxRetries})...`);

      const isPersonalGmail = senderConfig.email.endsWith('@gmail.com') ||
        senderConfig.email.endsWith('@googlemail.com');

      console.log(`   🔍 Account type: ${isPersonalGmail ? 'Personal Gmail' : 'Organizational Gmail'}`);

      // Enhanced transporter configuration with better timeout handling
      const transporterConfig = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: senderConfig.email,
          pass: senderConfig.appPassword || senderConfig.smtpPass || senderConfig.password
        },
        connectionTimeout: 30000,
        greetingTimeout: 20000,
        socketTimeout: 30000,
        dnsTimeout: 10000,
        tls: {
          rejectUnauthorized: false,
          ciphers: 'SSLv3'
        },
        logger: false,
        debug: false
      };

      // Try alternative ports if 587 fails
      if (attempt > 1) {
        transporterConfig.port = 465;
        transporterConfig.secure = true;
        console.log(`   🔄 Trying alternative port 465 (SSL)...`);
      }

      const transporter = nodemailer.createTransport(transporterConfig);

      console.log('   🔐 Verifying Gmail SMTP connection...');
      await transporter.verify();
      console.log('   ✅ Gmail SMTP connection verified');

      // 🚨 CRITICAL FIX: Generate message ID BEFORE sending
      const messageId = generateMessageId(senderConfig.email);

      const mailOptions = {
        from: `"${senderConfig.name || extractNameFromEmail(senderConfig.email)}" <${senderConfig.email}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: stripHtml(emailData.html),
        messageId: messageId, // 🚨 This must be set
        headers: {
          'X-Mailer': 'EmailWarmupService',
          'Message-ID': messageId, // 🚨 Double ensure Message-ID is set
          'Date': new Date().toUTCString()
        }
      };

      console.log(`   📤 Sending email via Gmail SMTP with Message-ID: ${messageId}`);
      const result = await transporter.sendMail(mailOptions);

      console.log(`✅ Gmail email sent successfully: ${result.messageId}`);

      return {
        success: true,
        messageId: result.messageId || messageId,
        usedAuth: isPersonalGmail ? 'GmailAppPassword' : 'GmailOrganizational',
        accountType: isPersonalGmail ? 'personal' : 'organizational'
      };

    } catch (error) {
      console.error(`❌ Gmail SMTP attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        return {
          success: false,
          error: `Gmail SMTP failed after ${maxRetries} attempts: ${error.message}`,
          requiresAppPassword: error.message.includes('Authentication'),
          networkIssue: error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED')
        };
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

async function sendWithCustomSMTP(senderConfig, emailData) {
  try {
    console.log('   🔧 Using custom SMTP configuration...');

    if (!senderConfig.smtpHost || !senderConfig.smtpPort) {
      throw new Error('Custom SMTP requires host and port configuration');
    }
    if (!senderConfig.smtpPass && !senderConfig.smtpPassword) {
      throw new Error('Custom SMTP requires password');
    }

    const transporterConfig = {
      host: senderConfig.smtpHost,
      port: senderConfig.smtpPort,
      secure: senderConfig.smtpSecure || false,
      auth: {
        user: senderConfig.smtpUser || senderConfig.email,
        pass: senderConfig.smtpPass || senderConfig.smtpPassword
      },
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      tls: { rejectUnauthorized: false },
      dnsTimeout: 10000,
      logger: false,
      debug: false
    };

    if (senderConfig.smtpHost === 'smtp.office365.com') {
      transporterConfig.requireTLS = true;
    }

    const transporter = nodemailer.createTransport(transporterConfig);
    await transporter.verify();
    console.log('   ✅ Custom SMTP connection verified');

    const messageId = generateMessageId(senderConfig.email);
    const mailOptions = {
      from: `"${senderConfig.name || extractNameFromEmail(senderConfig.email)}" <${senderConfig.email}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: stripHtml(emailData.html),
      messageId: messageId,
      headers: {
        'X-Mailer': 'EmailWarmupService',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'X-Priority': '3',
        'Importance': 'Normal',
        'Precedence': 'bulk',
        'Date': new Date().toUTCString()
      }
    };

    if (emailData.inReplyTo) {
      mailOptions.inReplyTo = emailData.inReplyTo;
      mailOptions.references = emailData.references || [emailData.inReplyTo];
    }

    console.log('   📤 Sending email via custom SMTP...');
    const startTime = Date.now();
    const result = await transporter.sendMail(mailOptions);
    const deliveryTime = Date.now() - startTime;

    console.log(`✅ Custom SMTP email sent successfully: ${result.messageId}`);
    console.log(`   📧 Response: ${result.response}`);
    console.log(`   ⏱️  Delivery time: ${deliveryTime}ms`);

    return {
      success: true,
      messageId: result.messageId || messageId,
      response: result.response,
      deliveryTime: deliveryTime,
      usedAuth: 'CustomSMTP',
      subject: emailData.subject
    };

  } catch (error) {
    console.error('❌ Custom SMTP failed:', error.message);

    const isCustomDomain = !isStandardEmailProvider(senderConfig.email);
    if (isCustomDomain) {
      console.log('   🔄 Attempting domain discovery for custom domain...');
      return await handleCustomDomainWithRetry(senderConfig, emailData);
    }

    return {
      success: false,
      error: `Custom SMTP failed: ${error.message}`,
      requiresManualConfig: true
    };
  }
}

async function handleCustomDomainWithRetry(senderConfig, emailData) {
  const domain = senderConfig.email.split('@')[1];
  console.log(`   🔧 Testing configurations for domain: ${domain}`);

  const configsToTry = [
    { host: `mail.${domain}`, port: 587, secure: false, requireTLS: true, description: `mail.${domain}:587 (STARTTLS)` },
    { host: `mail.${domain}`, port: 465, secure: true, description: `mail.${domain}:465 (SSL)` },
    { host: domain, port: 587, secure: false, requireTLS: true, description: `${domain}:587 (STARTTLS)` },
    { host: domain, port: 465, secure: true, description: `${domain}:465 (SSL)` },
    { host: `smtp.${domain}`, port: 587, secure: false, requireTLS: true, description: `smtp.${domain}:587 (STARTTLS)` },
    { host: `smtp.${domain}`, port: 465, secure: true, description: `smtp.${domain}:465 (SSL)` },
    { host: `mail.${domain}`, port: 25, secure: false, description: `mail.${domain}:25 (Standard)` }
  ];

  for (const config of configsToTry) {
    console.log(`   🔄 Trying: ${config.description}`);
    try {
      const testConfig = {
        ...config,
        auth: {
          user: senderConfig.smtpUser || senderConfig.email,
          pass: senderConfig.smtpPass || senderConfig.smtpPassword
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: { rejectUnauthorized: false }
      };

      const transporter = nodemailer.createTransport(testConfig);
      await transporter.verify();
      console.log(`   ✅ Connection successful: ${config.description}`);

      const messageId = generateMessageId(senderConfig.email);
      const mailOptions = {
        from: `"${senderConfig.name || extractNameFromEmail(senderConfig.email)}" <${senderConfig.email}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: stripHtml(emailData.html),
        messageId: messageId
      };

      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent via ${config.description}`);

      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
        usedConfig: config.description
      };

    } catch (error) {
      console.log(`   ❌ Failed: ${config.description} - ${error.message}`);
      continue;
    }
  }

  console.error(`   💡 All SMTP configurations failed for ${domain}`);
  return {
    success: false,
    error: `All SMTP configurations failed for ${domain}. Check hosting SMTP settings.`,
    requiresManualConfig: true
  };
}

// In the main sendEmail function, update the Gmail detection:
async function sendEmail(senderConfig, emailData) {
  try {
    const isOutlookPersonal = senderConfig.email.endsWith('@outlook.com') ||
      senderConfig.email.endsWith('@hotmail.com') ||
      senderConfig.email.endsWith('@live.com');

    const isMicrosoftOrganizational = senderConfig.providerType === 'MICROSOFT_ORGANIZATIONAL' ||
      senderConfig.type === 'microsoft_organizational';

    // Enhanced Gmail detection
    const isPersonalGmail = senderConfig.email.endsWith('@gmail.com') ||
      senderConfig.email.endsWith('@googlemail.com');

    const isOrganizationalGmail = senderConfig.providerType === 'GMAIL' &&
      !isPersonalGmail;

    if (isOutlookPersonal || isMicrosoftOrganizational) {
      console.log('   🔐 FORCING Graph API for Microsoft account');
      senderConfig.useGraphApi = true;
      senderConfig.forceSMTP = false;

      const graphResult = await sendOutlookWithGraphAPI(senderConfig, emailData);
      if (!graphResult.success && graphResult.requiresReauth) {
        console.log(`   🔐 Graph API requires reauthentication for ${senderConfig.email}`);
        await markAccountForReauth(senderConfig.email);
      }
      return graphResult;
    }

    if (isPersonalGmail || isOrganizationalGmail) {
      console.log(`   📧 Using ${isPersonalGmail ? 'Personal' : 'Organizational'} Gmail SMTP`);
      return await sendGmailWithSMTP(senderConfig, emailData);
    }

    console.log('   🔧 Using custom SMTP configuration');
    return await sendWithCustomSMTP(senderConfig, emailData);

  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    return {
      success: false,
      error: error.message,
      errorCode: error.code,
      timestamp: new Date().toISOString()
    };
  }
}

// Retry mechanism
async function sendEmailWithRetry(senderConfig, emailData, maxRetries = 3) {
  const emailKey = `${senderConfig.email}:${emailData.to}:${emailData.subject}`;

  if (!emailQueue.has(emailKey)) {
    emailQueue.set(emailKey, { retries: 0, lastAttempt: Date.now() });
  }

  const queueItem = emailQueue.get(emailKey);

  try {
    console.log(`📧 Attempt ${queueItem.retries + 1}/${maxRetries} for ${senderConfig.email}`);
    const result = await sendEmail(senderConfig, emailData);

    if (result.success) {
      emailQueue.delete(emailKey);
      return result;
    } else {
      queueItem.retries++;
      queueItem.lastAttempt = Date.now();

      if (queueItem.retries >= maxRetries) {
        console.log(`❌ MAX RETRIES REACHED for ${senderConfig.email} → ${emailData.to}`);
        emailQueue.delete(emailKey);
        return {
          success: false,
          error: `Failed after ${maxRetries} attempts: ${result.error}`,
          maxRetriesReached: true,
          finalAttempt: true
        };
      } else {
        console.log(`🔄 Will retry (${queueItem.retries}/${maxRetries}) after delay`);
        return {
          success: false,
          error: result.error,
          willRetry: true,
          retryCount: queueItem.retries,
          maxRetries: maxRetries
        };
      }
    }
  } catch (error) {
    queueItem.retries++;
    queueItem.lastAttempt = Date.now();

    if (queueItem.retries >= maxRetries) {
      console.log(`❌ MAX RETRIES REACHED due to exception for ${senderConfig.email}`);
      emailQueue.delete(emailKey);
      return {
        success: false,
        error: `Failed after ${maxRetries} attempts with exception: ${error.message}`,
        maxRetriesReached: true,
        finalAttempt: true
      };
    }

    console.log(`🔄 Will retry after exception (${queueItem.retries}/${maxRetries})`);
    return {
      success: false,
      error: error.message,
      willRetry: true,
      retryCount: queueItem.retries,
      maxRetries: maxRetries
    };
  }
}

// Account management
async function markAccountForReauth(email) {
  try {
    console.log(`🔐 Marking account for reauthentication: ${email}`);
    const MicrosoftUser = require('../../models/MicrosoftUser');
    const EmailPool = require('../../models/EmailPool');

    let updated = await MicrosoftUser.update(
      { needs_reauth: true, reauth_requested_at: new Date() },
      { where: { email } }
    );

    if (updated[0] === 0) {
      await EmailPool.update(
        { needsReauth: true, reauthRequestedAt: new Date() },
        { where: { email } }
      );
    }

    console.log(`✅ Account marked for reauthentication: ${email}`);
  } catch (error) {
    console.error(`❌ Error marking account for reauth: ${error.message}`);
  }
}

// Queue management
function getQueueStatus() {
  return {
    totalItems: emailQueue.size,
    items: Array.from(emailQueue.entries()).map(([key, value]) => ({
      key,
      retries: value.retries,
      lastAttempt: new Date(value.lastAttempt).toISOString()
    }))
  };
}

function clearQueue() {
  const count = emailQueue.size;
  emailQueue.clear();
  return count;
}

module.exports = {
  sendEmailWithRetry,
  sendEmail,
  getQueueStatus,
  clearQueue,
  markAccountForReauth
};