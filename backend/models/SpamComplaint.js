
// models/SpamComplaint.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SpamComplaint = sequelize.define('spam_complaints', {
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

    // COMPLAINT DETAILS
    complaintType: {
        type: DataTypes.ENUM('user_complaint', 'isp_feedback', 'automated_filter'),
        allowNull: false
    },
    complaintSource: {
        type: DataTypes.STRING,
        allowNull: true
    },
    complaintFeedback: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    // ISP & PLATFORM
    reportingIsp: {
        type: DataTypes.STRING,
        allowNull: true
    },
    feedbackLoopId: {
        type: DataTypes.STRING,
        allowNull: true
    },

    reportedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },

    // RESOLUTION INFO
    resolved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    resolutionNotes: {
        type: DataTypes.TEXT,
        allowNull: true
    }

}, {
    tableName: 'spam_complaints',
    timestamps: true,
    indexes: [
        {
            fields: ['senderEmail', 'reportedAt']
        },
        {
            fields: ['complaintType']
        },
        {
            fields: ['reportingIsp']
        },
        {
            fields: ['emailMetricId']
        }
    ]
});

module.exports = SpamComplaint;