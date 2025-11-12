const cron = require('node-cron');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');

require('./config/microsoftStrategy');
const { sequelize } = require('./config/db');

// Import routes
const microsoftAuthRoutes = require('./routes/auth/microsoftAuth');
const authRoutes = require('./routes/auth/auth');
const googleRoutes = require('./routes/auth/googleRoutes');
const microsoftRoutes = require('./routes/auth/microsoftRoutes');
const smtpImapRoutes = require('./routes/auth/SmtpImap');
const dashboardRoutes = require('./routes/dashboard/dashboardRoutes');
const warmupRoutes = require('./routes/warmup/warmupRoutes');
const userRoutes = require('./routes/users/users');
const metricsRoutes = require('./routes/metrics/metricsRoutes');
const healthRoutes = require('./routes/health/healthRoutes');
const analyticsRoutes = require("./routes/analytics/analytics");
const googleAuthRoutes = require("./routes/auth/google-auth");
const dnsRoutes = require("./routes/dns/auth-checker");

// Import services
require('./models/associations')();
const warmupScheduler = require('./services/schedule/Scheduler');
const dailyResetService = require('./services/volume/dailyReset');

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
app.use("/api/analytics", analyticsRoutes);
app.use("/api/dns", dnsRoutes);
app.use("/api/auth", googleAuthRoutes);
app.use('/api', googleRoutes);
app.use('/auth', microsoftRoutes);
app.use('/api', smtpImapRoutes);
app.use('/api/accounts', dashboardRoutes);
app.use('/api/warmup', warmupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/health', healthRoutes);

// Application startup
(async () => {
    try {
        // Database connection
        await sequelize.authenticate();
        console.log('✅ DATABASE CONNECTION ESTABLISHED');

        await sequelize.sync({ alter: false });
        console.log('✅ DATABASE SYNCED');

        // Daily reset cron job
        cron.schedule('0 0 * * *', async () => {
            console.log('⏰ DAILY CRON: Running warmup reset...');
            await dailyResetService.performDailyReset();
        });

        // Start warmup scheduler with delay
        setTimeout(async () => {
            try {
                console.log('🚀 STARTING WARMUP SCHEDULER...');
                await warmupScheduler.scheduleWarmup();

                // Schedule periodic warmup (every 15 minutes)
                setInterval(async () => {
                    await warmupScheduler.scheduleWarmup();
                }, 15 * 60 * 1000);

                console.log('✅ WARMUP SYSTEM READY');
            } catch (error) {
                console.error('❌ SCHEDULER STARTUP FAILED:', error);
            }
        }, 10000); // 10 second delay

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 SERVER STARTED: http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error('❌ STARTUP FAILED:', err);
        process.exit(1);
    }
})();