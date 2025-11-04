// services/trackingService.js
const EmailMetric = require('../../models/EmailMetric');
const BounceTracking = require('../../models/BounceTracking');
const EngagementTracking = require('../../models/EngagementTracking');
const SpamComplaint = require('../../models/SpamComplaint');
const ReplyTracking = require('../../models/ReplyTracking');

class TrackingService {

    // services/trackingService.js - FIXED VERSION
    async trackEmailSent(emailData) {
        try {
            // 🚨 ENSURE REQUIRED FIELDS ARE PRESENT
            if (!emailData.senderType) {
                console.log(`⚠️  senderType missing, determining from sender: ${emailData.senderEmail}`);
                emailData.senderType = this.determineSenderType(emailData.senderEmail, emailData);
            }

            if (!emailData.receiverType) {
                console.log(`⚠️  receiverType missing, determining from receiver: ${emailData.receiverEmail}`);
                emailData.receiverType = this.determineReceiverType(emailData.receiverEmail, emailData);
            }

            // 🚨 VALIDATE REQUIRED FIELDS
            const requiredFields = ['senderEmail', 'senderType', 'receiverEmail', 'receiverType', 'messageId'];
            const missingFields = requiredFields.filter(field => !emailData[field]);

            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }

            const emailMetric = await EmailMetric.create({
                senderEmail: emailData.senderEmail,
                senderType: emailData.senderType,
                receiverEmail: emailData.receiverEmail,
                receiverType: emailData.receiverType,
                subject: emailData.subject || 'Warmup Email',
                messageId: emailData.messageId,
                status: 'sent',
                sentAt: new Date(),
                emailType: emailData.emailType || 'warmup_send',
                direction: emailData.direction || 'WARMUP_TO_POOL',
                warmupDay: emailData.warmupDay || 0,
                replyRate: emailData.replyRate || 0.25,
                industry: emailData.industry || 'general',
                isCoordinated: emailData.isCoordinated || false
            });

            console.log(`✅ Email sent tracked: ${emailData.senderEmail} → ${emailData.receiverEmail}`);
            return emailMetric;
        } catch (error) {
            console.error('❌ Error tracking email sent:', error.message);
            throw error;
        }
    }

    // 🚨 ADD HELPER METHODS TO DETERMINE TYPES
    determineSenderType(senderEmail, emailData) {
        // If direction tells us the type
        if (emailData.direction === 'POOL_TO_WARMUP') {
            return 'pool';
        } else if (emailData.direction === 'WARMUP_TO_POOL') {
            // Check if it's a known warmup account type
            if (emailData.senderType) return emailData.senderType;

            // Default to warmup for sending direction
            return 'warmup';
        }

        // Fallback: Check email domain or other indicators
        if (senderEmail.includes('@gmail.com') || senderEmail.includes('@googlemail.com')) {
            return 'google';
        } else if (senderEmail.includes('@outlook.com') || senderEmail.includes('@hotmail.com')) {
            return 'microsoft';
        }

        return 'smtp'; // Default fallback
    }

    determineReceiverType(receiverEmail, emailData) {
        // If direction tells us the type
        if (emailData.direction === 'WARMUP_TO_POOL') {
            return 'pool';
        } else if (emailData.direction === 'POOL_TO_WARMUP') {
            // Receiver is the warmup account in this case
            return 'warmup';
        }

        // Fallback based on domain
        if (receiverEmail.includes('@gmail.com') || receiverEmail.includes('@googlemail.com')) {
            return 'google';
        } else if (receiverEmail.includes('@outlook.com') || receiverEmail.includes('@hotmail.com')) {
            return 'microsoft';
        }

        return 'smtp'; // Default fallback
    }

    // Track Email Delivery
    async trackEmailDelivered(messageId, deliveryData = {}) {
        try {
            const updateData = {
                status: 'delivered',
                deliveredAt: new Date(),
                deliveredInbox: deliveryData.deliveredInbox || false,
                deliveryFolder: deliveryData.deliveryFolder || null
            };

            const [affectedRows] = await EmailMetric.update(updateData, {
                where: { messageId }
            });

            if (affectedRows > 0) {
                console.log(`✅ Email delivery tracked: ${messageId}`);
                return true;
            } else {
                console.log(`⚠️ Email not found for delivery tracking: ${messageId}`);
                return false;
            }
        } catch (error) {
            console.error('❌ Error tracking email delivery:', error);
            throw error;
        }
    }

    // Track Email Bounce
    async trackEmailBounce(messageId, bounceData) {
        try {
            // Update EmailMetric
            const [affectedRows] = await EmailMetric.update({
                status: 'bounced',
                bouncedAt: new Date()
            }, {
                where: { messageId }
            });

            if (affectedRows > 0) {
                // Get the email metric record
                const emailMetric = await EmailMetric.findOne({ where: { messageId } });

                // Create bounce tracking record
                await BounceTracking.create({
                    emailMetricId: emailMetric.id,
                    senderEmail: emailMetric.senderEmail,
                    receiverEmail: emailMetric.receiverEmail,
                    messageId: messageId,
                    bounceType: bounceData.bounceType,
                    bounceCategory: bounceData.bounceCategory,
                    bounceReason: bounceData.bounceReason,
                    bounceCode: bounceData.bounceCode,
                    smtpResponse: bounceData.smtpResponse,
                    receivingServer: bounceData.receivingServer,
                    isp: bounceData.isp,
                    canRetry: bounceData.canRetry || false,
                    retryAfter: bounceData.retryAfter
                });

                console.log(`✅ Email bounce tracked: ${messageId} - ${bounceData.bounceType}`);
                return true;
            } else {
                console.log(`⚠️ Email not found for bounce tracking: ${messageId}`);
                return false;
            }
        } catch (error) {
            console.error('❌ Error tracking email bounce:', error);
            throw error;
        }
    }

    // Track Email Open
    async trackEmailOpen(messageId, engagementData = {}) {
        try {
            const emailMetric = await EmailMetric.findOne({ where: { messageId } });

            if (!emailMetric) {
                console.log(`⚠️ Email not found for open tracking: ${messageId}`);
                return false;
            }

            let engagement = await EngagementTracking.findOne({
                where: { emailMetricId: emailMetric.id }
            });

            if (engagement) {
                // Update existing engagement
                await engagement.update({
                    opened: true,
                    lastOpenedAt: new Date(),
                    openCount: engagement.openCount + 1,
                    uniqueOpens: engagement.uniqueOpens + (engagementData.isUnique ? 1 : 0),
                    userAgent: engagementData.userAgent || engagement.userAgent,
                    ipAddress: engagementData.ipAddress || engagement.ipAddress,
                    platform: engagementData.platform || engagement.platform,
                    clientType: engagementData.clientType || engagement.clientType
                });
            } else {
                // Create new engagement record
                engagement = await EngagementTracking.create({
                    emailMetricId: emailMetric.id,
                    senderEmail: emailMetric.senderEmail,
                    receiverEmail: emailMetric.receiverEmail,
                    messageId: messageId,
                    opened: true,
                    firstOpenedAt: new Date(),
                    lastOpenedAt: new Date(),
                    openCount: 1,
                    uniqueOpens: engagementData.isUnique ? 1 : 0,
                    userAgent: engagementData.userAgent,
                    ipAddress: engagementData.ipAddress,
                    platform: engagementData.platform,
                    clientType: engagementData.clientType
                });
            }

            console.log(`✅ Email open tracked: ${messageId}`);
            return true;
        } catch (error) {
            console.error('❌ Error tracking email open:', error);
            throw error;
        }
    }

    // Track Email Click
    async trackEmailClick(messageId, clickData = {}) {
        try {
            const emailMetric = await EmailMetric.findOne({ where: { messageId } });

            if (!emailMetric) {
                console.log(`⚠️ Email not found for click tracking: ${messageId}`);
                return false;
            }

            let engagement = await EngagementTracking.findOne({
                where: { emailMetricId: emailMetric.id }
            });

            if (engagement) {
                // Update existing engagement
                await engagement.update({
                    clicked: true,
                    lastClickedAt: new Date(),
                    clickCount: engagement.clickCount + 1,
                    uniqueClicks: engagement.uniqueClicks + (clickData.isUnique ? 1 : 0)
                });
            } else {
                // Create new engagement record
                engagement = await EngagementTracking.create({
                    emailMetricId: emailMetric.id,
                    senderEmail: emailMetric.senderEmail,
                    receiverEmail: emailMetric.receiverEmail,
                    messageId: messageId,
                    clicked: true,
                    firstClickedAt: new Date(),
                    lastClickedAt: new Date(),
                    clickCount: 1,
                    uniqueClicks: clickData.isUnique ? 1 : 0,
                    userAgent: clickData.userAgent,
                    ipAddress: clickData.ipAddress,
                    platform: clickData.platform,
                    clientType: clickData.clientType
                });
            }

            console.log(`✅ Email click tracked: ${messageId}`);
            return true;
        } catch (error) {
            console.error('❌ Error tracking email click:', error);
            throw error;
        }
    }

    // Track Spam Complaint
    async trackSpamComplaint(messageId, complaintData) {
        try {
            const emailMetric = await EmailMetric.findOne({ where: { messageId } });

            if (!emailMetric) {
                console.log(`⚠️ Email not found for spam complaint tracking: ${messageId}`);
                return false;
            }

            await SpamComplaint.create({
                emailMetricId: emailMetric.id,
                senderEmail: emailMetric.senderEmail,
                receiverEmail: emailMetric.receiverEmail,
                messageId: messageId,
                complaintType: complaintData.complaintType,
                complaintSource: complaintData.complaintSource,
                complaintFeedback: complaintData.complaintFeedback,
                reportingIsp: complaintData.reportingIsp,
                feedbackLoopId: complaintData.feedbackLoopId
            });

            // Update EmailMetric
            await EmailMetric.update({
                spamReported: true,
                spamReportedAt: new Date()
            }, {
                where: { messageId }
            });

            console.log(`✅ Spam complaint tracked: ${messageId}`);
            return true;
        } catch (error) {
            console.error('❌ Error tracking spam complaint:', error);
            throw error;
        }
    }

    // Track Reply
    async trackReply(originalMessageId, replyData) {
        try {
            const originalEmail = await EmailMetric.findOne({
                where: { messageId: originalMessageId }
            });

            if (!originalEmail) {
                console.log(`⚠️ Original email not found for reply tracking: ${originalMessageId}`);
                return false;
            }

            const replyEmail = await EmailMetric.findOne({
                where: { messageId: replyData.replyMessageId }
            });

            const responseTime = replyData.repliedAt - originalEmail.sentAt;
            const responseTimeMinutes = Math.round(responseTime / (1000 * 60));

            await ReplyTracking.create({
                originalEmailMetricId: originalEmail.id,
                replyEmailMetricId: replyEmail?.id || null,
                originalSender: originalEmail.senderEmail,
                originalReceiver: originalEmail.receiverEmail,
                originalMessageId: originalMessageId,
                replySender: replyData.replySender,
                replyReceiver: replyData.replyReceiver,
                replyMessageId: replyData.replyMessageId,
                originalSentAt: originalEmail.sentAt,
                repliedAt: replyData.repliedAt,
                responseTime: responseTimeMinutes,
                threadDepth: replyData.threadDepth || 1,
                isAutomatedReply: replyData.isAutomatedReply || false,
                replyQuality: replyData.replyQuality
            });

            // Update original email metric
            await EmailMetric.update({
                replied: true,
                repliedAt: replyData.repliedAt,
                replyMessageId: replyData.replyMessageId
            }, {
                where: { messageId: originalMessageId }
            });

            console.log(`✅ Reply tracked: ${originalMessageId} → ${replyData.replyMessageId}`);
            return true;
        } catch (error) {
            console.error('❌ Error tracking reply:', error);
            throw error;
        }
    }

    // Get Email Timeline
    async getEmailTimeline(messageId) {
        try {
            const emailMetric = await EmailMetric.findOne({
                where: { messageId },
                include: [
                    {
                        model: BounceTracking,
                        required: false
                    },
                    {
                        model: EngagementTracking,
                        required: false
                    },
                    {
                        model: SpamComplaint,
                        required: false
                    }
                ]
            });

            if (!emailMetric) {
                return null;
            }

            const timeline = [];

            // Sent event
            timeline.push({
                event: 'sent',
                timestamp: emailMetric.sentAt,
                data: {
                    sender: emailMetric.senderEmail,
                    receiver: emailMetric.receiverEmail,
                    subject: emailMetric.subject
                }
            });

            // Delivery event
            if (emailMetric.deliveredAt) {
                timeline.push({
                    event: 'delivered',
                    timestamp: emailMetric.deliveredAt,
                    data: {
                        inbox: emailMetric.deliveredInbox,
                        folder: emailMetric.deliveryFolder
                    }
                });
            }

            // Bounce event
            if (emailMetric.BounceTracking) {
                timeline.push({
                    event: 'bounced',
                    timestamp: emailMetric.BounceTracking.bouncedAt,
                    data: {
                        type: emailMetric.BounceTracking.bounceType,
                        reason: emailMetric.BounceTracking.bounceReason
                    }
                });
            }

            // Open events
            if (emailMetric.EngagementTracking && emailMetric.EngagementTracking.firstOpenedAt) {
                timeline.push({
                    event: 'opened',
                    timestamp: emailMetric.EngagementTracking.firstOpenedAt,
                    data: {
                        count: emailMetric.EngagementTracking.openCount,
                        unique: emailMetric.EngagementTracking.uniqueOpens
                    }
                });
            }

            // Click events
            if (emailMetric.EngagementTracking && emailMetric.EngagementTracking.firstClickedAt) {
                timeline.push({
                    event: 'clicked',
                    timestamp: emailMetric.EngagementTracking.firstClickedAt,
                    data: {
                        count: emailMetric.EngagementTracking.clickCount,
                        unique: emailMetric.EngagementTracking.uniqueClicks
                    }
                });
            }

            // Reply event
            if (emailMetric.repliedAt) {
                timeline.push({
                    event: 'replied',
                    timestamp: emailMetric.repliedAt,
                    data: {
                        replyMessageId: emailMetric.replyMessageId
                    }
                });
            }

            // Spam complaint event
            if (emailMetric.SpamComplaint) {
                timeline.push({
                    event: 'spam_reported',
                    timestamp: emailMetric.SpamComplaint.reportedAt,
                    data: {
                        type: emailMetric.SpamComplaint.complaintType,
                        source: emailMetric.SpamComplaint.complaintSource
                    }
                });
            }

            // Sort timeline by timestamp
            timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            return {
                email: emailMetric,
                timeline
            };
        } catch (error) {
            console.error('❌ Error getting email timeline:', error);
            throw error;
        }
    }
}

module.exports = new TrackingService();