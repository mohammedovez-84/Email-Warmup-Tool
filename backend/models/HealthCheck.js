// models/healthCheck.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const HealthCheck = sequelize.define('HealthCheck', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        domain: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        mxRecords: {
            type: DataTypes.JSON, // array of objects [{exchange, priority}, ...]
            allowNull: true,
        },
        spf: {
            type: DataTypes.TEXT, // can be long text or record string
            allowNull: true,
        },
        dmarc: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        dkim: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        blacklistResults: {
            type: DataTypes.JSON, // array of objects [{ip, checks}, ...]
            allowNull: true,
        },
        detectedImpersonations: {
            type: DataTypes.JSON, // array of strings
            allowNull: true,
        },
        notificationMessage: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        checkedAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: 'health_checks',
        timestamps: true, // adds createdAt and updatedAt
    });

    return HealthCheck;
};

