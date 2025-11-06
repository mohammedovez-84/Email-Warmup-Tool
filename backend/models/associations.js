// models/associations.js
const EmailMetric = require('./EmailMetric');
const EngagementTracking = require('./EngagementTracking');
const SpamMonitoring = require('./SpamComplaint');
const BounceTracking = require('./BounceTracking');
const ReplyTracking = require('./ReplyTracking');

// Set up associations
module.exports = function setupAssociations() {
    try {
        // EmailMetric associations
        EmailMetric.hasMany(EngagementTracking, {
            foreignKey: 'messageId',
            sourceKey: 'messageId',
            as: 'engagements'
        });

        EmailMetric.hasMany(BounceTracking, {
            foreignKey: 'messageId',
            sourceKey: 'messageId',
            as: 'bounces'
        });

        EmailMetric.hasMany(SpamMonitoring, {
            foreignKey: 'messageId',
            sourceKey: 'messageId',
            as: 'spamReports'
        });

        // ReplyTracking associations
        ReplyTracking.belongsTo(EmailMetric, {
            foreignKey: 'originalEmailMetricId',
            targetKey: 'id',
            as: 'originalEmail'
        });

        ReplyTracking.belongsTo(EmailMetric, {
            foreignKey: 'replyEmailMetricId',
            targetKey: 'id',
            as: 'replyEmail'
        });

        // EmailMetric has replies
        EmailMetric.hasMany(ReplyTracking, {
            foreignKey: 'originalEmailMetricId',
            as: 'sentReplies'
        });

        EmailMetric.hasMany(ReplyTracking, {
            foreignKey: 'replyEmailMetricId',
            as: 'receivedReplies'
        });

        // EngagementTracking associations
        EngagementTracking.belongsTo(EmailMetric, {
            foreignKey: 'messageId',
            targetKey: 'messageId',
            as: 'email'
        });

        // BounceTracking associations  
        BounceTracking.belongsTo(EmailMetric, {
            foreignKey: 'messageId',
            targetKey: 'messageId',
            as: 'email'
        });

        // SpamMonitoring associations
        SpamMonitoring.belongsTo(EmailMetric, {
            foreignKey: 'messageId',
            targetKey: 'messageId',
            as: 'email'
        });

        console.log('✅ Database associations setup successfully');
    } catch (error) {
        console.error('❌ Error setting up database associations:', error);
    }
};