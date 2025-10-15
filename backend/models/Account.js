
// // models/Account.js
// const { Sequelize, DataTypes } = require('sequelize');
// const { sequelize } = require('../config/db');

// const Account = sequelize.define('accounts', {
//     email: {
//         type: DataTypes.STRING,
//         unique: true
//     },
//     type: {
//         type: DataTypes.STRING // 'google' or 'custom'
//     },
//     smtpHost: DataTypes.STRING,
//     smtpPort: DataTypes.INTEGER,
//     smtpUser: DataTypes.STRING,
//     smtpPass: DataTypes.STRING,
//     imapHost: DataTypes.STRING,
//     imapPort: DataTypes.INTEGER,
//     imapUser: DataTypes.STRING,
//     imapPass: DataTypes.STRING
// }, {
//     tableName: 'accounts',
//     timestamps: false
// });

// module.exports = Account;




const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Account = sequelize.define('accounts', {
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false }, // google/custom/microsoft
  smtpHost: { type: DataTypes.STRING, allowNull: false },
  smtpPort: { type: DataTypes.INTEGER, allowNull: false },
  smtpUser: { type: DataTypes.STRING, allowNull: false },
  smtpPass: { type: DataTypes.STRING, allowNull: true }, // null for OAuth users
  imapHost: { type: DataTypes.STRING, allowNull: false },
  imapPort: { type: DataTypes.INTEGER, allowNull: false },
  imapUser: { type: DataTypes.STRING, allowNull: false },
  imapPass: { type: DataTypes.STRING, allowNull: true }, // null for OAuth users

  // OAuth tokens
  refreshToken: { type: DataTypes.TEXT, allowNull: true },
  accessToken: { type: DataTypes.TEXT, allowNull: true },
  expiresAt: { type: DataTypes.BIGINT, allowNull: true },

  // NEW column for round-robin
  roundRobinIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }

}, {
  tableName: 'accounts',
  timestamps: false
});

module.exports = Account;


