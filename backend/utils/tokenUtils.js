const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generate a JWT token for the given payload.
 * @param {Object} payload - Data to encode in the token
 * @param {String} [expiresIn='1d'] - Expiry time (optional override)
 * @returns {String} JWT token
 */
exports.generateToken = (payload, expiresIn = '1d') => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set in environment');
    return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verify a JWT token and return the decoded payload.
 * @param {String} token - The token to verify
 * @returns {Object} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
exports.verifyToken = (token) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set in environment');
    return jwt.verify(token, secret);
};

/**
 * Generate a 6-digit numeric OTP as a string
 * @returns {String} 6-digit OTP
 */
exports.generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Generate a UUID (v4)
 * @returns {String} UUID
 */
exports.generateUUID = () => crypto.randomUUID();
