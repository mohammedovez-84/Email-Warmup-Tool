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



        if (!created) {
            return res.status(409).json({ success: false, message: 'Email already exists' });
        }

        return res.status(201).json({ success: true, message: 'Google user added and health check done', health });




    } catch (error) {
        console.error("DB ERROR:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};
