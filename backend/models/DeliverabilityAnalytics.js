// models/DeliverabilityAnalytics.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const DeliverabilityAnalytics = sequelize.define('deliverability_analytics', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    senderEmail: {
        type: DataTypes.STRING,
        allowNull: false
    },
    analyticsDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    timePeriod: {
        type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
        defaultValue: 'daily'
    },

    // CORE METRICS
    emailsSent: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    emailsDelivered: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    emailsBounced: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    hardBounces: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    softBounces: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },

    // ENGAGEMENT METRICS
    emailsOpened: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    uniqueOpens: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    emailsClicked: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    uniqueClicks: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    emailsReplied: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },

    // SPAM & COMPLAINTS
    spamComplaints: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    spamBlocked: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },

    // CALCULATED RATES (%)
    deliverabilityRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    inboxPlacementRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    openRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    clickRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    replyRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    bounceRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    spamComplaintRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },

    // TRENDS
    trendDirection: {
        type: DataTypes.ENUM('improving', 'declining', 'stable'),
        defaultValue: 'stable'
    },
    scoreChange: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    }

}, {
    tableName: 'deliverability_analytics',
    timestamps: true,
    indexes: [
        {
            fields: ['senderEmail', 'analyticsDate']
        },
        {
            fields: ['analyticsDate']
        },
        {
            fields: ['deliverabilityRate']
        }
    ]
});

module.exports = DeliverabilityAnalytics;