const nodemailer = require('nodemailer');
const axios = require('axios');
const tokenManager = require('../utils/token-manager');

const emailQueue = new Map(); // Track retry counts

async function sendEmailWithRetry(senderConfig, emailData, maxRetries = 3) {
  const emailKey = `${senderConfig.email}:${emailData.to}:${emailData.subject}`;

  // Initialize retry count
  if (!emailQueue.has(emailKey)) {
    emailQueue.set(emailKey, { retries: 0, lastAttempt: Date.now() });
  }

  const queueItem = emailQueue.get(emailKey);

  try {
    console.log(`📧 Attempt ${queueItem.retries + 1}/${maxRetries} for ${senderConfig.email}`);

    const result = await sendEmail(senderConfig, emailData);

    if (result.success) {
      // Success - remove from queue
      emailQueue.delete(emailKey);
      return result;
    } else {
      // Failure - increment retry count
      queueItem.retries++;
      queueItem.lastAttempt = Date.now();

      if (queueItem.retries >= maxRetries) {
        console.log(`❌ MAX RETRIES REACHED for ${senderConfig.email} → ${emailData.to}`);
        console.log(`   🗑️ Removing from queue after ${maxRetries} failed attempts`);
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
    // Unhandled exception - increment retry count
    queueItem.retries++;
    queueItem.lastAttempt = Date.now();

    if (queueItem.retries >= maxRetries) {
      console.log(`❌ MAX RETRIES REACHED due to exception for ${senderConfig.email}`);
      console.log(`   🗑️ Removing from queue after ${maxRetries} failed attempts`);
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

async function sendEmail(senderConfig, emailData) {
  try {
    // Check if we should use Graph API for Outlook personal accounts
    const isOutlookPersonal = senderConfig.email.endsWith('@outlook.com') ||
      senderConfig.email.endsWith('@hotmail.com') ||
      senderConfig.email.endsWith('@live.com');

    if (isOutlookPersonal && senderConfig.accessToken) {
      console.log('   🔐 FORCING Graph API for Outlook personal account');
      return await sendOutlookWithGraphAPI(senderConfig, emailData);
    }

    // Check if we should use Graph API for other Outlook accounts
    if (senderConfig.useGraphApi && senderConfig.accessToken) {
      console.log('   🔐 Using Microsoft Graph API for Outlook account');
      return await sendOutlookWithGraphAPI(senderConfig, emailData);
    }
    // Replace with this dynamic check:
    const isCustomDomain = !isStandardEmailProvider(senderConfig.email);
    if (isCustomDomain) {
      const domain = senderConfig.email.split('@')[1];
      console.log(`   🔧 Handling custom domain: ${domain}`);
      return await handleCustomDomainWithRetry(senderConfig, emailData);
    }

    const isOutlookOAuth2 = (senderConfig.smtpHost === 'smtp.office365.com' ||
      senderConfig.smtpHost === 'smtp-mail.outlook.com') &&
      senderConfig.accessToken &&
      senderConfig.useOAuth2;

    if (isOutlookOAuth2) {
      console.log(`   🔑 Using OAuth2 for Outlook account: ${senderConfig.email}`);
      return await sendOutlookWithOAuth2(senderConfig, emailData);
    }

    let transporterConfig = await buildTransporterConfig(senderConfig);
    const transporter = nodemailer.createTransport(transporterConfig);

    // Verify connection
    console.log('   🔄 Verifying SMTP connection...');
    await transporter.verify();
    console.log('   ✅ SMTP connection verified');

    const mailOptions = buildMailOptions(senderConfig, emailData);

    console.log('   📤 Sending email...');
    const startTime = Date.now();
    const result = await transporter.sendMail(mailOptions);
    const endTime = Date.now();

    console.log(`✅ Email sent successfully: ${result.messageId}`);
    console.log(`   📧 Response: ${result.response}`);
    console.log(`   ⏱️  Delivery time: ${endTime - startTime}ms`);

    return {
      success: true,
      messageId: result.messageId,
      response: result.response,
      deliveryTime: endTime - startTime
    };

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

async function sendOutlookWithGraphAPI(senderConfig, emailData) {
  try {
    console.log('   🔐 Using Microsoft Graph API for Outlook account...');

    // Get fresh account data
    const freshAccount = await tokenManager.getFreshAccountData(senderConfig.email);

    if (!freshAccount.access_token) {
      throw new Error('No access token available');
    }

    const message = {
      message: {
        subject: emailData.subject,
        body: {
          contentType: "HTML",
          content: emailData.html
        },
        toRecipients: [
          {
            emailAddress: {
              address: emailData.to
            }
          }
        ]
      },
      saveToSentItems: "true"
    };

    console.log('   📤 Sending email via Graph API...');
    const startTime = Date.now();
    const response = await axios.post(
      'https://graph.microsoft.com/v1.0/me/sendMail',
      message,
      {
        headers: {
          'Authorization': `Bearer ${freshAccount.access_token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    const endTime = Date.now();

    console.log(`✅ Email sent successfully via Graph API`);
    console.log(`   ⏱️  Delivery time: ${endTime - startTime}ms`);

    // For Graph API, we can't get a real message ID for IMAP tracking
    const graphMessageId = `graph-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      messageId: graphMessageId,
      usedAuth: 'GraphAPI',
      deliveryTime: endTime - startTime,
      deliveredInbox: true,
      skipImapCheck: true
    };

  } catch (error) {
    console.error('❌ Graph API failed:', error.response?.data || error.message);

    // NEVER fall back to SMTP for personal Outlook accounts
    const isPersonalAccount = senderConfig.email.endsWith('@outlook.com') ||
      senderConfig.email.endsWith('@hotmail.com') ||
      senderConfig.email.endsWith('@live.com');

    if (!isPersonalAccount && senderConfig.providerType !== 'OUTLOOK_PERSONAL') {
      console.log('   🔄 Falling back to SMTP for organizational account...');
      return await sendOutlookWithOAuth2(senderConfig, emailData);
    } else {
      console.log('   💡 Outlook personal account requires working Graph API - SMTP will not work');
      return {
        success: false,
        error: `Graph API failed: ${error.response?.data?.error?.message || error.message}`,
        requiresReauth: true
      };
    }
  }
}

async function sendOutlookWithOAuth2(senderConfig, emailData) {
  try {
    console.log('   🔐 Using OAuth2 with token validation...');

    // Get fresh account data first (using only existing columns)
    const freshAccount = await tokenManager.getFreshAccountData(senderConfig.email);

    if (!freshAccount.isActive) {
      throw new Error('Account is inactive');
    }

    // Update senderConfig with fresh data
    senderConfig.access_token = freshAccount.access_token;
    senderConfig.refresh_token = freshAccount.refresh_token;
    senderConfig.token_expires_at = freshAccount.token_expires_at;

    console.log('   🔍 Current token state:', {
      hasAccessToken: !!senderConfig.access_token,
      hasRefreshToken: !!senderConfig.refresh_token,
      tokenExpiresAt: senderConfig.token_expires_at ? new Date(Number(senderConfig.token_expires_at)).toISOString() : 'NOT SET'
    });

    // Check if token needs refresh
    if (tokenManager.isTokenExpired(senderConfig)) {
      console.log('   ⚠️  Token expired or about to expire, refreshing...');

      const newTokens = await tokenManager.refreshOutlookToken(senderConfig);

      // Update database
      await tokenManager.updateTokensInDatabase(senderConfig.email, newTokens);

      // Update senderConfig
      senderConfig.access_token = newTokens.access_token;
      senderConfig.refresh_token = newTokens.refresh_token;
      senderConfig.token_expires_at = newTokens.token_expires_at;

      console.log('   ✅ Using refreshed token');
    }

    // Continue with email sending...
    const transporterConfig = {
      host: senderConfig.smtpHost || 'smtp.office365.com',
      port: senderConfig.smtpPort || 587,
      secure: false,
      requireTLS: true,
      auth: {
        type: 'OAuth2',
        user: senderConfig.email,
        accessToken: senderConfig.access_token,
      },
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      tls: {
        rejectUnauthorized: false
      }
    };

    const transporter = nodemailer.createTransport(transporterConfig);
    console.log('   🔄 Verifying OAuth2 connection...');
    await transporter.verify();
    console.log('   ✅ Outlook OAuth2 connection verified');

    const mailOptions = {
      from: `"${senderConfig.name}" <${senderConfig.email}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      messageId: `<${generateMessageId()}>`,
      headers: {
        'X-Mailer': 'EmailWarmupService',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
      }
    };

    if (emailData.html) {
      mailOptions.text = stripHtml(emailData.html);
    }

    console.log('   📤 Sending email via OAuth2...');
    const startTime = Date.now();
    const result = await transporter.sendMail(mailOptions);
    const endTime = Date.now();

    console.log(`✅ Email sent successfully via OAuth2: ${result.messageId}`);
    console.log(`   ⏱️  Delivery time: ${endTime - startTime}ms`);

    return {
      success: true,
      messageId: result.messageId,
      usedAuth: 'OAuth2',
      deliveryTime: endTime - startTime
    };

  } catch (error) {
    console.error('❌ OAuth2 failed:', error.message);
    return {
      success: false,
      error: error.message,
      requiresReauth: error.message.includes('No refresh token') || error.message.includes('inactive')
    };
  }
}

function isStandardEmailProvider(email) {
  if (!email) return false;

  const standardProviders = [
    'gmail.com', 'googlemail.com',
    'outlook.com', 'hotmail.com', 'live.com',
    'yahoo.com', 'ymail.com',
    'aol.com', 'icloud.com', 'me.com',
    'protonmail.com', 'proton.me'
  ];

  const domain = email.toLowerCase().split('@')[1];
  return standardProviders.includes(domain);
}

async function handleCustomDomainWithRetry(senderConfig, emailData) {
  const domain = senderConfig.email.split('@')[1];
  console.log(`   🔧 Testing configurations for domain: ${domain}`);

  const configsToTry = [
    // Standard mail subdomain
    {
      host: `mail.${domain}`,
      port: 587,
      secure: false,
      requireTLS: true,
      description: `mail.${domain}:587 (STARTTLS)`
    },
    {
      host: `mail.${domain}`,
      port: 465,
      secure: true,
      description: `mail.${domain}:465 (SSL)`
    },
    // Direct domain
    {
      host: domain,
      port: 587,
      secure: false,
      requireTLS: true,
      description: `${domain}:587 (STARTTLS)`
    },
    {
      host: domain,
      port: 465,
      secure: true,
      description: `${domain}:465 (SSL)`
    },
    // SMTP subdomain
    {
      host: `smtp.${domain}`,
      port: 587,
      secure: false,
      requireTLS: true,
      description: `smtp.${domain}:587 (STARTTLS)`
    },
    {
      host: `smtp.${domain}`,
      port: 465,
      secure: true,
      description: `smtp.${domain}:465 (SSL)`
    },
    // Port 25 fallback
    {
      host: `mail.${domain}`,
      port: 25,
      secure: false,
      description: `mail.${domain}:25 (Standard)`
    }
  ];

  for (const config of configsToTry) {
    console.log(`   🔄 Trying: ${config.description}`);

    try {
      const testConfig = {
        ...config,
        auth: {
          user: senderConfig.smtpUser || senderConfig.email,
          pass: senderConfig.smtpPass
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: {
          rejectUnauthorized: false
        }
      };

      const transporter = nodemailer.createTransport(testConfig);
      await transporter.verify();
      console.log(`   ✅ Connection successful: ${config.description}`);

      const mailOptions = buildMailOptions(senderConfig, emailData);
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

  // If all configurations failed
  console.error(`   💡 All SMTP configurations failed for ${domain}`);
  console.error('   🔧 Please check your domain SMTP settings with your hosting provider');

  return {
    success: false,
    error: `All SMTP configurations failed for ${domain}. Check hosting SMTP settings.`,
    requiresManualConfig: true
  };
}

function buildTransporterConfig(senderConfig) {
  let config = {
    host: senderConfig.smtpHost,
    port: senderConfig.smtpPort,
    secure: senderConfig.smtpSecure || false,
    auth: {
      user: senderConfig.smtpUser,
      pass: senderConfig.smtpPass
    },
    connectionTimeout: 30000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: {
      rejectUnauthorized: false
    }
  };

  // Handle different service types
  if (senderConfig.smtpHost === 'smtp.gmail.com') {
    config.service = 'gmail';
  }

  if (senderConfig.smtpHost === 'smtp.office365.com') {
    config.requireTLS = true;
  }

  return config;
}

function buildMailOptions(senderConfig, emailData) {
  const mailOptions = {
    from: `"${senderConfig.name}" <${senderConfig.email}>`,
    to: emailData.to,
    subject: emailData.subject,
    html: emailData.html,
    messageId: `<${generateMessageId()}>`,
    headers: {
      'X-Mailer': 'EmailWarmupService',
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      'X-Priority': '3',
      'Importance': 'Normal',
      'Date': new Date().toUTCString()
    }
  };

  // Add text version
  if (emailData.html) {
    mailOptions.text = stripHtml(emailData.html);
  }

  return mailOptions;
}

function generateMessageId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 12);
  const domain = 'emailwarmup.service';
  return `${timestamp}.${random}@${domain}`;
}

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

// Queue management functions
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
  clearQueue
};