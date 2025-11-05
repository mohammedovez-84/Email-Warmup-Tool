const cron = require('node-cron');
const moment = require('moment');
moment.suppressDeprecationWarnings = true;
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');

require('./config/microsoftStrategy');
const { sequelize } = require('./config/db');

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
// In your server.js or app.js
require('./models/associations')();
const warmupScheduler = require('./services/schedule/Scheduler');
const dailyResetService = require('./services/volume/dailyReset');
const analyticsRoutes = require("./routes/analytics/analytics")
// const analyticsRoutes = require("./routes/analytics/analytics")


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
// app.use("/api/ms-oauth_admin",)
app.use("/api/analytics", analyticsRoutes)
app.use('/api', googleRoutes);
app.use('/auth', microsoftRoutes);
app.use('/api', smtpImapRoutes);
app.use('/api/accounts', dashboardRoutes);
app.use('/api/warmup', warmupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/health', healthRoutes);
// app.use("/analytics", analyticsRoutes)



// In your server.js file, replace the scheduler startup section:

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established');
        console.log('✅ Database connection verified');

        await sequelize.sync();

        // 🚨 DAILY CRON - This is the ONLY place that should increment days
        cron.schedule('0 0 * * *', async () => {
            console.log('⏰ DAILY CRON: Running warmup day increment...');
            await dailyResetService.performDailyReset();
        });

        setTimeout(async () => {
            try {
                console.log('🚀 Starting Warmup Scheduler...');


                await warmupScheduler.scheduleWarmup()


                console.log('✅ Warmup scheduler started successfully');
            } catch (error) {
                console.error('❌ Failed to start scheduler:', error);
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