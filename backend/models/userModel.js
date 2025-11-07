


const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    // Full name (first_name + last_name combined in controller before save)

    name: { type: DataTypes.STRING, allowNull: false },
    lastname: { type: DataTypes.STRING, allowNull: false },

    title: { type: DataTypes.STRING },

    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: true },

    role: {
        type: DataTypes.ENUM('user', 'superadmin'),
        defaultValue: 'user'
    },
    company: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },

    industry: {
        type: DataTypes.STRING
    },
    two_fa_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    two_fa_secret: { type: DataTypes.STRING },
    two_fa_temp_secret: { type: DataTypes.STRING, allowNull: true }, // ← ADD THIS for email OTP
    two_fa_method: { type: DataTypes.STRING, allowNull: true },


    email_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    email_verification_token: { type: DataTypes.STRING },
    email_verification_expires: { type: DataTypes.DATE },

    reset_password_token: { type: DataTypes.STRING },
    reset_password_expires: { type: DataTypes.DATE },
    reset_token_used: { type: DataTypes.BOOLEAN, defaultValue: false },

    failed_login_attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    account_locked_until: { type: DataTypes.DATE },


    isGoogleAccount: { type: DataTypes.BOOLEAN, defaultValue: false },

    last_login: { type: DataTypes.DATE }
}, {
    timestamps: true,
    tableName: 'users'
});

// Password check method
User.prototype.isValidPassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = User;
