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

const warmupScheduler = require('./services/Scheduler');




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



(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established');
        console.log('✅ Database connection verified');

        await sequelize.sync({ alter: true });



        // Start the scheduler
        setTimeout(async () => {
            try {
                console.log('🚀 Starting Warmup Scheduler...');
                await warmupScheduler.scheduleWarmup();

                // Reschedule every 6 hours
                setInterval(async () => {
                    console.log('🔄 Rescheduling warmup jobs...');
                    await warmupScheduler.scheduleWarmup();
                }, 6 * 60 * 60 * 1000);

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