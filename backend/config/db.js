



const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        password: process.env.DB_PASS,
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

