const nodemailer = require('nodemailer');

async function sendEmail(senderConfig, emailData) {
    try {
        console.log(`📧 Preparing to send email via ${senderConfig.smtpHost}:${senderConfig.smtpPort}`);

        let transporterConfig = {
            host: senderConfig.smtpHost,
            port: senderConfig.smtpPort,
            secure: senderConfig.smtpPort === 465 || senderConfig.smtpPort === 587,
            auth: {
                user: senderConfig.smtpUser,
                pass: senderConfig.smtpPass
            },
            connectionTimeout: 45000,
            greetingTimeout: 45000,
            socketTimeout: 60000,
            tls: {
                rejectUnauthorized: false
            }
        };

        // Special handling for Office365
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
                connectionTimeout: 45000,
                greetingTimeout: 45000,
                socketTimeout: 60000
            };
        }

        // Special handling for Gmail
        if (senderConfig.smtpHost === 'smtp.gmail.com') {
            transporterConfig = {
                service: 'gmail',
                auth: {
                    user: senderConfig.smtpUser,
                    pass: senderConfig.smtpPass
                },
                connectionTimeout: 45000,
                greetingTimeout: 45000,
                socketTimeout: 60000
            };
        }

        const transporter = nodemailer.createTransport(transporterConfig);

        // Verify connection
        await transporter.verify();

        const mailOptions = {
            from: `"${senderConfig.name}" <${senderConfig.email}>`,
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html,
            messageId: `<${generateMessageId()}>`,
            headers: {
                'X-Mailer': 'EmailWarmupService',
                'X-Auto-Response-Suppress': 'OOF, AutoReply'
            }
        };

        // Add reply headers if provided
        if (emailData.inReplyTo) {
            mailOptions.inReplyTo = emailData.inReplyTo;
            mailOptions.references = emailData.references || [emailData.inReplyTo];
        }

        const result = await transporter.sendMail(mailOptions);

        console.log(`✅ Email sent successfully: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        return { success: false, error: error.message };
    }
}

function generateMessageId() {
    return `${Date.now()}${Math.random().toString(36).substr(2, 9)}@emailwarmup`;
}

module.exports = { sendEmail };