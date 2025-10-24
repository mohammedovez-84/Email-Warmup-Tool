const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const { runHealthCheckInternal } = require('../services/internalhealth'); // adjust path
const SmtpAccount = require("../models/smtpAccounts")
const GoogleUser = require("../models/GoogleUser")
const MicrosoftUser = require("../models/MicrosoftUser")
const EmailPool = require("../models/EmailPool")



// Helper: Validate and sanitize app password
function cleanAndValidatePassword(pass) {
    if (!pass || typeof pass !== 'string') {
        throw new Error('App password is required and must be a string.');
    }
    const trimmed = pass.trim();
    if (/\s/.test(trimmed)) {
        throw new Error('App password should not contain spaces.');
    }
    return trimmed;
}


// SMTP TEST
exports.testSMTP = async (req, res) => {
    const { serviceName, email, appPassword } = req.body;
    const name = serviceName;

    try {
        const cleanedPassword = cleanAndValidatePassword(appPassword);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: email,
                pass: cleanedPassword,
            },
        });

        await transporter.verify();
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("SMTP ERROR:", error.message);
        return res.status(400).json({ success: false, error: error.message || error.toString() });
    }
};

// IMAP TEST
exports.testIMAP = async (req, res) => {
    const { serviceName, email, appPassword } = req.body;
    const name = serviceName;  // map to 'name'

    try {
        const cleanedPassword = cleanAndValidatePassword(appPassword);

        const config = {
            imap: {
                user: email,
                password: cleanedPassword,
                host: 'imap.gmail.com',
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false },
                authTimeout: 5000,
            },
        };

        const connection = await imaps.connect(config);
        await connection.end();

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("IMAP ERROR:", error.message);
        return res.status(400).json({ success: false, error: error.message || error.toString() });
    }
};

// ADD USER TO DB
exports.addGoogleUser = async (req, res) => {
    const { name, email, appPassword } = req.body;
    const user_id = req.user.id;
    console.log('Received payload:', { name, email, appPassword, user_id });

    if (!name || !email || !appPassword) {
        return res.status(400).json({ success: false, message: 'Name, email, and app password are required.' });
    }

    try {
        const cleanedPassword = cleanAndValidatePassword(appPassword);

        // ✅ FIRST: Check if email exists in EmailPool table
        const existingPoolAccount = await EmailPool.findOne({
            where: { email }
        });

        if (existingPoolAccount) {
            return res.status(409).json({
                success: false,
                message: 'This email already exists as a pool account',
                details: `Email ${email} is already registered as a pool account and cannot be added as a warmup account.`,
                conflict_type: 'pool_account_exists'
            });
        }

        // ✅ SECOND: Check if email exists in other warmup account tables
        const existingMicrosoftAccount = await MicrosoftUser.findOne({ where: { email } });
        if (existingMicrosoftAccount) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists as Microsoft account',
                conflict_type: 'microsoft_account_exists'
            });
        }

        const existingSmtpAccount = await SmtpAccount.findOne({ where: { email } });
        if (existingSmtpAccount) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists as SMTP account',
                conflict_type: 'smtp_account_exists'
            });
        }

        // ✅ THIRD: Now check/create Google user
        const [user, created] = await GoogleUser.findOrCreate({
            where: { email },
            defaults: {
                name,
                app_password: cleanedPassword,
                user_id
            },
        });

        if (!created) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists as Google account',
                conflict_type: 'google_account_exists'
            });
        }

        // ✅ Run domain-level health check
        const domain = email.split("@")[1];
        const health = await runHealthCheckInternal({
            emails: [email],
            domain,
            knownDomains: ["gmail.com", "outlook.com", "yahoo.com"],
        });

        return res.status(201).json({
            success: true,
            message: 'Google user added and domain health check completed successfully',
            health,
        });

    } catch (error) {
        console.error("DB ERROR:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};