

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SmtpAccount = sequelize.define('smtpimap_accounts', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {                // ✅ add this
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sender_name: DataTypes.STRING,
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  smtp_host: DataTypes.STRING,
  smtp_port: DataTypes.INTEGER,
  smtp_user: DataTypes.STRING,
  smtp_pass: DataTypes.STRING,
  smtp_encryption: DataTypes.ENUM('SSL', 'TLS', 'None'),

  imap_host: DataTypes.STRING,
  imap_port: DataTypes.INTEGER,
  imap_user: DataTypes.STRING,
  imap_pass: DataTypes.STRING,
  imap_encryption: DataTypes.ENUM('SSL', 'TLS', 'None'),

  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
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
  roundRobinIndexCustom: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  description: DataTypes.TEXT,
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
}, {
  tableName: 'smtpimap_accounts',
  timestamps: false
});

module.exports = SmtpAccount;

