// models/EmailMetric.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const EmailMetric = sequelize.define('email_metrics', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    senderEmail: {
        type: DataTypes.STRING,
        allowNull: false
    },
    senderType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    receiverEmail: {
        type: DataTypes.STRING,
        allowNull: false
    },
    receiverType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    subject: {
        type: DataTypes.STRING,
        allowNull: true
    },
    messageId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    sentAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },

    // DELIVERY STATUS
    status: {
        type: DataTypes.ENUM('sent', 'delivered', 'bounced', 'deferred', 'rejected'),
        defaultValue: 'sent'
    },
    deliveredAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    deliveredInbox: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    deliveryFolder: {
        type: DataTypes.STRING,
        allowNull: true
    },

    // WARMUP SPECIFIC
    replyRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0.25
    },
    warmupDay: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    emailType: {
        type: DataTypes.ENUM('warmup_send', 'warmup_reply', 'pool_send'),
        allowNull: false
    },
    industry: {
        type: DataTypes.STRING,
        defaultValue: 'general'
    },
    isCoordinated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    direction: {
        type: DataTypes.ENUM('WARMUP_TO_POOL', 'POOL_TO_WARMUP'),
        allowNull: false
    },

    // ERROR TRACKING
    error: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }

}, {
    tableName: 'email_metrics',
    timestamps: true,
    indexes: [
        {
            fields: ['senderEmail', 'sentAt']
        },
        {
            fields: ['receiverEmail']
        },
        {
            fields: ['messageId']
        },
        {
            fields: ['status']
        }
    ]
});

module.exports = EmailMetric;