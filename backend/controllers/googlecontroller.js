const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const bcrypt = require('bcrypt');
const sequelize = require('../config/db');
const GoogleUser = require('../models/GoogleUser');
// const HealthCheck = require('../models/HealthCheck');
//const UserAlert = require('../models/UserAlert');
const { runHealthCheckInternal } = require('../services/internalhealth'); // adjust path



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

    // Basic validation to avoid undefined or missing parameters
    if (!name || !email || !appPassword) {
        return res.status(400).json({ success: false, message: 'Name, email, and app password are required.' });
    }

    try {
        const cleanedPassword = cleanAndValidatePassword(appPassword);
        // const hashedPassword = await bcrypt.hash(cleanedPassword, 10);

        // ✅ Use Sequelize Model instead of pool.execute
        const [user, created] = await GoogleUser.findOrCreate({
            where: { email },
            defaults: {
                name,
                app_password: cleanedPassword,
                user_id //
            },
        });


        // const health = await runHealthCheckInternal({ emails: [email] });

        // const blacklist = health.blacklist || [];

        // const lastStatus = blacklist.length > 0 ? 'blacklisted' : 'clean';
        // const status = blacklist.length > 0 ? 'fail' : 'pass';
        // const nextCheck = blacklist.length > 0
        //     ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        //     : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // // Insert into health_checks table (Sequelize)
        // const healthCheck = await HealthCheck.create({
        //     email: email,
        //     domain: health.domain || email.split('@')[1],
        //     mxRecords: health.mxRecords || [],
        //     spf: health.spf || null,
        //     dmarc: health.dmarc || null,
        //     dkim: health.dkim || {},
        //     blacklistResults: health.blacklist || [],
        //     detectedImpersonations: health.detectedImpersonations || [],
        //     notificationMessage: `Health check result: ${status}`,
        //     checkedAt: new Date(),
        //     createdAt: new Date(),
        //     updatedAt: new Date(),
        // });

        // // Generate summary message
        // function generateHealthCheckSummary(email, result) {
        //     const parts = [];

        //     if (result.spf) parts.push("SPF record is configured");
        //     else parts.push("SPF record is missing");

        //     if (result.dmarc) parts.push("DMARC record is configured");
        //     else parts.push("DMARC record is missing");

        //     if (result.dkim) parts.push("DKIM record is present");
        //     else parts.push("DKIM record is missing");

        //     const blacklisted = result.blacklist
        //         .filter(b => b.checks.some(c => c.listed))
        //         .map(b => b.ip);
        //     if (blacklisted.length) parts.push(`MX hosts blacklisted: ${blacklisted.join(", ")}`);
        //     else parts.push("No MX hosts are blacklisted");

        //     if (result.detectedImpersonations.length) {
        //         parts.push(`Detected impersonation domains: ${result.detectedImpersonations.join(", ")}`);
        //     } else {
        //         parts.push("No impersonation domains detected");
        //     }

        //     return `Health check summary for ${email}: ${parts.join("; ")}.`;
        // }
        // const summaryMessage = generateHealthCheckSummary(email, {
        //     domain: health.domain,
        //     mxRecords: health.mxRecords,
        //     spf: health.spf,
        //     dmarc: health.dmarc,
        //     dkim: health.dkim,
        //     blacklist: health.blacklist,
        //     detectedImpersonations: health.detectedImpersonations,
        // });

        // // Insert user alert (Sequelize)
        // await UserAlert.create({
        //     userId: user_id,  // assuming user ID is 1 for now
        //     type: 'health_check',
        //     message: `Health check completed for ${email}`,
        //     details: { summary: summaryMessage },
        //     isRead: 0,
        //     createdAt: new Date()
        // });


        if (!created) {
            return res.status(409).json({ success: false, message: 'Email already exists' });
        }

        return res.status(201).json({ success: true, message: 'Google user added and health check done', health });




    } catch (error) {
        console.error("DB ERROR:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};
