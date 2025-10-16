// const { DataTypes } = require('sequelize');
// const { sequelize } = require('../config/db');

// const GoogleUser = sequelize.define('google_users', {
//     name: {
//         type: DataTypes.STRING,
//         allowNull: false,
//     },
//     email: {
//         type: DataTypes.STRING,
//         unique: true,
//         allowNull: false,
//     },
//     app_password: {
//         type: DataTypes.STRING,
//         allowNull: false,
//     },
//     user_id: {
//         type: DataTypes.INTEGER,
//         allowNull: false,
//         references: {
//             model: 'users',
//             key: 'id',
//         },
//         onDelete: 'CASCADE',
//     },
//     warmupStatus: {
//         type: DataTypes.STRING,
//         defaultValue: 'active',
//     },
//      startEmailsPerDay: {
//     type: DataTypes.INTEGER,
//     defaultValue: 3,
//   },
//   increaseEmailsPerDay: {
//     type: DataTypes.INTEGER,
//     defaultValue: 3,
//   },
//   maxEmailsPerDay: {
//     type: DataTypes.INTEGER,
//     defaultValue: 25,
//   },
//   replyRate: {
//     type: DataTypes.FLOAT,
//     defaultValue: 1.0,
//   },
//   warmupDayCount: {
//     type: DataTypes.INTEGER,
//     defaultValue: 0,
//   },

// }, {
//     timestamps: false,
//     tableName: 'google_users'
// });

// module.exports = GoogleUser;



// // module.exports = (sequelize, DataTypes) => {
// //     return sequelize.define('google_users', {
// //         name: {
// //             type: DataTypes.STRING,
// //             allowNull: false,
// //         },
// //         email: {
// //             type: DataTypes.STRING,
// //             unique: true,
// //             allowNull: false,
// //         },
// //         app_password: {
// //             type: DataTypes.STRING,
// //             allowNull: false,
// //         },
// //         user_id: {
// //             type: DataTypes.INTEGER,
// //             allowNull: false,
// //             references: {
// //                 model: 'users',
// //                 key: 'id',
// //             },
// //             onDelete: 'CASCADE',
// //         }
// //     }, {
// //         timestamps: false,
// //         tableName: 'google_users'
// //     });
// // };




const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const GoogleUser = sequelize.define('google_users', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  app_password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  warmupStatus: {
    type: DataTypes.STRING,
    defaultValue: 'paused',
  },
  startEmailsPerDay: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
  },
  increaseEmailsPerDay: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
  },
  maxEmailsPerDay: {
    type: DataTypes.INTEGER,
    defaultValue: 25,
  },
  replyRate: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0,
  },
  warmupDayCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  roundRobinIndexGoogle: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  provider: {
    type: DataTypes.STRING,
    defaultValue: 'google',
  },

}, {
  timestamps: false,
  tableName: 'google_users'
});

module.exports = GoogleUser;
