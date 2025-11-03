// models/BounceTracking.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const BounceTracking = sequelize.define('bounce_tracking', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    emailMetricId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'email_metrics',
            key: 'id'
        }
    },
    senderEmail: {
        type: DataTypes.STRING,
        allowNull: false
    },
    receiverEmail: {
        type: DataTypes.STRING,
        allowNull: false
    },
    messageId: {
        type: DataTypes.STRING,
        allowNull: true
    },

    // BOUNCE TYPES
    bounceType: {
        type: DataTypes.ENUM('hard_bounce', 'soft_bounce', 'blocked', 'spam', 'content_rejected'),
        allowNull: false
    },
    bounceCategory: {
        type: DataTypes.ENUM('permanent', 'transient', 'complaint'),
        allowNull: false
    },

    // BOUNCE DETAILS
    bounceReason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    bounceCode: {
        type: DataTypes.STRING,
        allowNull: true
    },
    smtpResponse: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    // ISP/PLATFORM INFO
    receivingServer: {
        type: DataTypes.STRING,
        allowNull: true
    },
    isp: {
        type: DataTypes.STRING,
        allowNull: true
    },

    bouncedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },

    // RETRY INFO
    canRetry: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    retryAfter: {
        type: DataTypes.DATE,
        allowNull: true
    }

}, {
    tableName: 'bounce_tracking',
    timestamps: true,
    indexes: [
        {
            fields: ['senderEmail', 'bouncedAt']
        },
        {
            fields: ['bounceType']
        },
        {
            fields: ['receiverEmail']
        },
        {
            fields: ['emailMetricId']
        }
    ]
});

module.exports = BounceTracking;