const db = require('../config/db');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');

function validateSmtp(port, encryption) {
    const p = parseInt(port);
    return (
        (p === 465 && encryption === 'SSL') ||
        ((p === 587 || p === 25) && (encryption === 'TLS' || encryption === 'None'))
    );
}



// 🔐 Strict IMAP Port ↔ Encryption validation
function validateImap(port, encryption) {
    const p = parseInt(port);
    return (p === 993 && encryption === 'SSL') ||
        (p === 143 && encryption === 'None');
}

// ✅ Add & Save SMTP/IMAP account
exports.addAccount = async (req, res) => {
    const {
        sender_name, email,
        smtp_host, smtp_port, smtp_user, smtp_pass, smtp_encryption,
        imap_host, imap_port, imap_user, imap_pass, imap_encryption
    } = req.body;

    const user_id = req.user.id;

    const smtpUsername = smtp_user || email;
    const imapUsername = imap_user || email;
    const imapPassword = imap_pass || smtp_pass;

    let smtpEnc = smtp_encryption || 'None';
    let imapEnc = imap_encryption || 'None';

    // ❌ Validate encryption-port pairs strictly
    if (!validateSmtp(smtp_port, smtpEnc)) {
        return res.status(400).json({ error: `❌ Invalid SMTP port (${smtp_port}) and encryption (${smtp_encryption}) combination` });
    }

    if (!validateImap(imap_port, imapEnc)) {
        return res.status(400).json({ error: `❌ Invalid IMAP port (${imap_port}) and encryption (${imap_encryption}) combination` });
    }

    // ✅ Test SMTP
    const transporter = nodemailer.createTransport({
        host: smtp_host,
        port: parseInt(smtp_port),
        secure: smtpEnc === 'SSL',
        auth: {
            user: smtpUsername,
            pass: smtp_pass
        },
        tls: { rejectUnauthorized: process.env.NODE_ENV !== 'development' }
    });

    try {
        await transporter.verify();
    } catch (err) {
        console.error('❌ SMTP test failed:', err.message);
        return res.status(400).json({ error: 'SMTP test failed: ' + err.message });
    }

    // ✅ Test IMAP
    const client = new ImapFlow({
        host: imap_host,
        port: parseInt(imap_port),
        secure: imapEnc === 'SSL',
        auth: {
            user: imapUsername,
            pass: imapPassword
        },
        tls: { rejectUnauthorized: process.env.NODE_ENV !== 'development' }
    });

    try {
        await client.connect();
        await client.logout();
    } catch (err) {
        console.error('❌ IMAP test failed:', err.message);
        return res.status(400).json({ error: 'IMAP test failed: ' + err.message });
    }

    // ✅ Save to DB
    try {
        await db.query(
            `INSERT INTO smtpimap_accounts (
                sender_name, email, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_encryption,
                imap_host, imap_port, imap_user, imap_pass, imap_encryption, user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            {
                replacements: [
                    sender_name, email,
                    smtp_host, smtp_port, smtp_user, smtp_pass, smtpEnc,
                    imap_host, imap_port, imap_user, imap_pass, imapEnc,
                    user_id
                ],
                type: db.QueryTypes.INSERT
            }
        );
        // ✅ Run health check
        const health = await runHealthCheckInternal({ emails: [email] });
        const blacklist = health.blacklist || [];

        const lastStatus = blacklist.length > 0 ? 'blacklisted' : 'clean';
        const status = blacklist.length > 0 ? 'fail' : 'pass';
        const nextCheck = blacklist.length > 0
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const healthCheck = await HealthCheck.create({
            email: email,
            domain: health.domain || email.split('@')[1],
            mxRecords: health.mxRecords || [],
            spf: health.spf || null,
            dmarc: health.dmarc || null,
            dkim: health.dkim || {},
            blacklistResults: health.blacklist || [],
            detectedImpersonations: health.detectedImpersonations || [],
            notificationMessage: `Health check result: ${status}`,
            checkedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Summary builder
        function generateHealthCheckSummary(email, result) {
            const parts = [];
            parts.push(result.spf ? "SPF record is configured" : "SPF record is missing");
            parts.push(result.dmarc ? "DMARC record is configured" : "DMARC record is missing");
            parts.push(result.dkim ? "DKIM record is present" : "DKIM record is missing");

            const blacklisted = result.blacklist
                .filter(b => b.checks.some(c => c.listed))
                .map(b => b.ip);
            if (blacklisted.length) parts.push(`MX hosts blacklisted: ${blacklisted.join(", ")}`);
            else parts.push("No MX hosts are blacklisted");

            if (result.detectedImpersonations.length) {
                parts.push(`Detected impersonation domains: ${result.detectedImpersonations.join(", ")}`);
            } else {
                parts.push("No impersonation domains detected");
            }
            return `Health check summary for ${email}: ${parts.join("; ")}.`;
        }

        const summaryMessage = generateHealthCheckSummary(email, health);

        await UserAlert.create({
            userId: user_id,
            type: 'health_check',
            message: `Health check completed for ${email}`,
            details: { summary: summaryMessage },
            isRead: 0,
            createdAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'SMTP/IMAP account added and health check done',
            health
        });


        res.status(201).json({ message: 'SMTP/IMAP added successfully.' });
    } catch (error) {
        console.error('❌ Error inserting SMTP/IMAP or running health check:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
// ✅ Get All Saved Accounts
exports.getAccount = async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT * FROM smtpimap_accounts`);
        res.json(rows);
    } catch (err) {
        console.error('❌ Failed to fetch accounts:', err.message);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
};

// ✅ Test SMTP Only
exports.testSmtp = async (req, res) => {
    try {
        const {
            smtp_host, smtp_port, smtp_user, smtp_pass, smtp_encryption, email
        } = req.body;

        const username = smtp_user || email;
        const encryption = smtp_encryption || 'None';

        // ❌ Strict SMTP encryption/port check
        if (!validateSmtp(smtp_port, encryption)) {
            return res.status(400).json({ error: `❌ Invalid SMTP port (${smtp_port}) and encryption (${encryption}) combination` });
        }

        const transporter = nodemailer.createTransport({
            host: smtp_host,
            port: parseInt(smtp_port),
            secure: encryption === 'SSL',
            auth: {
                user: username,
                pass: smtp_pass
            },
            tls: { rejectUnauthorized: process.env.NODE_ENV !== 'development' }
        });

        await transporter.verify();
        res.status(200).json({ message: '✅ SMTP connection successful' });

    } catch (err) {
        console.error('❌ SMTP test failed:', err.message);
        res.status(400).json({ error: 'SMTP connection failed: ' + err.message });
    }
};

// ✅ Test IMAP Only
exports.testImap = async (req, res) => {
    try {
        const {
            imap_host, imap_port, imap_user, imap_pass, imap_encryption, email, smtp_pass
        } = req.body;

        const username = imap_user || email;
        const password = imap_pass || smtp_pass;
        const encryption = imap_encryption || 'None';

        // ❌ Strict IMAP encryption/port check
        if (!validateImap(imap_port, encryption)) {
            return res.status(400).json({ error: `❌ Invalid IMAP port (${imap_port}) and encryption (${encryption}) combination` });
        }

        const client = new ImapFlow({
            host: imap_host,
            port: parseInt(imap_port),
            secure: encryption === 'SSL',
            auth: {
                user: username,
                pass: password
            },
            tls: { rejectUnauthorized: process.env.NODE_ENV !== 'development' }
        });

        await client.connect();
        await client.logout();
        res.status(200).json({ message: '✅ IMAP connection successful' });

    } catch (err) {
        console.error('❌ IMAP test failed:', err.message);
        res.status(400).json({ error: 'IMAP connection failed: ' + err.message });
    }
};

// ✅ Update Account Status (Enhanced Version)
exports.updateStatus = async (req, res) => {
    const { email, status } = req.body;

    if (!email || !status) {
        return res.status(400).json({ message: 'Email and status are required.' });
    }

    try {
        // Check and update in Google users
        const [googleRows] = await db.query(
            'UPDATE google_users SET status = ? WHERE email = ?',
            [status, email]
        );

        // If not found in Google, try in SMTP
        if (googleRows.affectedRows === 0) {
            const [smtpRows] = await db.query(
                'UPDATE smtpimap_accounts SET status = ? WHERE email = ?',
                [status, email]
            );

            if (smtpRows.affectedRows === 0) {
                return res.status(404).json({ message: 'Account not found' });
            }
        }

        return res.json({ message: 'Status updated successfully' });
    } catch (err) {
        console.error('❌ Error updating status:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};