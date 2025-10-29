require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');

require('./config/microsoftStrategy');
const { sequelize } = require('./config/db');

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
const msoauthRoutesAdmin = require("./routes/ms-oauth-admin");

// Replace with Hybrid Scheduler
const {
    startHybridScheduling,
    stopHybridScheduling,
    getSchedulerStatus,
    hybridSchedulerInstance
} = require('./services/hybrid-scheduler');

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

// Scheduler Status Route (Read-only)
app.get('/api/scheduler/status', async (req, res) => {
    try {
        const status = await getSchedulerStatus();
        res.json({
            success: true,
            ...status
        });
    } catch (error) {
        console.error('❌ Scheduler status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get scheduler status'
        });
    }
});

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established');
        console.log('✅ Database connection verified');

        await sequelize.sync();


        // Start the HYBRID scheduler with enhanced logging
        setTimeout(async () => {
            try {
                console.log('\n🎯 =================================');
                console.log('🚀 Starting HYBRID Warmup Scheduler');
                console.log('🎯 =================================\n');

                await startHybridScheduling();

                // Dynamic rescheduling based on mode
                const rescheduleInterval = process.env.SCHEDULER_RESCHEDULE_INTERVAL || (4 * 60 * 60 * 1000); // 4 hours default

                setInterval(async () => {
                    try {
                        console.log('\n🔄 =================================');
                        console.log('🔄 Auto-Rescheduling Warmup Jobs');
                        console.log('🔄 =================================\n');

                        const status = await getSchedulerStatus();
                        console.log(`📊 Current Status: ${status.mode} mode, ${status.accountCount} accounts`);

                        // Stop current scheduling
                        stopHybridScheduling();

                        // Wait a bit for clean shutdown
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        // Restart with fresh account detection
                        await startHybridScheduling();

                        console.log('✅ Auto-rescheduling completed');

                    } catch (error) {
                        console.error('❌ Auto-rescheduling error:', error);
                    }
                }, rescheduleInterval);

                console.log('✅ Hybrid warmup scheduler started successfully');
                console.log(`⏰ Auto-reschedule interval: ${rescheduleInterval / (60 * 60 * 1000)} hours`);

            } catch (error) {
                console.error('❌ Failed to start hybrid scheduler:', error);
            }
        }, 5000);

        app.listen(PORT, () => {
            console.log(`🚀 Server started on http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error('❌ Startup failed:', err);
        process.exit(1);
    }
})();