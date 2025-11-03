// models/EngagementTracking.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const EngagementTracking = sequelize.define('engagement_tracking', {
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

    // OPEN TRACKING
    opened: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    firstOpenedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    lastOpenedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    openCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    uniqueOpens: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },

    // CLICK TRACKING
    clicked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    firstClickedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    lastClickedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    clickCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    uniqueClicks: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },

    // DEVICE & PLATFORM INFO
    userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: true
    },
    platform: {
        type: DataTypes.ENUM('desktop', 'mobile', 'tablet', 'webmail'),
        allowNull: true
    },
    clientType: {
        type: DataTypes.STRING,
        allowNull: true
    }

}, {
    tableName: 'engagement_tracking',
    timestamps: true,
    indexes: [
        {
            fields: ['senderEmail', 'firstOpenedAt']
        },
        {
            fields: ['receiverEmail']
        },
        {
            fields: ['opened']
        },
        {
            fields: ['clicked']
        },
        {
            fields: ['emailMetricId']
        }
    ]
});

module.exports = EngagementTracking;