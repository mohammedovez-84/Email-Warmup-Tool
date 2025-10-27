//  const { HealthCheck, UserAlert } = require('../models');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const { runHealthCheckInternal } = require('../services/internalhealth');
const SmtpAccount = require("../models/smtpAccounts")
const GoogleUser = require("../models/GoogleUser")
const MicrosoftUser = require("../models/MicrosoftUser")
const EmailPool = require("../models/EmailPool")
const HealthCheck = require("../models/HealthCheck")
const UserAlert = require("../models/UserAlert")

// Validate SMTP port ↔ encryption
function validateSmtp(port, encryption) {
    const p = parseInt(port);
    return (
        (p === 465 && encryption === 'SSL') ||
        ((p === 587 || p === 25) && (encryption === 'TLS' || encryption === 'None'))
    );
}

// Validate IMAP port ↔ encryption
function validateImap(port, encryption) {
    const p = parseInt(port);
    return (p === 993 && encryption === 'SSL') || (p === 143 && encryption === 'None');
}

exports.addAccount = async (req, res) => {
    const {
        sender_name, email,
        smtp_host, smtp_port, smtp_user, smtp_pass, smtp_encryption,
        imap_host, imap_port, imap_user, imap_pass, imap_encryption,
        description
    } = req.body;

    const user_id = req.user.id;

    try {
        // ✅ FIRST: Check if email exists in EmailPool table
        const existingPoolAccount = await EmailPool.findOne({
            where: { email }
        });

        if (existingPoolAccount) {
            return res.status(409).json({
                success: false,
                message: 'This email already exists in our system',
                details: `Email ${email} is already registered`,
                conflict_type: 'pool_account_exists'
            });
        }

        // ✅ SECOND: Check if email exists in other warmup account tables
        const existingGoogleAccount = await GoogleUser.findOne({ where: { email } });
        if (existingGoogleAccount) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists as Google account',
                conflict_type: 'google_account_exists'
            });
        }

        const existingMicrosoftAccount = await MicrosoftUser.findOne({ where: { email } });
        if (existingMicrosoftAccount) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists as Microsoft account',
                conflict_type: 'microsoft_account_exists'
            });
        }

        // ✅ THIRD: Check if email already exists in SMTP accounts (for updates)
        const existingSmtpAccount = await SmtpAccount.findOne({ where: { email } });
        if (existingSmtpAccount) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists as SMTP account',
                conflict_type: 'smtp_account_exists'
            });
        }

        const smtpUsername = smtp_user || email;
        const imapUsername = imap_user || email;
        const imapPassword = imap_pass || smtp_pass;
        const smtpEnc = smtp_encryption || 'None';
        const imapEnc = imap_encryption || 'None';

        if (!validateSmtp(smtp_port, smtpEnc)) {
            return res.status(400).json({
                success: false,
                error: `Invalid SMTP port (${smtp_port}) and encryption (${smtpEnc})`
            });
        }
        if (!validateImap(imap_port, imapEnc)) {
            return res.status(400).json({
                success: false,
                error: `Invalid IMAP port (${imap_port}) and encryption (${imapEnc})`
            });
        }

        // Test SMTP
        const transporter = nodemailer.createTransport({
            host: smtp_host,
            port: parseInt(smtp_port),
            secure: smtpEnc === 'SSL',
            auth: { user: smtpUsername, pass: smtp_pass },
            tls: { rejectUnauthorized: process.env.NODE_ENV !== 'development' }
        });
        await transporter.verify();

        // Test IMAP
        const client = new ImapFlow({
            host: imap_host,
            port: parseInt(imap_port),
            secure: imapEnc === 'SSL',
            auth: { user: imapUsername, pass: imapPassword },
            tls: { rejectUnauthorized: process.env.NODE_ENV !== 'development' }
        });
        await client.connect();
        await client.logout();

        // Save to DB
        const account = await SmtpAccount.create({
            user_id,
            sender_name,
            email,
            smtp_host,
            smtp_port,
            smtp_user: smtpUsername,
            smtp_pass,
            smtp_encryption: smtpEnc,
            imap_host,
            imap_port,
            imap_user: imapUsername,
            imap_pass: imapPassword,
            imap_encryption: imapEnc,
            description,
            warmupStatus: 'paused' // Default to paused for safety
        });

        // Run health check
        const health = await runHealthCheckInternal({ emails: [email] });

        // Save health check
        await HealthCheck.create({
            email,
            domain: health.domain || email.split('@')[1],
            mxRecords: health.mxRecords || [],
            spf: health.spf || null,
            dmarc: health.dmarc || null,
            dkim: health.dkim || {},
            blacklistResults: health.blacklist || [],
            detectedImpersonations: health.detectedImpersonations || [],
            notificationMessage: `Health check result: ${health.blacklist.length > 0 ? 'fail' : 'pass'}`,
            checkedAt: new Date()
        });

        // Send user alert
        await UserAlert.create({
            userId: user_id,
            type: 'health_check',
            message: `Health check completed for ${email}`,
            details: { health },
            isRead: 0,
            createdAt: new Date()
        });

        res.status(201).json({
            success: true,
            account,
            health,
            message: 'SMTP account added successfully. Warmup is paused by default - you can activate it from the dashboard.'
        });
    } catch (err) {
        console.error('Error adding account:', err.message);

        // Handle specific test failures vs general errors
        if (err.message.includes('Invalid login') || err.message.includes('Authentication failed')) {
            return res.status(400).json({
                success: false,
                error: 'SMTP/IMAP authentication failed. Please check your credentials.'
            });
        }

        if (err.message.includes('connect ECONNREFUSED') || err.message.includes('getaddrinfo')) {
            return res.status(400).json({
                success: false,
                error: 'Cannot connect to SMTP/IMAP server. Please check your host and port settings.'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: err.message
        });
    }
};

// Get all accounts for logged-in user
exports.getAccount = async (req, res) => {
    const user_id = req.user.id;
    try {
        const accounts = await SmtpAccount.findAll({ where: { user_id } });
        res.json(accounts);
    } catch (err) {
        console.error('Failed to fetch accounts:', err.message);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
};

// Test SMTP connection
exports.testSmtp = async (req, res) => {
    try {
        const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_encryption, email } = req.body;
        const username = smtp_user || email;
        const encryption = smtp_encryption || 'None';

        if (!validateSmtp(smtp_port, encryption)) {
            return res.status(400).json({ error: `Invalid SMTP port (${smtp_port}) and encryption (${encryption})` });
        }

        const transporter = nodemailer.createTransport({
            host: smtp_host,
            port: parseInt(smtp_port),
            secure: encryption === 'SSL',
            auth: { user: username, pass: smtp_pass },
            tls: { rejectUnauthorized: process.env.NODE_ENV !== 'development' }
        });
        await transporter.verify();
        res.status(200).json({ message: 'SMTP connection successful' });
    } catch (err) {
        console.error('SMTP test failed:', err.message);
        res.status(400).json({ error: 'SMTP test failed: ' + err.message });
    }
};

// Test IMAP connection
exports.testImap = async (req, res) => {
    try {
        const { imap_host, imap_port, imap_user, imap_pass, imap_encryption, email, smtp_pass } = req.body;
        const username = imap_user || email;
        const password = imap_pass || smtp_pass;
        const encryption = imap_encryption || 'None';

        if (!validateImap(imap_port, encryption)) {
            return res.status(400).json({ error: `Invalid IMAP port (${imap_port}) and encryption (${encryption})` });
        }

        const client = new ImapFlow({
            host: imap_host,
            port: parseInt(imap_port),
            secure: encryption === 'SSL',
            auth: { user: username, pass: password },
            tls: { rejectUnauthorized: process.env.NODE_ENV !== 'development' }
        });
        await client.connect();
        await client.logout();
        res.status(200).json({ message: 'IMAP connection successful' });
    } catch (err) {
        console.error('IMAP test failed:', err.message);
        res.status(400).json({ error: 'IMAP test failed: ' + err.message });
    }
};

// Update account status
exports.updateStatus = async (req, res) => {
    const { email, status } = req.body;
    if (!email || !status) return res.status(400).json({ message: 'Email and status are required.' });

    try {
        // Try GoogleUser first
        const [updatedGoogle] = await db.query(
            'UPDATE google_users SET status = ? WHERE email = ?',
            [status, email]
        );

        // If not found, update SMTP account
        if (updatedGoogle.affectedRows === 0) {
            const account = await SmtpAccount.findOne({ where: { email } });
            if (!account) return res.status(404).json({ message: 'Account not found' });

            account.warmupStatus = status;
            await account.save();
        }

        res.json({ message: 'Status updated successfully' });
    } catch (err) {
        console.error('Error updating status:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};
