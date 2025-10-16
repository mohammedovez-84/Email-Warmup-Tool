// const { DataTypes } = require('sequelize');
// const { sequelize } = require('../config/db');

// const MicrosoftUser = sequelize.define('microsoft_users', {
//     id: {
//         type: DataTypes.INTEGER,
//         autoIncrement: true,
//         primaryKey: true
//     },
//     name: {
//         type: DataTypes.STRING,
//         allowNull: true
//     },
//     email: {
//         type: DataTypes.STRING,
//         allowNull: true,
//         unique: true
//     },
//     microsoft_id: {
//         type: DataTypes.STRING,
//         allowNull: false,
//         unique: true
//     },
//     refresh_token: {
//         type: DataTypes.TEXT,
//         allowNull: false
//     },
//     access_token: {
//         type: DataTypes.TEXT,
//         allowNull: false
//     },
//     expires_at: {
//         type: DataTypes.BIGINT,
//         allowNull: false
//     },
//     user_id: {
//         type: DataTypes.INTEGER,
//         allowNull: false,
//         references: {
//             model: 'users',
//             key: 'id'
//         },
//         onDelete: 'CASCADE'
//     },
//     warmupStatus: {
//         type: DataTypes.STRING,
//         defaultValue: 'active'
//     },
//     startEmailsPerDay: {
//         type: DataTypes.INTEGER,
//         defaultValue: 3,
//         allowNull: false,
//     },
//     increaseEmailsPerDay: {
//         type: DataTypes.INTEGER,
//         defaultValue: 3,
//         allowNull: false,
//     },
//     maxEmailsPerDay: {
//         type: DataTypes.INTEGER,
//         defaultValue: 25,
//         allowNull: false,
//     },
//     replyRate: {
//         type: DataTypes.FLOAT,
//         defaultValue: 1.0,
//         allowNull: false,
//     },
//     warmupDayCount: {
//         type: DataTypes.INTEGER,
//         defaultValue: 0,
//         allowNull: false,
//     }
// }, {
//     tableName: 'microsoft_users',
//     timestamps: true,
//     underscored: true
// });

// module.exports = MicrosoftUser;



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
    }


}, {
    tableName: 'microsoft_users',
    timestamps: true,
    underscored: true
});

module.exports = MicrosoftUser;