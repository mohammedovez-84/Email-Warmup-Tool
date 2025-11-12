
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SpamAnalysis = sequelize.define('SpamAnalysis', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    messageId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    senderEmail: {
        type: DataTypes.STRING,
        allowNull: false
    },
    receiverEmail: {
        type: DataTypes.STRING,
        allowNull: true
    },
    riskScore: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    riskLevel: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'low'
    },
    warnings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
    },
    recommendations: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
    },
    contentAnalysis: {
        type: DataTypes.JSON,
        allowNull: true
    },
    senderReputation: {
        type: DataTypes.JSON,
        allowNull: true
    },
    technicalFactors: {
        type: DataTypes.JSON,
        allowNull: true
    },
    engagementPatterns: {
        type: DataTypes.JSON,
        allowNull: true
    },
    deliveryFolder: {
        type: DataTypes.STRING,
        allowNull: true
    },
    deliveredInbox: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    analyzedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'spam_analyses',
    indexes: [
        {
            fields: ['messageId']
        },
        {
            fields: ['senderEmail']
        },
        {
            fields: ['riskLevel']
        },
        {
            fields: ['analyzedAt']
        }
    ]
});

module.exports = SpamAnalysis;