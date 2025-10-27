const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const EmailPool = sequelize.define('pool_emails', {
    email: {
        type: DataTypes.STRING,
        unique: true, // This creates an index
        allowNull: false,
        validate: { isEmail: true }
    },
    providerType: {
        type: DataTypes.ENUM('GMAIL', 'OUTLOOK', 'OUTLOOK_PERSONAL', 'MICROSOFT_ORGANIZATIONAL', 'CUSTOM'),
        allowNull: false,
        defaultValue: 'OUTLOOK'
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
    // **CRITICAL: Disable automatic indexing**
    indexes: [
        {
            unique: true,
            fields: ['email'] // Only keep the essential unique index
        },
        {
            fields: ['isActive'] // Add only necessary indexes
        },
        {
            fields: ['providerType']
        }
    ]
});

module.exports = EmailPool;