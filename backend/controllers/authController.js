const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { generateOTP } = require('../utils/tokenUtils');
const logger = require('../utils/logger');
const QRCode = require('qrcode');

// ✅ Mailer setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASSWORD,
    }
});


// ✅ signup new user
exports.signup = async (req, res) => {
    const {
        name,
        lastname,
        email,
        password,
        title,
        company,
        phone,
        industry,
    } = req.body;

    try {
        if (!name || !lastname || !email || !password) {
            return res.status(400).json({
                success: false,   // ✅ add success flag
                error: 'First name, last name, email, and password are required'
            });
        }

        const existing = await User.findOne({ where: { email } });
        if (existing) {
            console.log(`❌ Registration failed: ${email} already exists`);
            return res.status(400).json({
                success: false,   // ✅ add success flag
                error: 'Email already signuped'
            });
        }

        const hashed = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        const user = await User.create({   // ✅ store user in a variable
            name,
            lastname,
            title,
            email,
            password: hashed,   // ⚠️ remove duplicate `password` line
            company,
            phone,
            industry,
            email_verification_token: otp,
            email_verification_expires: expiry
        });

        await transporter.sendMail({
            to: email,
            subject: 'Email Verification OTP',
            text: `Your OTP is ${otp}`
        });

        logger.log(`📨 OTP sent to ${email}`);
        console.log(`✅ signuped ${email}, OTP sent`);


        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1h" })

        // ✅ Always return a proper JSON response
        return res.status(201).json({
            success: true,    // ✅ add success flag
            message: 'Signup successful, check email for OTP',
            requiresEmailVerification: true,
            token,
            user: {           // ✅ include safe user info
                id: user.id,
                email: user.email,
                name: user.name,
                lastname: user.lastname,
                isVerified: false
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,   // ✅ add success flag
            message: 'Signup failed',
            error: error.message
        });
    }
};

// ✅ Verify Email OTP
exports.verifyEmail = async (req, res) => {
    const userId = req.user?.id;
    const { otp } = req.body;

    try {
        if (!otp) {
            console.log('❌ Missing OTP in request');
            return res.status(400).json({ error: ' OTP is required' });
        }

        const user = await User.findOne({ where: { id: userId } })

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.email_verified) {

            return res.status(400).json({ error: 'Email already verified' });
        }

        if (
            user.email_verification_token !== otp ||
            !user.email_verification_expires ||
            new Date() > user.email_verification_expires
        ) {

            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        await user.update({
            email_verified: true,
            email_verification_token: null,
            email_verification_expires: null
        });


        res.json({ message: 'Email verified successfully' });

    } catch (err) {

        res.status(500).json({ error: 'Internal server error during verification' });
    }
};

exports.resendOTP = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.email_verified) {
            return res.status(400).json({ error: 'Email already verified' });
        }

        const otp = generateOTP();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        await user.update({
            email_verification_token: otp,
            email_verification_expires: expiry
        });

        await transporter.sendMail({
            to: email,
            subject: 'Resend Email Verification OTP',
            text: `Your new OTP is: ${otp}`
        });

        console.log(`📨 OTP resent to ${email}`);
        res.json({ message: 'OTP resent to your email' });

    } catch (err) {
        console.error('❌ Resend OTP Error:', err.message);
        res.status(500).json({ error: 'Failed to resend OTP' });
    }
};

// ✅ Basic Login (without 2FA)
exports.basicLogin = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        // ✅ COMPARE password using bcrypt
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        // (Optional) Check if email is verified
        if (!user.email_verified) {
            return res.status(403).json({ message: 'Email not verified. Please verify via OTP.' });
        }

        // ✅ Generate JWT Token
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
            expiresIn: '1h'
        });
        // const name = `${first_name} ${last_name}`.trim();
        return res.status(200).json({

            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Something went wrong during login.' });
    }
};

// ✅ Login (with 2FA check)
exports.login = async (req, res) => {
    const { email, password } = req.body;
    console.log("📥 Login request received");
    console.log("➡️ Email:", email);
    console.log("➡️ Password:", password);

    try {
        const user = await User.findOne({ where: { email } });

        if (!user) {
            console.log("❌ User not found for email:", email);
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.email_verified) {
            console.log("⚠️ Email not verified for:", email);
            return res.status(400).json({ message: 'Email not verified' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        console.log("🔐 Password match result:", isMatch);

        if (!isMatch) {
            console.log("❌ Invalid password for:", email);
            return res.status(400).json({ message: 'Invalid password' });
        }

        if (user.account_locked_until && new Date() < user.account_locked_until) {
            return res.status(403).json({ message: 'Account temporarily locked. Try later.' });
        }

        // 2FA flow
        if (user.two_fa_enabled) {
            const method = user.two_fa_secret ? 'app' : 'email';
            return res.status(200).json({
                message: '2FA required',
                two_fa_required: true,
                method,
                email: user.email
            });
        }
        // No 2FA: proceed to login
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

        await user.update({
            failed_login_attempts: 0,
            last_login: new Date()
        });

        console.log(`✅ Login success for ${email}`);
        res.status(200).json({
            message: 'Login successful',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            token
        });

    } catch (err) {
        console.error('❌ Login error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
};
// ✅ Verify 2FA token 
exports.verify2FA = async (req, res) => {
    const { otp, email, method } = req.body;

    console.log("=== 2FA VERIFICATION ===");
    console.log("Email:", email);
    console.log("OTP:", otp);
    console.log("Method:", method);
    console.log("User from JWT:", req.user);

    try {
        if (!req.user?.id && !email) {
            console.log("❌ Missing both user ID and email");
            return res.status(400).json({ message: 'Email or JWT required for verification' });
        }

        const user = req.user?.id
            ? await User.findByPk(req.user.id)
            : await User.findOne({ where: { email } });

        if (!user) {
            console.log("❌ User not found");
            return res.status(404).json({ message: 'User not found' });
        }

        console.log("👤 Found user:", user.email);
        console.log("📝 User 2FA temp secret:", user.two_fa_temp_secret);
        console.log("📝 User 2FA secret:", user.two_fa_secret);
        console.log("📝 User 2FA enabled:", user.two_fa_enabled);
        console.log("📝 User 2FA method:", user.two_fa_method);

        if (!['app', 'email'].includes(method)) {
            console.log("❌ Invalid method:", method);
            return res.status(400).json({ message: 'Invalid 2FA method' });
        }

        let verified = false;

        // 🔹 Email OTP
        if (method === 'email') {
            console.log("🔍 Checking email OTP verification");
            if (user.two_fa_temp_secret && user.two_fa_temp_secret === otp) {
                verified = true;
                console.log("✅ Email OTP verified successfully");
                await user.update({
                    two_fa_enabled: true,
                    two_fa_method: 'email',
                    two_fa_temp_secret: null
                });
            } else {
                console.log("❌ Invalid email OTP");
                console.log("Expected:", user.two_fa_temp_secret);
                console.log("Received:", otp);
                return res.status(400).json({ message: 'Invalid or expired OTP' });
            }
        }

        // 🔹 Authenticator App (TOTP)
        if (method === 'app') {
            console.log("🔍 Checking app OTP verification");
            if (!user.two_fa_secret) {
                console.log("❌ 2FA not set up for this user");
                return res.status(400).json({ message: '2FA not set up for this user' });
            }

            verified = speakeasy.totp.verify({
                secret: user.two_fa_secret,
                encoding: 'base32',
                token: otp,
                window: 2
            });

            if (!verified) {
                console.log("❌ Invalid app OTP");
                return res.status(400).json({ message: 'Invalid 2FA token' });
            }

            // Always update last login and reset failed attempts, even if 2FA is already enabled
            await user.update({
                failed_login_attempts: 0,
                last_login: new Date()
            });

            // Only update 2FA enabled status if it's not already enabled
            if (!user.two_fa_enabled) {
                console.log("✅ Enabling 2FA for app");
                await user.update({ two_fa_enabled: true, two_fa_method: 'app' });
            }
        }

        // ✅ ALWAYS Issue JWT when verification is successful
        if (verified) {
            const jwtToken = jwt.sign(
                { id: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            console.log("✅ 2FA verification successful");
            return res.status(200).json({
                message: '2FA verification successful',
                token: jwtToken,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                }
            });
        } else {
            console.log("❌ Verification failed");
            return res.status(400).json({ message: 'Verification failed' });
        }

    } catch (err) {
        console.error('❌ 2FA verify error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
// ✅ Setup 2FA (JWT-based, safer)
exports.setup2FA = async (req, res) => {
    try {
        // If user is authenticated via JWT
        const userId = req.user?.id;
        const { email, method } = req.body;
        let user;

        if (userId) {
            user = await User.findByPk(userId);
        } else if (req.body.email) {
            // fallback to email (legacy)
            user = await User.findOne({ where: { email: req.body.email } });
        }

        if (!user) return res.status(404).json({ message: 'User not found' });

        if (method === 'app') {
            const secret = speakeasy.generateSecret({
                name: `YourAppName (${user.email})`,
                issuer: 'YourApp'

            });

            await user.update({
                two_fa_secret: secret.base32,
                two_fa_method: 'app'
                // ⚠️ do NOT enable yet — user must confirm with a token in enable2FA
            });

            const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

            console.log(`✅ 2FA setup QR generated for ${user.email}`);
            res.json({
                message: 'Scan the QR code with Google Authenticator',
                secret: secret.base32,
                otpauth_url: secret.otpauth_url,
                qr_code: qrDataUrl
            });
        } else if (method === 'email') {
            // Generate OTP for email verification
            const otp = generateOTP();
            await user.update({
                two_fa_temp_secret: otp,
                two_fa_method: 'email' // ✅ Set the method
            });

            // Send OTP via email
            await transporter.sendMail({
                to: user.email,
                subject: "Your 2FA Setup OTP",
                text: `Your 2FA setup OTP is: ${otp}`
            });

            console.log(`✅ OTP sent for email 2FA setup: ${user.email}`);
            return res.json({
                message: 'OTP sent to your email for verification'
            });

        } else {
            return res.status(400).json({ message: 'Invalid 2FA method' });
        }

    } catch (err) {
        console.error('❌ Setup 2FA error:', err.message);
        res.status(500).json({ message: 'Failed to setup 2FA' });
    }
};

// ✅ Enable 2FA (confirm with token)
exports.enable2FA = async (req, res) => {
    const { token } = req.body;
    try {
        const userId = req.user?.id;
        let user;

        if (userId) {
            user = await User.findByPk(userId);
        } else if (req.body.email) {
            user = await User.findOne({ where: { email: req.body.email } });
        }

        if (!user || !user.two_fa_secret) {
            return res.status(400).json({ message: '2FA not initialized' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.two_fa_secret,
            encoding: 'base32',
            token,
            window: 2
        });

        if (!verified) return res.status(400).json({ message: 'Invalid 2FA token' });

        await user.update({ two_fa_enabled: true });

        console.log(`✅ 2FA enabled for ${user.email}`);
        res.json({ message: '2FA enabled successfully' });

    } catch (err) {
        console.error('❌ Enable 2FA error:', err.message);
        res.status(500).json({ message: 'Failed to enable 2FA' });
    }
};




// ✅ Disable 2FA (JWT first, fallback email)
exports.disable2FA = async (req, res) => {
    try {
        const userId = req.user?.id;
        let user;

        if (userId) {
            user = await User.findByPk(userId);
        } else if (req.body.email) {
            user = await User.findOne({ where: { email: req.body.email } });
        }

        if (!user) return res.status(404).json({ message: 'User not found' });

        await user.update({
            two_fa_enabled: false, two_fa_secret: null, two_fa_method: null,      // ✅ Add this
            two_fa_temp_secret: null
        });

        console.log(`🔓 2FA disabled for ${user.email}`);
        res.json({ success: true, message: '2FA disabled' });

    } catch (err) {
        console.error('❌ Disable 2FA error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to disable 2FA' });
    }
};

// ✅ Forgot password
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(400).json({ error: 'User not found' });

        const otp = generateOTP();
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        await user.update({
            reset_password_token: otp,
            reset_password_expires: expires,
            reset_token_used: false
        });

        await transporter.sendMail({
            to: email,
            subject: 'Password Reset OTP',
            text: `Reset OTP: ${otp}`
        });

        logger.log(`🔐 Sent password reset OTP to ${email}`);
        console.log(`📨 Reset OTP sent to ${email}`);
        res.json({ message: 'OTP sent to email' });

    } catch (err) {
        console.error('❌ Forgot password error:', err.message);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
};

// ✅ Verify reset OTP
exports.verifyResetOtp = async (req, res) => {
    const { email, otp } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || user.reset_password_token !== otp || new Date() > user.reset_password_expires) {
        console.log(`❌ Invalid or expired reset OTP for ${email}`);
        return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    console.log(`✅ OTP verified for reset password: ${email}`);
    res.json({ message: 'OTP verified' });
};

// ✅ Reset password
exports.resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || user.reset_password_token !== otp || user.reset_token_used || new Date() > user.reset_password_expires) {
        console.log(`❌ Reset password failed for ${email}`);
        return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await user.update({
        password: hashed,
        reset_token_used: true
    });

    logger.log(`🔐 Password reset for ${email}`);
    console.log(`✅ Password successfully reset for ${email}`);
    res.json({ message: 'Password reset successful' });
};



exports.updatePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        const user = await User.findByPk(req.user.id); // or req.user._id if Mongo

        if (!user) return res.status(404).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(400).json({ error: "Old password is incorrect" });

        const hashed = await bcrypt.hash(newPassword, 10);
        user.password = hashed;
        await user.save();

        res.json({ message: "Password updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.sendLoginOTP = async (req, res) => {
    try {
        const { email, method } = req.body;
        console.log("📨 Sending login OTP for:", email, "Method:", method);

        if (!email || !method) {
            return res.status(400).json({ message: "Email and method are required" });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generate OTP
        const otp = generateOTP();
        console.log("📝 Generated OTP:", otp);

        if (method === "email") {
            // For 2FA setup, use two_fa_temp_secret
            // Use save() instead of update() to ensure proper persistence
            user.two_fa_temp_secret = otp;
            user.two_fa_method = 'email';
            await user.save(); // ← Use save() instead of update()

            console.log("💾 Saved OTP to user record:", user.two_fa_temp_secret);

            // Use nodemailer transporter
            await transporter.sendMail({
                to: user.email,
                subject: "Your 2FA Setup OTP",
                text: `Your 2FA setup OTP is: ${otp}. This code will expire in 10 minutes.`,
            });

            console.log(`📨 Login OTP sent to ${email}`);
            return res.json({
                message: "OTP sent to email"
            });
        }

        return res.status(400).json({ message: "Unsupported 2FA method" });
    } catch (err) {
        console.error("❌ Error in sendLoginOTP:", err);
        res.status(500).json({ message: "Failed to send OTP" });
    }
};