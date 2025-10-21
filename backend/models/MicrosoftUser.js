
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const MicrosoftUser = sequelize.define('microsoft_users', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    microsoft_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    refresh_token: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    access_token: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    expires_at: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    warmupStatus: {
        type: DataTypes.STRING,
        defaultValue: 'paused'
    },
    startEmailsPerDay: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
        allowNull: false,
    },
    increaseEmailsPerDay: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
        allowNull: false,
    },
    maxEmailsPerDay: {
        type: DataTypes.INTEGER,
        defaultValue: 25,
        allowNull: false,
    },
    replyRate: {
        type: DataTypes.FLOAT,
        defaultValue: 1.0,
        allowNull: false,
    },
    warmupDayCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    roundRobinIndexMicrosoft: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    warmupStartTime: {
        type: DataTypes.TIME,
        defaultValue: '09:00:00'
    },
    warmupEndTime: {
        type: DataTypes.TIME,
        defaultValue: '18:00:00'
    },
    timezone: {
        type: DataTypes.STRING,
        defaultValue: 'UTC'
    },
    preferredSendInterval: {
        type: DataTypes.INTEGER, // minutes between emails
        defaultValue: 120
    }
    , is_connected: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true, // default connected when added
    }

}, {
    tableName: 'microsoft_users',
    timestamps: true,
    underscored: true
});

module.exports = MicrosoftUser;