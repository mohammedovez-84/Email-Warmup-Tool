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
    deliveredInbox: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    deliveryFolder: {
        type: DataTypes.STRING,
        allowNull: true
    },
    movedToInbox: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    replied: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    repliedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    replyMessageId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    replyRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0.25
    },
    warmupDay: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed'),
        defaultValue: 'pending'
    },
    error: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // Add to EmailMetric model
    replyError: {
        type: DataTypes.STRING,
        allowNull: true
    },
    movedToInbox: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    deliveryFolder: {
        type: DataTypes.STRING,
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