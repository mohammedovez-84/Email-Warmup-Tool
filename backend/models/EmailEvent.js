// models/EmailEvent.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const EmailEvent = sequelize.define('email_events', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    event_type: {
        type: DataTypes.ENUM(
            'sent', 'delivered', 'bounced', 'spam_complaint',
            'opened', 'clicked', 'replied', 'unsubscribed', 'blocked'
        ),
        allowNull: false
    },
    message_id: { type: DataTypes.STRING },
    recipient_email: { type: DataTypes.STRING },
    recipient_domain: { type: DataTypes.STRING },
    event_data: { type: DataTypes.JSON },
    ip_address: { type: DataTypes.STRING },
    user_agent: { type: DataTypes.TEXT },

    // SMTP response codes
    smtp_response: { type: DataTypes.TEXT },
    bounce_type: {
        type: DataTypes.ENUM('hard_bounce', 'soft_bounce', 'blocked', 'unknown'),
        allowNull: true
    },
    bounce_reason: { type: DataTypes.TEXT },

    // Engagement data
    engagement_data: { type: DataTypes.JSON },

}, {
    tableName: 'email_events',
    timestamps: true,
    indexes: [
        { fields: ['email', 'event_type'] },
        { fields: ['event_type', 'created_at'] },
        { fields: ['recipient_domain'] },
        { fields: ['message_id'] }
    ]
});

module.exports = EmailEvent;