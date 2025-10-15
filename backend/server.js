



require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const http = require('http');

require('./config/microsoftStrategy');
require('./workers/warmupWorker');

const { startWarmupScheduler } = require('./services/warmupScheduler');
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
// const { initSocket } = require('./controllers/socket');

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
app.use('/auth/microsoft', microsoftAuthRoutes);
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

        await sequelize.sync({ alter: true });



        // // Create HTTP server and attach Socket.IO
        // const server = http.createServer(app);
        // initSocket(server); // Initialize Socket.IO before any workers

        // Start warmup scheduler
        startWarmupScheduler();

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Server started on http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error('❌ Unable to connect to the DB:', err);
    }
})();
