// models/healthCheck.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const HealthCheck = sequelize.define('health_checks', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    domain: {
        type: DataTypes.STRING,
        allowNull: false
    },
    mxRecords: {
        type: DataTypes.JSON, // array of objects [{exchange, priority}, ...]
        allowNull: true
    },
    spf: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    dmarc: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    dkim: {
        type: DataTypes.JSON,
        allowNull: true
    },
    blacklistResults: {
        type: DataTypes.JSON,
        allowNull: true
    },
    detectedImpersonations: {
        type: DataTypes.JSON,
        allowNull: true
    },
    notificationMessage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    checkedAt: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'health_checks',
    timestamps: true // adds createdAt and updatedAt
});

module.exports = HealthCheck;
