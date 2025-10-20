require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');


require('./config/microsoftStrategy');
const { sequelize } = require('./config/db');

// 🟢 Import scheduler and consumer AFTER DB
const { startWarmupScheduler } = require('./services/warmupScheduler');
const { consumeWarmupJobs } = require("./workers/warmupWorker");

// Routes
const microsoftAuthRoutes = require('./routes/microsoftAuth');
const authRoutes = require('./routes/auth');
const googleRoutes = require('./routes/googleRoutes');
const microsoftRoutes = require('./routes/microsoftRoutes');
const smtpImapRoutes = require('./routes/SmtpImap');
const dashboardRoutes = require('./routes/dashboardRoutes');
const warmupRoutes = require('./routes/warmupRoutes');
const userRoutes = require('./routes/users');
const metricsRoutes = require('./routes/metricsRoutes');
const healthRoutes = require('./routes/healthRoutes');

// Import models for validation
const GoogleUser = require('./models/GoogleUser');
const MicrosoftUser = require('./models/MicrosoftUser');
const SmtpAccount = require('./models/smtpAccounts');
const { buildSenderConfig } = require('./utils/senderConfig');
const { IntelligentWarmupWorker } = require('./workers/warmup');
const { scheduleIntelligentWarmup } = require('./services/Scheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your-secret',
    resave: false,
    saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth/microsoft2', microsoftAuthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', googleRoutes);
app.use('/auth', microsoftRoutes);
app.use('/api', smtpImapRoutes);
app.use('/api/accounts', dashboardRoutes);
app.use('/api/warmup', warmupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/health', healthRoutes);

// Account validation function
async function validateAllAccounts() {
    try {
        console.log('🔍 Validating all active account configurations...');

        const allAccounts = [
            ...(await GoogleUser.findAll({ where: { warmupStatus: 'active' } })),
            ...(await SmtpAccount.findAll({ where: { warmupStatus: 'active' } })),
            ...(await MicrosoftUser.findAll({ where: { warmupStatus: 'active' } }))
        ];

        let validCount = 0;
        let invalidCount = 0;

        for (const account of allAccounts) {
            try {
                const accountType = account.roundRobinIndexGoogle ? 'google' :
                    account.roundRobinIndexMicrosoft ? 'microsoft' : 'smtp';
                const config = buildSenderConfig(account, accountType);

                // Validate critical configuration fields
                if (!config.smtpHost || !config.smtpPort || !config.smtpUser) {
                    throw new Error('Missing SMTP configuration');
                }

                if (accountType === 'google' && !config.smtpPass) {
                    throw new Error('Missing app password for Gmail');
                }

                if (accountType === 'smtp' && !config.smtpPass) {
                    throw new Error('Missing SMTP password');
                }

                console.log(`✅ ${account.email}: Configuration valid (${config.smtpHost}:${config.smtpPort})`);
                validCount++;
            } catch (error) {
                console.error(`❌ ${account.email}: ${error.message}`);
                invalidCount++;

                // Auto-pause accounts with invalid configuration
                await account.update({ warmupStatus: 'paused' });
                console.log(`⏸️  Auto-paused ${account.email} due to configuration issues`);
            }
        }

        console.log(`📊 Validation Results: ${validCount} valid, ${invalidCount} invalid accounts`);

    } catch (error) {
        console.error('Account validation error:', error);
    }
}

// Test endpoint for account configuration
app.get('/api/account/:email/test-config', async (req, res) => {
    try {
        const { email } = req.params;

        // Find account in any table
        let account = await GoogleUser.findOne({ where: { email } });
        let accountType = 'google';

        if (!account) {
            account = await MicrosoftUser.findOne({ where: { email } });
            accountType = 'microsoft';
        }
        if (!account) {
            account = await SmtpAccount.findOne({ where: { email } });
            accountType = 'smtp';
        }

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        try {
            const config = buildSenderConfig(account, accountType);

            return res.json({
                success: true,
                email: email,
                type: accountType,
                smtpConfig: {
                    host: config.smtpHost,
                    port: config.smtpPort,
                    user: config.smtpUser,
                    hasPassword: !!config.smtpPass
                },
                message: 'Configuration is valid'
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                email: email,
                error: error.message
            });
        }

    } catch (error) {
        console.error('Test configuration error:', error);
        res.status(500).json({ error: 'Failed to test configuration' });
    }
});

// --- STARTUP LOGIC ---
(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established');

        await sequelize.sync({ alter: true });
        console.log('✅ Models synchronized');

        // Validate all accounts before starting
        await validateAllAccounts();

        app.listen(PORT, () => {
            console.log(`🚀 Server started on http://localhost:${PORT}`);
        });

        // 🧠 Start intelligent warmup scheduler after 10 seconds
        setTimeout(() => {
            scheduleIntelligentWarmup();
            console.log('🧠 Intelligent Warmup Scheduler started');
        }, 10000);

        // 🧠 Start intelligent warmup worker
        const worker = new IntelligentWarmupWorker();
        await worker.consumeWarmupJobs();
        console.log('🧠 Intelligent Warmup Worker started');

        // Optional: expose intelligent status
        app.get('/api/intelligent-status', (req, res) => {
            res.json({
                status: 'ok',
                scheduler: 'intelligent_running',
                worker: 'intelligent_running',
                features: [
                    'balanced_bidirectional_communication',
                    'intelligent_timing_distribution',
                    '25%_reply_rate_cap',
                    'gradual_warmup_progression',
                    'user_defined_scheduling'
                ],
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
            });
        });

    } catch (err) {
        console.error('❌ Startup failed:', err);
        process.exit(1);
    }
})();
