const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// ⛔ Global rate limiter for authenticated routes (customize as needed)
exports.authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP/user to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false,
});

// 🔐 Middleware to authenticate users via Bearer token
exports.authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    // Check for Bearer token format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token not provided' });

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.warn('⚠️ JWT_SECRET is not defined in environment variables');
        }

        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Token has expired' });
        }
        return res.status(403).json({ error: 'Invalid token' });
    }
};

