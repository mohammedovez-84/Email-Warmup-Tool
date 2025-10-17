require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const http = require('http');

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

// --- STARTUP LOGIC ---
(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established');

        await sequelize.sync({ alter: true });
        console.log('✅ Models synchronized');

        app.listen(PORT, () => {
            console.log(`🚀 Server started on http://localhost:${PORT}`);
        });


        startWarmupScheduler();
        console.log('🟢 Warmup Scheduler started');

        // 📨 Start warmup consumer (RabbitMQ)
        const safeStartConsumer = async () => {
            try {
                await consumeWarmupJobs();
                console.log('🟢 Warmup Consumer connected and running');
            } catch (err) {
                console.error('❌ Warmup Consumer crashed:', err.message);
                setTimeout(safeStartConsumer, 10000); // Auto-restart after 10s
            }
        };
        safeStartConsumer();

        // Optional: expose health status
        app.get('/api/status', (req, res) => {
            res.json({
                status: 'ok',
                scheduler: 'running',
                consumer: 'running',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
            });
        });

    } catch (err) {
        console.error('❌ Startup failed:', err);
        process.exit(1);
    }
})();
