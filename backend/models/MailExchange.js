// models/EmailExchange.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const EmailExchange = sequelize.define('email_exchanges', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    warmupAccount: {
        type: DataTypes.STRING,
        allowNull: false
    },
    poolAccount: {
        type: DataTypes.STRING,
        allowNull: false
    },
    direction: {
        type: DataTypes.ENUM('WARMUP_TO_POOL', 'POOL_TO_WARMUP'),
        allowNull: false
    },
    messageId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    sentAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    status: {
        type: DataTypes.ENUM('scheduled', 'sent', 'delivered', 'failed'),
        defaultValue: 'scheduled'
    }
}, {
    tableName: 'email_exchanges',
    indexes: [
        {
            fields: ['warmupAccount', 'sentAt']
        },
        {
            fields: ['direction']
        }
    ]
});

module.exports = EmailExchange;