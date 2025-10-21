require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');


require('./config/microsoftStrategy');
const { sequelize } = require('./config/db');

// // 🟢 Import scheduler and consumer AFTER DB
// const { startWarmupScheduler } = require('./services/warmupScheduler');
// const { consumeWarmupJobs } = require("./workers/warmupWorker");

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
const { buildSenderConfig, getSenderType } = require('./utils/senderConfig');
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
                // Use the enhanced type detection
                const accountType = getSenderType(account);
                console.log(`🔧 Validating ${account.email} as ${accountType} account`);

                const config = buildSenderConfig(account, accountType);

                console.log(`✅ ${account.email}: ${accountType} configuration valid (${config.smtpHost}:${config.smtpPort})`);
                validCount++;

            } catch (error) {
                console.error(`❌ ${account.email}: ${error.message}`);
                invalidCount++;

                // Auto-pause accounts with configuration issues
                await account.update({ warmupStatus: 'paused' });
                console.log(`⏸️  Auto-paused ${account.email} due to configuration issues`);
            }
        }

        console.log(`📊 Validation Results: ${validCount} valid, ${invalidCount} invalid accounts`);

    } catch (error) {
        console.error('Account validation error:', error);
    }
}


(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established');

        // ⚠️ REMOVE or MODIFY this line - it's causing the data overwrite
        // await sequelize.sync({ alter: true });

        // Instead, just verify connection without modifying schema
        console.log('✅ Database connection verified');

        // Validate all accounts before starting
        await validateAllAccounts();


        //warmup scheduler

        // 🧠 Start intelligent warmup scheduler after 10 seconds
        setTimeout(async () => {
            try {
                await scheduleIntelligentWarmup();
                // console.log('🧠 Intelligent Warmup Scheduler started');

                // Schedule periodic rescheduling every 6 hours
                setInterval(async () => {
                    console.log('🔄 Rescheduling warmup jobs...');
                    await scheduleIntelligentWarmup();
                }, 6 * 60 * 60 * 1000);

            } catch (error) {
                console.error('❌ Failed to start scheduler:', error);
            }
        }, 10000);

        // 🧠 Start intelligent warmup worker
        const worker = new IntelligentWarmupWorker();
        await worker.consumeWarmupJobs();
        console.log('🧠  Warmup Worker started');

        app.listen(PORT, () => {
            console.log(`🚀 Server started on http://localhost:${PORT}`);
        });

        // ... rest of your code
    } catch (err) {
        console.error('❌ Startup failed:', err);
        process.exit(1);
    }
})();
