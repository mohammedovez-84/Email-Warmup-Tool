const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const DailyEmailStats = sequelize.define('daily_email_stats', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    sentCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    receivedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    repliedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    deliveredCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    spamCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    reputationScore: {
        type: DataTypes.FLOAT,
        defaultValue: 100.0
    },
    warmupDay: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'daily_email_stats',
    indexes: [
        {
            unique: true,
            fields: ['email', 'date']
        },
        {
            fields: ['date']
        },
        {
            fields: ['reputationScore']
        }
    ],
    timestamps: true
});

module.exports = DailyEmailStats;