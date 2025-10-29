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
        type: DataTypes.ENUM('GMAIL', 'OUTLOOK', 'OUTLOOK_PERSONAL', 'MICROSOFT_ORGANIZATIONAL', 'CUSTOM'),
        allowNull: false,
        defaultValue: 'OUTLOOK'
    },

    // DAILY LIMITS - Same as warmup accounts
    startEmailsPerDay: {
        type: DataTypes.INTEGER,
        defaultValue: 10, // Higher default for pool accounts
        allowNull: false,
    },
    maxEmailsPerDay: {
        type: DataTypes.INTEGER,
        defaultValue: 50, // Higher max for pool accounts
        allowNull: false,
    },
    currentDaySent: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    lastResetDate: {
        type: DataTypes.DATE,
        allowNull: true,
    },

    // For Gmail/Outlook personal accounts
    appPassword: {
        type: DataTypes.STRING,
        allowNull: true
    },

    // OAuth tokens (for both personal Outlook and organizational)
    access_token: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    token_expires_at: {
        type: DataTypes.BIGINT,
        allowNull: true
    },

    // SMTP settings for custom accounts
    smtpHost: {
        type: DataTypes.STRING,
        allowNull: true
    },
    smtpPort: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    smtpSecure: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    smtpUser: {
        type: DataTypes.STRING,
        allowNull: true
    },
    smtpPassword: {
        type: DataTypes.STRING,
        allowNull: true
    },

    // IMAP settings
    imapHost: {
        type: DataTypes.STRING,
        allowNull: true
    },
    imapPort: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    imapSecure: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    imapUser: {
        type: DataTypes.STRING,
        allowNull: true
    },
    imapPassword: {
        type: DataTypes.STRING,
        allowNull: true
    },

    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    roundRobinIndex: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
}, {
    tableName: 'pool_emails',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['email']
        },
        {
            fields: ['isActive']
        },
        {
            fields: ['providerType']
        },
        {
            fields: ['lastResetDate'] // For daily reset queries
        }
    ]
});

module.exports = EmailPool;