const nodemailer = require('nodemailer');

async function sendEmail(senderConfig, emailData) {
  try {
    let transporterConfig = {
      host: senderConfig.smtpHost,
      port: senderConfig.smtpPort,
      secure: senderConfig.smtpEncryption === 'SSL',
      auth: {
        user: senderConfig.smtpUser,
        pass: senderConfig.smtpPass
      },
      // Fix connection issues
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      // Disable TLS verification for development
      tls: {
        rejectUnauthorized: false
      }
    };

    // Special handling for Gmail
    if (senderConfig.smtpHost === 'smtp.gmail.com') {
      transporterConfig = {
        service: 'gmail',
        auth: {
          user: senderConfig.smtpUser,
          pass: senderConfig.smtpPass
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000
      };
    }

    // Special handling for Microsoft/Office365
    if (senderConfig.smtpHost === 'smtp.office365.com') {
      transporterConfig = {
        host: 'smtp.office365.com',
        port: 587,
        secure: false, // TLS for port 587
        auth: {
          user: senderConfig.smtpUser,
          pass: senderConfig.smtpPass || senderConfig.accessToken
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false
        }
      };
    }

    const transporter = nodemailer.createTransport(transporterConfig);

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
        'Importance': 'Normal'
      }
    };

    // Add in-reply-to headers if provided
    if (emailData.inReplyTo) {
      mailOptions.inReplyTo = emailData.inReplyTo;
      mailOptions.references = emailData.references || [emailData.inReplyTo];
    }

    console.log(`📧 Attempting to send email via ${senderConfig.smtpHost}:${senderConfig.smtpPort}`);
    const result = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully: ${result.messageId}`);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    console.error('❌ SMTP Config:', {
      host: senderConfig.smtpHost,
      port: senderConfig.smtpPort,
      user: senderConfig.smtpUser,
      hasPassword: !!senderConfig.smtpPass
    });
    return { success: false, error: error.message };
  }
}

function generateMessageId() {
  return `${Date.now()}${Math.random().toString(36).substr(2, 9)}@emailwarmup`;
}

module.exports = { sendEmail };