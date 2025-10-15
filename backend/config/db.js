// const { Sequelize } = require('sequelize');
// require('dotenv').config();

// const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
//     host: process.env.DB_HOST,
//     dialect: 'mysql',
//     logging: console.log,
// });

// sequelize
//     .authenticate()
//     .then(() => console.log('✅ DB Connected Successfully'))
//     .catch((err) => console.error('❌ DB Connection Error:', err));

// module.exports = sequelize;




// const { Sequelize, DataTypes } = require('sequelize');
// require('dotenv').config();

// const sequelize = new Sequelize(
//   process.env.DB_NAME,
//   process.env.DB_USER,
//   process.env.DB_PASS,
//   {
//     host: process.env.DB_HOST,
//     port: process.env.DB_PORT || 3306,
//     dialect: 'mysql',
//     logging: false,
//     define: {
//       timestamps: true,
//       freezeTableName: true
//     }
//   }
// );

// //Import and initialize your models here
// const SenderModel = require('../models/sender');
// const AccountModel = require('../models/Account');

// const Sender = SenderModel(sequelize, DataTypes);
// const Account = AccountModel(sequelize, DataTypes);

// // Optional: define associations here if needed

// //Export everything
// module.exports = {
//   sequelize,
//   Sender,
//   Account
// };








// const { Sequelize, DataTypes } = require('sequelize');
// require('dotenv').config();

// const sequelize = new Sequelize(
//     process.env.DB_NAME,
//     process.env.DB_USER,
//     process.env.DB_PASS,
//     {
//         host: process.env.DB_HOST,
//         port: process.env.DB_PORT || 3306,
//         dialect: 'mysql',
//         logging: false,
//         define: {
//             timestamps: true,
//             freezeTableName: true
//         }
//     }
// );

// // Import and initialize only active models
// const AccountModel = require('../models/Account');
// const GoogleUserModel = require('../models/GoogleUser');
// const SmtpAccountModel = require('../models/smtpAccounts');
// const UserModel = require('../models/userModel');
// const User = UserModel(sequelize, DataTypes);

// const Account = AccountModel(sequelize, DataTypes);
// const GoogleUser = GoogleUserModel(sequelize, DataTypes);
// const SmtpAccount = SmtpAccountModel(sequelize, DataTypes);

// // Export active models
// module.exports = {
//     sequelize,
//     Account,
//     GoogleUser,
//     SmtpAccount,
//     User
// };






// config/db.js
// const { Sequelize, DataTypes } = require('sequelize');
// require('dotenv').config();

// const sequelize = new Sequelize(
//     process.env.DB_NAME,
//     process.env.DB_USER,
//     process.env.DB_PASS,
//     {
//         host: process.env.DB_HOST,
//         port: process.env.DB_PORT || 3306,
//         dialect: 'mysql',
//         logging: false,
//         define: {
//             timestamps: true,
//             freezeTableName: true
//         }
//     }
// );

// module.exports = { sequelize };

// // Initialize only the one model that still uses factory style
// const UserModel = require('../models/userModel');
// const User = UserModel(sequelize, DataTypes);

// module.exports = {
//     sequelize,
//     User
// };



const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false,
        define: {
            timestamps: true,
            freezeTableName: true
        }
    }
);

module.exports = {
    sequelize,
    query: sequelize.query.bind(sequelize), // Optional shorthand
    QueryTypes: Sequelize.QueryTypes
};

