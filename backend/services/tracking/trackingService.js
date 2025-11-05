// services/trackingService.js - FIXED VERSION
const EmailMetric = require('../../models/EmailMetric');
const BounceTracking = require('../../models/BounceTracking');
const EngagementTracking = require('../../models/EngagementTracking');
const SpamComplaint = require('../../models/SpamComplaint');
const ReplyTracking = require('../../models/ReplyTracking');

class TrackingService {

    // 🚨 FIXED: Better error handling and field validation
    async trackEmailSent(emailData) {
        try {
            console.log(`📊 Tracking email sent:`, {
                sender: emailData.senderEmail,
                receiver: emailData.receiverEmail,
                direction: emailData.direction,
                messageId: emailData.messageId
            });

            // 🚨 ENSURE REQUIRED FIELDS ARE PRESENT WITH FALLBACKS
            const validatedData = this.validateAndCompleteEmailData(emailData);

            const emailMetric = await EmailMetric.create({
                senderEmail: validatedData.senderEmail,
                senderType: validatedData.senderType,
                receiverEmail: validatedData.receiverEmail,
                receiverType: validatedData.receiverType,
                subject: validatedData.subject || 'Warmup Email',
                messageId: validatedData.messageId,
                status: 'sent',
                sentAt: new Date(),
                emailType: validatedData.emailType || 'warmup_send',
                direction: validatedData.direction || 'WARMUP_TO_POOL',
                warmupDay: validatedData.warmupDay || 0,
                replyRate: validatedData.replyRate || 0.25,
                industry: validatedData.industry || 'general',
                isCoordinated: validatedData.isCoordinated || false,
                graphApiUsed: validatedData.graphApiUsed || false
            });

            console.log(`✅ Email sent tracked: ${validatedData.senderEmail} → ${validatedData.receiverEmail}`);
            return emailMetric;
        } catch (error) {
            console.error('❌ Error tracking email sent:', error.message);

            // 🚨 DON'T THROW ERROR - JUST LOG AND CONTINUE
            // This prevents the entire email process from failing due to tracking issues
            console.log('⚠️ Continuing without tracking...');
            return null;
        }
    }

    // 🚨 NEW: Comprehensive data validation and completion
    validateAndCompleteEmailData(emailData) {
        const validated = { ...emailData };

        // 🚨 GUARANTEE MESSAGE ID EXISTS
        if (!validated.messageId) {
            validated.messageId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            console.log(`⚠️  Generated fallback messageId: ${validated.messageId}`);
        }

        // 🚨 DETERMINE SENDER TYPE
        if (!validated.senderType) {
            validated.senderType = this.determineSenderType(validated.senderEmail, validated);
            console.log(`⚠️  Determined senderType: ${validated.senderType}`);
        }

        // 🚨 DETERMINE RECEIVER TYPE
        if (!validated.receiverType) {
            validated.receiverType = this.determineReceiverType(validated.receiverEmail, validated);
            console.log(`⚠️  Determined receiverType: ${validated.receiverType}`);
        }

        // 🚨 VALIDATE CRITICAL FIELDS
        if (!validated.senderEmail) {
            throw new Error('senderEmail is required');
        }
        if (!validated.receiverEmail) {
            throw new Error('receiverEmail is required');
        }

        return validated;
    }

    // 🚨 IMPROVED: Determine sender type with better logic
    determineSenderType(senderEmail, emailData) {
        // Priority 1: Use direction to determine type
        if (emailData.direction === 'POOL_TO_WARMUP') {
            return 'pool';
        } else if (emailData.direction === 'WARMUP_TO_POOL') {
            // Check if we have explicit sender type
            if (emailData.senderType) return emailData.senderType;

            // Default to warmup for sending direction
            return 'warmup';
        }

        // Priority 2: Check for pool indicators
        if (emailData.emailType === 'pool_send') {
            return 'pool';
        }

        // Priority 3: Domain-based detection
        if (senderEmail.includes('@gmail.com') || senderEmail.includes('@googlemail.com')) {
            return 'google';
        } else if (senderEmail.includes('@outlook.com') || senderEmail.includes('@hotmail.com')) {
            return 'microsoft';
        }

        // Priority 4: Check for SMTP indicators
        if (emailData.smtpConfig || emailData.smtp_host) {
            return 'smtp';
        }

        return 'unknown'; // Safe fallback
    }

    // 🚨 IMPROVED: Determine receiver type with better logic
    determineReceiverType(receiverEmail, emailData) {
        // Priority 1: Use direction to determine type
        if (emailData.direction === 'WARMUP_TO_POOL') {
            return 'pool';
        } else if (emailData.direction === 'POOL_TO_WARMUP') {
            // Receiver is the warmup account in this case
            return 'warmup';
        }

        // Priority 2: Check for pool indicators
        if (emailData.emailType === 'warmup_receive') {
            return 'warmup';
        }

        // Priority 3: Domain-based detection
        if (receiverEmail.includes('@gmail.com') || receiverEmail.includes('@googlemail.com')) {
            return 'google';
        } else if (receiverEmail.includes('@outlook.com') || receiverEmail.includes('@hotmail.com')) {
            return 'microsoft';
        }

        return 'unknown'; // Safe fallback
    }

    async trackEmailDelivery(messageId, success, folder = 'UNKNOWN', error = null) {
        try {
            const deliveryData = {
                messageId: messageId,
                success: success,
                folder: folder,
                checkedAt: new Date(),
                error: error
            };

            console.log(`📊 Delivery Tracking: ${messageId} - ${success ? 'SUCCESS' : 'FAILED'} in ${folder}`);

            if (!success) {
                console.log(`🚨 DELIVERY FAILURE: ${messageId} - ${error || 'Not found in inbox'}`);

                // Track delivery failure for analytics
                await this.trackEmailBounce(messageId, {
                    bounceType: 'soft_bounce',
                    bounceCategory: 'delivery_failure',
                    bounceReason: error || 'Email not delivered to inbox',
                    canRetry: true,
                    deliveryFolder: folder
                });
            } else {
                console.log(`✅ DELIVERY SUCCESS: ${messageId} in ${folder}`);

                // Track successful delivery
                await this.trackEmailDelivered(messageId, {
                    deliveredInbox: folder === 'INBOX' || folder.includes('Important'),
                    deliveryFolder: folder,
                    checkedAt: new Date()
                });
            }

            return deliveryData;

        } catch (error) {
            console.error('❌ Error tracking delivery:', error);
            throw error;
        }
    }

    // 🚨 FIXED: Track Email Delivery with better error handling
    async trackEmailDelivered(messageId, deliveryData = {}) {
        try {
            if (!messageId) {
                console.log('⚠️ No messageId provided for delivery tracking');
                return false;
            }

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
            console.error('❌ Error tracking email delivery:', error.message);
            return false; // Don't throw, just return false
        }
    }

    // 🚨 FIXED: Track Email Bounce with better error handling
    async trackEmailBounce(messageId, bounceData = {}) {
        try {
            if (!messageId) {
                console.log('⚠️ No messageId provided for bounce tracking');
                return false;
            }

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

                if (emailMetric) {
                    // Create bounce tracking record
                    await BounceTracking.create({
                        emailMetricId: emailMetric.id,
                        senderEmail: emailMetric.senderEmail,
                        receiverEmail: emailMetric.receiverEmail,
                        messageId: messageId,
                        bounceType: bounceData.bounceType || 'soft_bounce',
                        bounceCategory: bounceData.bounceCategory || 'transient',
                        bounceReason: bounceData.bounceReason || 'Unknown error',
                        bounceCode: bounceData.bounceCode,
                        smtpResponse: bounceData.smtpResponse,
                        receivingServer: bounceData.receivingServer,
                        isp: bounceData.isp,
                        canRetry: bounceData.canRetry || false,
                        retryAfter: bounceData.retryAfter
                    });

                    console.log(`✅ Email bounce tracked: ${messageId} - ${bounceData.bounceType || 'soft_bounce'}`);
                    return true;
                }
            }

            console.log(`⚠️ Email not found for bounce tracking: ${messageId}`);
            return false;
        } catch (error) {
            console.error('❌ Error tracking email bounce:', error.message);
            return false; // Don't throw, just return false
        }
    }

    // 🚨 FIXED: Track Email Open with better error handling
    async trackEmailOpen(messageId, engagementData = {}) {
        try {
            if (!messageId) {
                console.log('⚠️ No messageId provided for open tracking');
                return false;
            }

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
                    openCount: (engagement.openCount || 0) + 1,
                    uniqueOpens: (engagement.uniqueOpens || 0) + (engagementData.isUnique ? 1 : 0),
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
            console.error('❌ Error tracking email open:', error.message);
            return false; // Don't throw, just return false
        }
    }

    // 🚨 FIXED: Track Email Click with better error handling
    async trackEmailClick(messageId, clickData = {}) {
        try {
            if (!messageId) {
                console.log('⚠️ No messageId provided for click tracking');
                return false;
            }

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
                    clickCount: (engagement.clickCount || 0) + 1,
                    uniqueClicks: (engagement.uniqueClicks || 0) + (clickData.isUnique ? 1 : 0)
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
            console.error('❌ Error tracking email click:', error.message);
            return false; // Don't throw, just return false
        }
    }

    // 🚨 FIXED: Track Spam Complaint with better error handling
    async trackSpamComplaint(messageId, complaintData = {}) {
        try {
            if (!messageId) {
                console.log('⚠️ No messageId provided for spam complaint tracking');
                return false;
            }

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
                complaintType: complaintData.complaintType || 'unknown',
                complaintSource: complaintData.complaintSource || 'unknown',
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
            console.error('❌ Error tracking spam complaint:', error.message);
            return false; // Don't throw, just return false
        }
    }

    // 🚨 FIXED: Track Reply with better error handling
    async trackReply(originalMessageId, replyData = {}) {
        try {
            if (!originalMessageId) {
                console.log('⚠️ No originalMessageId provided for reply tracking');
                return false;
            }

            const originalEmail = await EmailMetric.findOne({
                where: { messageId: originalMessageId }
            });

            if (!originalEmail) {
                console.log(`⚠️ Original email not found for reply tracking: ${originalMessageId}`);
                return false;
            }

            const responseTime = replyData.repliedAt ? (replyData.repliedAt - originalEmail.sentAt) : 0;
            const responseTimeMinutes = Math.round(responseTime / (1000 * 60));

            await ReplyTracking.create({
                originalEmailMetricId: originalEmail.id,
                replyEmailMetricId: replyData.replyEmailMetricId || null,
                originalSender: originalEmail.senderEmail,
                originalReceiver: originalEmail.receiverEmail,
                originalMessageId: originalMessageId,
                replySender: replyData.replySender || originalEmail.receiverEmail,
                replyReceiver: replyData.replyReceiver || originalEmail.senderEmail,
                replyMessageId: replyData.replyMessageId || `reply-${originalMessageId}`,
                originalSentAt: originalEmail.sentAt,
                repliedAt: replyData.repliedAt || new Date(),
                responseTime: responseTimeMinutes,
                threadDepth: replyData.threadDepth || 1,
                isAutomatedReply: replyData.isAutomatedReply || false,
                replyQuality: replyData.replyQuality || 'unknown'
            });

            // Update original email metric
            await EmailMetric.update({
                replied: true,
                repliedAt: replyData.repliedAt || new Date(),
                replyMessageId: replyData.replyMessageId || `reply-${originalMessageId}`
            }, {
                where: { messageId: originalMessageId }
            });

            console.log(`✅ Reply tracked: ${originalMessageId} → ${replyData.replyMessageId || 'unknown'}`);
            return true;
        } catch (error) {
            console.error('❌ Error tracking reply:', error.message);
            return false; // Don't throw, just return false
        }
    }

    // 🚨 FIXED: Get Email Timeline with better error handling
    async getEmailTimeline(messageId) {
        try {
            if (!messageId) {
                console.log('⚠️ No messageId provided for timeline');
                return null;
            }

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
                    },
                    {
                        model: ReplyTracking,
                        as: 'Replies',
                        required: false
                    }
                ]
            });

            if (!emailMetric) {
                console.log(`⚠️ Email metric not found for timeline: ${messageId}`);
                return null;
            }

            const timeline = [];

            // 🚨 Sent event (always exists)
            timeline.push({
                event: 'sent',
                timestamp: emailMetric.sentAt,
                status: 'sent',
                data: {
                    sender: emailMetric.senderEmail,
                    receiver: emailMetric.receiverEmail,
                    subject: emailMetric.subject,
                    direction: emailMetric.direction,
                    emailType: emailMetric.emailType
                }
            });

            // 🚨 Delivery event
            if (emailMetric.deliveredAt) {
                timeline.push({
                    event: 'delivered',
                    timestamp: emailMetric.deliveredAt,
                    status: 'delivered',
                    data: {
                        inbox: emailMetric.deliveredInbox,
                        folder: emailMetric.deliveryFolder,
                        isSpam: emailMetric.deliveryFolder === 'SPAM' || emailMetric.deliveryFolder === 'JUNK'
                    }
                });
            }

            // 🚨 Bounce event
            if (emailMetric.BounceTracking) {
                timeline.push({
                    event: 'bounced',
                    timestamp: emailMetric.BounceTracking.createdAt || emailMetric.bouncedAt,
                    status: 'bounced',
                    data: {
                        type: emailMetric.BounceTracking.bounceType,
                        category: emailMetric.BounceTracking.bounceCategory,
                        reason: emailMetric.BounceTracking.bounceReason,
                        canRetry: emailMetric.BounceTracking.canRetry,
                        isp: emailMetric.BounceTracking.isp
                    }
                });
            }

            // 🚨 Open events
            if (emailMetric.EngagementTracking) {
                if (emailMetric.EngagementTracking.firstOpenedAt) {
                    timeline.push({
                        event: 'opened',
                        timestamp: emailMetric.EngagementTracking.firstOpenedAt,
                        status: 'opened',
                        data: {
                            firstOpen: true,
                            count: emailMetric.EngagementTracking.openCount,
                            unique: emailMetric.EngagementTracking.uniqueOpens,
                            userAgent: emailMetric.EngagementTracking.userAgent,
                            platform: emailMetric.EngagementTracking.platform
                        }
                    });
                }

                if (emailMetric.EngagementTracking.lastOpenedAt &&
                    emailMetric.EngagementTracking.lastOpenedAt !== emailMetric.EngagementTracking.firstOpenedAt) {
                    timeline.push({
                        event: 'opened',
                        timestamp: emailMetric.EngagementTracking.lastOpenedAt,
                        status: 'reopened',
                        data: {
                            firstOpen: false,
                            count: emailMetric.EngagementTracking.openCount,
                            unique: emailMetric.EngagementTracking.uniqueOpens
                        }
                    });
                }
            }

            // 🚨 Click events
            if (emailMetric.EngagementTracking && emailMetric.EngagementTracking.firstClickedAt) {
                timeline.push({
                    event: 'clicked',
                    timestamp: emailMetric.EngagementTracking.firstClickedAt,
                    status: 'clicked',
                    data: {
                        firstClick: true,
                        count: emailMetric.EngagementTracking.clickCount,
                        unique: emailMetric.EngagementTracking.uniqueClicks
                    }
                });

                if (emailMetric.EngagementTracking.lastClickedAt &&
                    emailMetric.EngagementTracking.lastClickedAt !== emailMetric.EngagementTracking.firstClickedAt) {
                    timeline.push({
                        event: 'clicked',
                        timestamp: emailMetric.EngagementTracking.lastClickedAt,
                        status: 'reclicked',
                        data: {
                            firstClick: false,
                            count: emailMetric.EngagementTracking.clickCount,
                            unique: emailMetric.EngagementTracking.uniqueClicks
                        }
                    });
                }
            }

            // 🚨 Reply events
            if (emailMetric.repliedAt) {
                timeline.push({
                    event: 'replied',
                    timestamp: emailMetric.repliedAt,
                    status: 'replied',
                    data: {
                        replyMessageId: emailMetric.replyMessageId,
                        responseTime: emailMetric.Replies?.[0]?.responseTime || null,
                        threadDepth: emailMetric.Replies?.[0]?.threadDepth || 1
                    }
                });
            }

            // 🚨 Additional replies from ReplyTracking
            if (emailMetric.Replies && emailMetric.Replies.length > 0) {
                emailMetric.Replies.forEach((reply, index) => {
                    if (index > 0) { // First reply is already tracked above
                        timeline.push({
                            event: 'replied',
                            timestamp: reply.repliedAt,
                            status: 'thread_reply',
                            data: {
                                replyMessageId: reply.replyMessageId,
                                responseTime: reply.responseTime,
                                threadDepth: reply.threadDepth,
                                isAutomated: reply.isAutomatedReply
                            }
                        });
                    }
                });
            }

            // 🚨 Spam complaint event
            if (emailMetric.SpamComplaint) {
                timeline.push({
                    event: 'spam_reported',
                    timestamp: emailMetric.SpamComplaint.createdAt || emailMetric.spamReportedAt,
                    status: 'spam',
                    data: {
                        type: emailMetric.SpamComplaint.complaintType,
                        source: emailMetric.SpamComplaint.complaintSource,
                        isp: emailMetric.SpamComplaint.reportingIsp
                    }
                });
            }

            // 🚨 Current status event
            const currentStatus = emailMetric.status || 'unknown';
            if (currentStatus !== 'sent') {
                timeline.push({
                    event: 'status_update',
                    timestamp: new Date(),
                    status: currentStatus,
                    data: {
                        finalStatus: currentStatus,
                        note: 'Current email status'
                    }
                });
            }

            // 🚨 Sort timeline by timestamp
            timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // 🚨 Calculate engagement metrics
            const engagementMetrics = {
                totalOpens: emailMetric.EngagementTracking?.openCount || 0,
                uniqueOpens: emailMetric.EngagementTracking?.uniqueOpens || 0,
                totalClicks: emailMetric.EngagementTracking?.clickCount || 0,
                uniqueClicks: emailMetric.EngagementTracking?.uniqueClicks || 0,
                replyCount: emailMetric.Replies?.length || (emailMetric.replied ? 1 : 0),
                hasBounced: !!emailMetric.BounceTracking,
                isSpam: !!emailMetric.SpamComplaint,
                deliverySuccess: !!emailMetric.deliveredAt && !emailMetric.BounceTracking
            };

            console.log(`✅ Timeline generated for ${messageId}: ${timeline.length} events`);

            return {
                email: {
                    id: emailMetric.id,
                    messageId: emailMetric.messageId,
                    senderEmail: emailMetric.senderEmail,
                    receiverEmail: emailMetric.receiverEmail,
                    subject: emailMetric.subject,
                    direction: emailMetric.direction,
                    sentAt: emailMetric.sentAt,
                    status: emailMetric.status,
                    warmupDay: emailMetric.warmupDay,
                    replyRate: emailMetric.replyRate
                },
                timeline,
                engagementMetrics,
                summary: {
                    totalEvents: timeline.length,
                    firstEvent: timeline[0]?.timestamp,
                    lastEvent: timeline[timeline.length - 1]?.timestamp,
                    duration: timeline.length > 1 ?
                        (new Date(timeline[timeline.length - 1].timestamp) - new Date(timeline[0].timestamp)) / 1000 : 0
                }
            };

        } catch (error) {
            console.error('❌ Error getting email timeline:', error.message);
            return {
                error: 'Failed to generate timeline',
                message: error.message,
                timeline: [],
                engagementMetrics: {}
            };
        }
    } // 🚨 FIXED: Get Email Timeline with better error handling
    async getEmailTimeline(messageId) {
        try {
            if (!messageId) {
                console.log('⚠️ No messageId provided for timeline');
                return null;
            }

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

            // ... rest of your timeline logic (same as before)

            return {
                email: emailMetric,
                timeline: [] // Your timeline array
            };
        } catch (error) {
            console.error('❌ Error getting email timeline:', error.message);
            return null; // Don't throw, return null
        }
    }
}

module.exports = new TrackingService();