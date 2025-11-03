// models/ReplyTracking.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ReplyTracking = sequelize.define('reply_tracking', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    originalEmailMetricId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'email_metrics',
            key: 'id'
        }
    },
    replyEmailMetricId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'email_metrics',
            key: 'id'
        }
    },

    // ORIGINAL EMAIL INFO
    originalSender: {
        type: DataTypes.STRING,
        allowNull: false
    },
    originalReceiver: {
        type: DataTypes.STRING,
        allowNull: false
    },
    originalMessageId: {
        type: DataTypes.STRING,
        allowNull: true
    },

    // REPLY INFO
    replySender: {
        type: DataTypes.STRING,
        allowNull: false
    },
    replyReceiver: {
        type: DataTypes.STRING,
        allowNull: false
    },
    replyMessageId: {
        type: DataTypes.STRING,
        allowNull: true
    },

    // TIMING
    originalSentAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    repliedAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    responseTime: {
        type: DataTypes.INTEGER, // in minutes
        allowNull: true
    },

    // REPLY CONTEXT
    threadDepth: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    isAutomatedReply: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    replyQuality: {
        type: DataTypes.ENUM('high', 'medium', 'low', 'generic'),
        allowNull: true
    }

}, {
    tableName: 'reply_tracking',
    timestamps: true,
    indexes: [
        {
            fields: ['originalSender', 'repliedAt']
        },
        {
            fields: ['replySender']
        },
        {
            fields: ['originalEmailMetricId']
        },
        {
            fields: ['responseTime']
        }
    ]
});

module.exports = ReplyTracking;