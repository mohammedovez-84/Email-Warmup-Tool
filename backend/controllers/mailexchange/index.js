const EmailMetric = require('../../models/EmailMetric');
const ReplyTracking = require('../../models/ReplyTracking');
const { Op } = require('sequelize');

class MailExchangeController {
    // 📧 GET ALL MAIL EXCHANGES (Sent + Replies)
    async getAllMailExchanges(req, res) {
        try {
            const { email, days = 30, page = 1, limit = 50 } = req.query;

            if (!email) {
                return res.status(400).json({ error: 'Email parameter is required' });
            }

            const offset = (page - 1) * limit;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            console.log('🔍 Fetching mail exchanges for:', email);

            // Get sent emails
            const sentEmails = await EmailMetric.findAndCountAll({
                where: {
                    senderEmail: email,
                    sentAt: { [Op.gte]: startDate }
                },
                attributes: [
                    'id', 'senderEmail', 'receiverEmail', 'subject', 'sentAt',
                    'status', 'deliveredAt', 'deliveredInbox', 'messageId',
                    'completedAt'
                ],
                order: [['sentAt', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            console.log('📤 Sent emails found:', sentEmails.count);

            // Get replies using manual approach (no includes)
            const replyTrackings = await ReplyTracking.findAll({
                where: {
                    [Op.or]: [
                        { originalSender: email },
                        { replySender: email }
                    ],
                    repliedAt: { [Op.gte]: startDate }
                },
                raw: true
            });

            console.log('📥 Reply trackings found:', replyTrackings.length);

            // Get original and reply email details manually
            const originalEmailIds = replyTrackings.map(reply => reply.originalEmailMetricId).filter(id => id);
            const replyEmailIds = replyTrackings.map(reply => reply.replyEmailMetricId).filter(id => id);
            const allEmailIds = [...new Set([...originalEmailIds, ...replyEmailIds])];

            let emailDetails = [];
            if (allEmailIds.length > 0) {
                emailDetails = await EmailMetric.findAll({
                    where: { id: allEmailIds },
                    raw: true
                });
            }

            console.log('📨 Email details found:', emailDetails.length);

            // Process sent emails
            const processedSentEmails = sentEmails.rows.map(email => ({
                ...email.toJSON(),
                effectiveDeliveredAt: email.deliveredAt || email.completedAt || email.sentAt,
                deliveryStatus: email.status,
                type: 'sent'
            }));

            // Process replies by combining reply tracking with email details
            const processedReplies = replyTrackings.map(tracking => {
                const originalEmail = emailDetails.find(email => email.id === tracking.originalEmailMetricId);
                const replyEmail = emailDetails.find(email => email.id === tracking.replyEmailMetricId);

                return {
                    ...tracking,
                    originalEmail: originalEmail || null,
                    replyEmail: replyEmail || null,
                    type: 'reply_tracking'
                };
            });

            // Combine and format the data
            const mailExchanges = {
                sentEmails: processedSentEmails,
                replies: processedReplies,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(sentEmails.count / limit),
                    totalItems: sentEmails.count,
                    itemsPerPage: parseInt(limit)
                },
                debug: {
                    sentCount: processedSentEmails.length,
                    repliesCount: processedReplies.length,
                    replyTrackingsCount: replyTrackings.length
                }
            };

            console.log('✅ Final data - Sent:', processedSentEmails.length, 'Replies:', processedReplies.length);

            res.json({
                success: true,
                data: mailExchanges
            });

        } catch (error) {
            console.error('❌ Mail exchanges error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch mail exchanges',
                details: error.message
            });
        }
    }

    // 🔄 GET EMAIL THREADS (Complete conversation threads)
    async getEmailThreads(req, res) {
        try {
            const { email, days = 30 } = req.query;

            if (!email) {
                return res.status(400).json({ error: 'Email parameter is required' });
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            console.log('🔍 Fetching threads for:', email);

            // Get all reply trackings for this email
            const replyTrackings = await ReplyTracking.findAll({
                where: {
                    [Op.or]: [
                        { originalSender: email },
                        { replySender: email }
                    ],
                    repliedAt: { [Op.gte]: startDate }
                },
                raw: true
            });

            console.log('📋 Reply trackings found:', replyTrackings.length);

            // Get all related email IDs
            const allEmailIds = [];
            replyTrackings.forEach(tracking => {
                if (tracking.originalEmailMetricId) allEmailIds.push(tracking.originalEmailMetricId);
                if (tracking.replyEmailMetricId) allEmailIds.push(tracking.replyEmailMetricId);
            });

            const uniqueEmailIds = [...new Set(allEmailIds)];

            // Get all email details
            let emailDetails = [];
            if (uniqueEmailIds.length > 0) {
                emailDetails = await EmailMetric.findAll({
                    where: { id: uniqueEmailIds },
                    raw: true
                });
            }

            console.log('📨 Email details found:', emailDetails.length);

            // Build threads by combining data
            const threads = replyTrackings.map(tracking => {
                const originalEmail = emailDetails.find(email => email.id === tracking.originalEmailMetricId);
                const replyEmail = emailDetails.find(email => email.id === tracking.replyEmailMetricId);

                return {
                    id: tracking.id,
                    originalEmail: originalEmail ? {
                        id: originalEmail.id,
                        subject: originalEmail.subject,
                        sentAt: originalEmail.sentAt,
                        senderEmail: originalEmail.senderEmail,
                        receiverEmail: originalEmail.receiverEmail,
                        status: originalEmail.status,
                        effectiveDeliveredAt: originalEmail.deliveredAt || originalEmail.sentAt
                    } : null,
                    replyEmail: replyEmail ? {
                        id: replyEmail.id,
                        subject: replyEmail.subject,
                        sentAt: replyEmail.sentAt,
                        senderEmail: replyEmail.senderEmail,
                        receiverEmail: replyEmail.receiverEmail,
                        status: replyEmail.status,
                        effectiveDeliveredAt: replyEmail.deliveredAt || replyEmail.sentAt
                    } : null,
                    repliedAt: tracking.repliedAt,
                    responseTime: tracking.responseTime,
                    threadDepth: tracking.threadDepth
                };
            });

            res.json({
                success: true,
                data: {
                    threads,
                    debug: {
                        replyTrackingsCount: replyTrackings.length,
                        emailDetailsCount: emailDetails.length,
                        uniqueEmailIds: uniqueEmailIds.length
                    }
                }
            });

        } catch (error) {
            console.error('❌ Email threads error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch email threads',
                details: error.message
            });
        }
    }
}

module.exports = new MailExchangeController();