// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const dotenv = require('dotenv');
// const session = require('express-session');
// const passport = require('passport');

// const smtpImapRoutes = require('./routes/SmtpImap');



// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 5000;

// // Middleware
// app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
// app.use(bodyParser.json());

// // ✅ Routes
// const authRoutes = require('./routes/auth');
// app.use('/api/auth', authRoutes);

// // Test route
// app.get('/', (req, res) => {
//     res.send('Server is working!');
// });
// //Add google mails
// const googleRoutes = require('./routes/googleRoutes');
// app.use(session({
//     secret: 'your-secret',
//     resave: false,
//     saveUninitialized: true,
// }));

// app.use(passport.initialize());
// app.use(passport.session());

// app.use('/api', googleRoutes);
// app.use('/api', smtpImapRoutes);
// const dashboardRoutes = require('./routes/dashboardRoutes');
// app.use('/api/accounts', dashboardRoutes);

// app.listen(PORT, () => {
//     console.log(`🚀 Server started on http://localhost:${PORT}`);
// });







// require('dotenv').config();
// const express = require('express');
// const bodyParser = require('body-parser');
// const { sequelize } = require('./models');
// const warmupRoutes = require('./routes/warmupRoutes');

// const statsRoutes = require('./routes/stats');
// const app = express();
// app.use(bodyParser.json());
// app.use('/api/warmup', warmupRoutes);


// app.use('/api', statsRoutes);


// const PORT = process.env.PORT || 5000;


// (async () => {
//   try {
//     await sequelize.authenticate();
//     console.log('MySQL DB connected successfully.');
//   } catch (err) {
//     console.error('Unable to connect to the DB:', err);
//   }
// })();
// sequelize.sync().then(() => {
//   app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
//   });
// });






// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const session = require('express-session');
// const passport = require('passport');
// require('./config/microsoftStrategy');
// const { sequelize } = require('./config/db');
// const microsoftAuthRoutes = require('./routes/microsoftAuth');
// // Routes
// const authRoutes = require('./routes/auth');
// const googleRoutes = require('./routes/googleRoutes');
// const microsoftRoutes = require('./routes/microsoftRoutes');
// const smtpImapRoutes = require('./routes/SmtpImap');
// const dashboardRoutes = require('./routes/dashboardRoutes');
// const warmupRoutes = require('./routes/warmupRoutes');
// const statsRoutes = require('./routes/stats');
// const userRoutes = require('./routes/users');

// const app = express();
// const PORT = process.env.PORT || 5000;

// // ✅ Middleware
// app.use(cors({ origin: ['http://localhost:5173', "http://192.168.1.44:5173"], credentials: true }));
// app.use(bodyParser.json());
// app.use(session({
//     secret: 'your-secret',
//     resave: false,
//     saveUninitialized: true,
// }));
// app.use(passport.initialize());
// app.use(passport.session());
// app.use('/auth/microsoft', microsoftAuthRoutes);
// // ✅ All Routes
// app.use('/api/auth', authRoutes);
// app.use('/api', googleRoutes);
// app.use('/auth', microsoftRoutes);
// app.use('/api', smtpImapRoutes);
// app.use('/api/accounts', dashboardRoutes);
// app.use('/api/warmup', warmupRoutes);
// app.use('/api', statsRoutes);
// app.use('/api/users', userRoutes);

// // ✅ Test Route
// app.get('/', (req, res) => {
//     res.send('Server is working!');
// });

// // ✅ Start Server After DB Connection
// (async () => {
//     try {
//         await sequelize.authenticate();
//         console.log('✅ MySQL DB connected successfully.');

//         await sequelize.sync();
//         app.listen(PORT, () => {
//             console.log(`🚀 Server started on http://localhost:${PORT}`);
//         });
//     } catch (err) {
//         console.error('❌ Unable to connect to the DB:', err);
//     }
// })();




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
const { initSocket } = require('./controllers/socket');

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


app.get('/', (req, res) => res.send('Server is working!'));

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ MySQL DB connected successfully.');
        await sequelize.sync({ alter: true });


        // Create HTTP server and attach Socket.IO
        const server = http.createServer(app);
        initSocket(server); // Initialize Socket.IO before any workers

        // Start warmup scheduler
        startWarmupScheduler();

        // Start server
        server.listen(PORT, () => {
            console.log(`🚀 Server started on http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error('❌ Unable to connect to the DB:', err);
    }
})();
