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
    sentAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    deliveredInbox: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    replied: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    messageId: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'email_metrics',
    timestamps: true
});

module.exports = EmailMetric;
