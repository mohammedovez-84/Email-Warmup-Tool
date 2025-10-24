const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const EmailPool = sequelize.define('pool_emails', {
    email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: { isEmail: true }
    },
    providerType: {
        type: DataTypes.ENUM('GMAIL', 'MICROSOFT', 'CUSTOM'),
        allowNull: false,
        defaultValue: 'GMAIL'
    },
    appPassword: { type: DataTypes.STRING, allowNull: true },
    refreshToken: { type: DataTypes.TEXT, allowNull: true },
    accessToken: { type: DataTypes.TEXT, allowNull: true },
    tokenExpiresAt: { type: DataTypes.BIGINT, allowNull: true },
    smtpHost: { type: DataTypes.STRING, allowNull: true },
    smtpPort: { type: DataTypes.INTEGER, allowNull: true },
    smtpSecure: { type: DataTypes.BOOLEAN, defaultValue: false },
    smtpPassword: { type: DataTypes.STRING, allowNull: true },
    imapHost: { type: DataTypes.STRING, allowNull: true },
    imapPort: { type: DataTypes.INTEGER, allowNull: true },
    imapSecure: { type: DataTypes.BOOLEAN, defaultValue: true },
    imapPassword: { type: DataTypes.STRING, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    // dailyLimit: { type: DataTypes.INTEGER, defaultValue: 50 },
    roundRobinIndex: { type: DataTypes.INTEGER, defaultValue: 0 },

}, {
    tableName: 'pool_emails',
    timestamps: false
});

module.exports = EmailPool;