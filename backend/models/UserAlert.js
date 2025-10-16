// models/userAlert.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserAlert = sequelize.define('UserAlert', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        type: {
            type: DataTypes.STRING, // e.g., 'health_check', 'warmup_status'
            allowNull: false,
        },
        message: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        details: {
            type: DataTypes.JSON, // structured info {summary, health, etc.}
            allowNull: true,
        },
        isRead: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    }, {
        tableName: 'user_alerts',
        timestamps: true, // adds createdAt and updatedAt
    });

    return UserAlert;
};
