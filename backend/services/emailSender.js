const nodemailer = require('nodemailer');

async function sendEmail(senderConfig, emailData) {
  try {
    console.log(`📧 Sending via ${senderConfig.smtpHost}:${senderConfig.smtpPort}`);
    console.log(`   From: ${senderConfig.email} → To: ${emailData.to}`);

    let transporterConfig = {
      host: senderConfig.smtpHost,
      port: senderConfig.smtpPort,
      secure: senderConfig.smtpPort === 465 || senderConfig.smtpEncryption === 'SSL',
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

    // Gmail configuration
    if (senderConfig.smtpHost === 'smtp.gmail.com') {
      transporterConfig = {
        service: 'gmail',
        auth: {
          user: senderConfig.smtpUser,
          pass: senderConfig.smtpPass
        },
        connectionTimeout: 30000,
        greetingTimeout: 15000,
        socketTimeout: 30000
      };
    }

    // Office365 configuration
    if (senderConfig.smtpHost === 'smtp.office365.com') {
      transporterConfig = {
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: senderConfig.smtpUser,
          pass: senderConfig.smtpPass
        },
        connectionTimeout: 30000,
        greetingTimeout: 15000,
        socketTimeout: 30000
      };
    }

    // **FIX: Generic Custom SMTP Server Configuration for ANY domain**
    const isGmail = senderConfig.smtpHost === 'smtp.gmail.com';
    const isOutlook = senderConfig.smtpHost === 'smtp.office365.com';
    const isCustomSmtp = !isGmail && !isOutlook;

    if (isCustomSmtp) {
      console.log(`   🔧 Configuring custom SMTP: ${senderConfig.smtpHost}`);

      transporterConfig = {
        host: senderConfig.smtpHost,
        port: senderConfig.smtpPort,
        secure: senderConfig.smtpPort === 465, // true for 465, false for 587
        auth: {
          user: senderConfig.smtpUser,
          pass: senderConfig.smtpPass
        },
        connectionTimeout: 20000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        tls: {
          rejectUnauthorized: false
        },
        ignoreTLS: senderConfig.smtpEncryption === 'None',
        requireTLS: senderConfig.smtpEncryption === 'TLS'
      };

      // Log the configuration being used
      if (senderConfig.smtpPort === 465) {
        console.log(`   🔄 Port 465 detected - using SSL configuration`);
        transporterConfig.secure = true;
      } else if (senderConfig.smtpPort === 587) {
        console.log(`   🔄 Port 587 detected - using STARTTLS configuration`);
        transporterConfig.secure = false;
        transporterConfig.requireTLS = true;
      } else {
        console.log(`   🔄 Custom port ${senderConfig.smtpPort} - auto-detecting security`);
      }
    }

    console.log(`   ⚙️  SMTP Config: ${transporterConfig.host}:${transporterConfig.port}, secure: ${transporterConfig.secure}`);

    const transporter = nodemailer.createTransport(transporterConfig);

    // Verify connection with better error handling
    console.log('   🔄 Verifying SMTP connection...');
    try {
      await transporter.verify();
      console.log('   ✅ SMTP connection verified');
    } catch (verifyError) {
      console.error(`   ❌ SMTP verification failed: ${verifyError.message}`);

      // Try alternative configuration for ALL custom domains
      if (isCustomSmtp) {
        console.log(`   🔄 Trying alternative configuration for custom domain...`);

        // Try port 587 instead of 465
        if (senderConfig.smtpPort === 465) {
          console.log(`   🔄 Switching from port 465 to 587`);
          return await sendEmailWithAlternativeConfig(senderConfig, emailData, 587);
        }
        // Try port 465 instead of 587  
        else if (senderConfig.smtpPort === 587) {
          console.log(`   🔄 Switching from port 587 to 465`);
          return await sendEmailWithAlternativeConfig(senderConfig, emailData, 465);
        }
      }

      throw verifyError;
    }

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

    // Add text version for better deliverability
    if (emailData.html) {
      mailOptions.text = stripHtml(emailData.html);
    }

    // Add reply headers if provided
    if (emailData.inReplyTo) {
      mailOptions.inReplyTo = emailData.inReplyTo;
      mailOptions.references = emailData.references || [emailData.inReplyTo];
      console.log('   🔄 This is a reply email');
    }

    console.log('   📤 Sending email...');
    const result = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully: ${result.messageId}`);
    console.log(`   📧 Response: ${result.response}`);

    return {
      success: true,
      messageId: result.messageId,
      response: result.response
    };

  } catch (error) {
    console.error('❌ Email sending failed:', error.message);

    // More specific error handling
    if (error.code === 'EAUTH') {
      console.error('   🔐 Authentication failed - check credentials');
    } else if (error.code === 'ECONNECTION') {
      console.error('   🌐 Connection failed - check network/SMTP settings');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('   ⏰ Connection timeout - server might be busy');
    } else if (error.code === 'ESOCKET' || error.message.includes('Greeting never received')) {
      console.error('   🔌 Socket error - SMTP server not responding');
      console.error('   💡 Try: Different port (587 instead of 465) or check server status');
    }

    return {
      success: false,
      error: error.message,
      errorCode: error.code
    };
  }
}

// Helper function to try alternative configurations
async function sendEmailWithAlternativeConfig(senderConfig, emailData, alternativePort) {
  const alternativeConfig = {
    ...senderConfig,
    smtpPort: alternativePort
  };

  console.log(`   🔧 Trying alternative port: ${alternativePort}`);
  return await sendEmail(alternativeConfig, emailData);
}

function generateMessageId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 12);
  const domain = 'emailwarmup.service';
  return `${timestamp}.${random}@${domain}`;
}

function stripHtml(html) {
  if (!html) return '';

  // Simple HTML to text conversion
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p\s*\/?>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

module.exports = { sendEmail };