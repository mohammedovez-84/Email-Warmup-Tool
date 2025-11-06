const EmailMetric = require('../../models/EmailMetric');
const BounceTracking = require('../../models/BounceTracking');
const EngagementTracking = require('../../models/EngagementTracking');
const SpamComplaint = require('../../models/SpamComplaint');
const ReplyTracking = require('../../models/ReplyTracking');
const EmailExchange = require('../../models/MailExchange');

class TrackingService {

    // 🚨 COMPREHENSIVE: Track all email events
    async trackEmailSent(emailData) {
        try {
            console.log(`📊 Tracking email sent: ${emailData.senderEmail} → ${emailData.receiverEmail}`);

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

            // Also track in EmailExchange for bidirectional tracking
            await EmailExchange.create({
                warmupAccount: validatedData.direction === 'WARMUP_TO_POOL' ? validatedData.senderEmail : validatedData.receiverEmail,
                poolAccount: validatedData.direction === 'WARMUP_TO_POOL' ? validatedData.receiverEmail : validatedData.senderEmail,
                direction: validatedData.direction,
                messageId: validatedData.messageId,
                status: 'sent',
                sentAt: new Date()
            });

            console.log(`✅ Email sent tracked: ${validatedData.messageId}`);
            return emailMetric;

        } catch (error) {
            console.error('❌ Error tracking email sent:', error.message);
            return null;
        }
    }

    // 🚨 ENHANCED: Track email delivery with spam detection
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
                // Update EmailExchange as well
                await EmailExchange.update({
                    status: 'delivered',
                    deliveredAt: new Date()
                }, {
                    where: { messageId }
                });

                // Track spam placement if applicable
                if (deliveryData.deliveryFolder && this.isSpamFolder(deliveryData.deliveryFolder)) {
                    await this.trackSpamPlacement(messageId, deliveryData);
                }

                console.log(`✅ Email delivery tracked: ${messageId} in ${deliveryData.deliveryFolder}`);
                return true;
            } else {
                console.log(`⚠️ Email not found for delivery tracking: ${messageId}`);
                return false;
            }
        } catch (error) {
            console.error('❌ Error tracking email delivery:', error.message);
            return false;
        }
    }

    // 🚨 ENHANCED: Track bounce with comprehensive analysis
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

                    // Update EmailExchange
                    await EmailExchange.update({
                        status: 'failed',
                        error: bounceData.bounceReason
                    }, {
                        where: { messageId }
                    });

                    console.log(`✅ Email bounce tracked: ${messageId} - ${bounceData.bounceType}`);
                    return true;
                }
            }

            console.log(`⚠️ Email not found for bounce tracking: ${messageId}`);
            return false;
        } catch (error) {
            console.error('❌ Error tracking email bounce:', error.message);
            return false;
        }
    }

    // 🚨 COMPREHENSIVE: Track engagement (opens and clicks)
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

            const isFirstOpen = !engagement || !engagement.opened;

            if (engagement) {
                await engagement.update({
                    opened: true,
                    lastOpenedAt: new Date(),
                    openCount: (engagement.openCount || 0) + 1,
                    uniqueOpens: engagementData.isUnique ? (engagement.uniqueOpens || 0) + 1 : engagement.uniqueOpens,
                    userAgent: engagementData.userAgent || engagement.userAgent,
                    ipAddress: engagementData.ipAddress || engagement.ipAddress,
                    platform: engagementData.platform || engagement.platform,
                    clientType: engagementData.clientType || engagement.clientType
                });
            } else {
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

            console.log(`✅ Email open tracked: ${messageId} - ${isFirstOpen ? 'FIRST' : 'REPEAT'} open`);
            return true;
        } catch (error) {
            console.error('❌ Error tracking email open:', error.message);
            return false;
        }
    }

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

            const isFirstClick = !engagement || !engagement.clicked;

            if (engagement) {
                await engagement.update({
                    clicked: true,
                    lastClickedAt: new Date(),
                    clickCount: (engagement.clickCount || 0) + 1,
                    uniqueClicks: clickData.isUnique ? (engagement.uniqueClicks || 0) + 1 : engagement.uniqueClicks
                });
            } else {
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

            console.log(`✅ Email click tracked: ${messageId} - ${isFirstClick ? 'FIRST' : 'REPEAT'} click`);
            return true;
        } catch (error) {
            console.error('❌ Error tracking email click:', error.message);
            return false;
        }
    }

    // 🚨 ENHANCED: Track spam with comprehensive analysis
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
                feedbackLoopId: complaintData.feedbackLoopId,
                folder: complaintData.folder,
                resolved: complaintData.resolved || false,
                resolvedAt: complaintData.resolvedAt,
                resolutionNotes: complaintData.resolutionNotes
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
            return false;
        }
    }

    // 🚨 NEW: Track spam folder placement
    async trackSpamPlacement(messageId, placementData = {}) {
        try {
            const emailMetric = await EmailMetric.findOne({ where: { messageId } });

            if (!emailMetric) {
                console.log(`⚠️ Email not found for spam placement tracking: ${messageId}`);
                return false;
            }

            await this.trackSpamComplaint(messageId, {
                complaintType: 'automated_filter',
                complaintSource: 'ISP_FILTER',
                complaintFeedback: `Automatically placed in ${placementData.deliveryFolder} folder by email provider`,
                reportingIsp: this.detectISP(emailMetric.receiverEmail),
                folder: placementData.deliveryFolder,
                resolved: placementData.movedToInbox || false,
                resolvedAt: placementData.movedToInbox ? new Date() : null,
                resolutionNotes: placementData.movedToInbox ? 'Moved from spam to inbox' : null
            });

            console.log(`✅ Spam placement tracked: ${messageId} in ${placementData.deliveryFolder}`);
            return true;
        } catch (error) {
            console.error('❌ Error tracking spam placement:', error.message);
            return false;
        }
    }

    // 🚨 ENHANCED: Track replies with thread management
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

            const responseTime = replyData.repliedAt ?
                Math.round((replyData.repliedAt - originalEmail.sentAt) / (1000 * 60)) : 0;

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
                responseTime: responseTime,
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
            return false;
        }
    }

    // Utility methods
    validateAndCompleteEmailData(emailData) {
        const validated = { ...emailData };

        if (!validated.messageId) {
            validated.messageId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        if (!validated.senderType) {
            validated.senderType = this.determineSenderType(validated.senderEmail, validated);
        }

        if (!validated.receiverType) {
            validated.receiverType = this.determineReceiverType(validated.receiverEmail, validated);
        }

        if (!validated.senderEmail) throw new Error('senderEmail is required');
        if (!validated.receiverEmail) throw new Error('receiverEmail is required');

        return validated;
    }

    determineSenderType(senderEmail, emailData) {
        if (emailData.direction === 'POOL_TO_WARMUP') return 'pool';
        if (emailData.direction === 'WARMUP_TO_POOL') return emailData.senderType || 'warmup';
        if (emailData.emailType === 'pool_send') return 'pool';

        if (senderEmail.includes('@gmail.com') || senderEmail.includes('@googlemail.com')) return 'google';
        if (senderEmail.includes('@outlook.com') || senderEmail.includes('@hotmail.com')) return 'microsoft';
        if (emailData.smtpConfig || emailData.smtp_host) return 'smtp';

        return 'unknown';
    }

    determineReceiverType(receiverEmail, emailData) {
        if (emailData.direction === 'WARMUP_TO_POOL') return 'pool';
        if (emailData.direction === 'POOL_TO_WARMUP') return 'warmup';
        if (emailData.emailType === 'warmup_receive') return 'warmup';

        if (receiverEmail.includes('@gmail.com') || receiverEmail.includes('@googlemail.com')) return 'google';
        if (receiverEmail.includes('@outlook.com') || receiverEmail.includes('@hotmail.com')) return 'microsoft';

        return 'unknown';
    }

    isSpamFolder(folderName) {
        if (!folderName) return false;
        const spamIndicators = ['spam', 'junk', 'bulk', 'trash'];
        const folderLower = folderName.toLowerCase();
        return spamIndicators.some(indicator => folderLower.includes(indicator));
    }

    detectISP(email) {
        if (!email) return 'unknown';
        const domain = email.split('@')[1]?.toLowerCase();
        if (!domain) return 'unknown';

        const ispMap = {
            'gmail.com': 'Google',
            'googlemail.com': 'Google',
            'outlook.com': 'Microsoft',
            'hotmail.com': 'Microsoft',
            'live.com': 'Microsoft',
            'yahoo.com': 'Yahoo',
            'aol.com': 'AOL',
            'icloud.com': 'Apple'
        };

        return ispMap[domain] || domain;
    }

    // 🚨 NEW: Get comprehensive analytics
    async getEmailAnalytics(email, days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const metrics = await EmailMetric.findAll({
                where: {
                    senderEmail: email,
                    sentAt: { [Op.gte]: startDate }
                },
                include: [
                    { model: BounceTracking, required: false },
                    { model: EngagementTracking, required: false },
                    { model: SpamComplaint, required: false },
                    { model: ReplyTracking, as: 'Replies', required: false }
                ]
            });

            const analytics = {
                totalSent: metrics.length,
                delivered: metrics.filter(m => m.status === 'delivered').length,
                bounced: metrics.filter(m => m.status === 'bounced').length,
                opened: metrics.filter(m => m.EngagementTracking?.opened).length,
                clicked: metrics.filter(m => m.EngagementTracking?.clicked).length,
                replied: metrics.filter(m => m.replied).length,
                spam: metrics.filter(m => m.spamReported).length,
                deliveryRate: 0,
                openRate: 0,
                clickRate: 0,
                replyRate: 0,
                spamRate: 0
            };

            if (analytics.totalSent > 0) {
                analytics.deliveryRate = (analytics.delivered / analytics.totalSent) * 100;
                analytics.openRate = (analytics.opened / analytics.totalSent) * 100;
                analytics.clickRate = (analytics.clicked / analytics.totalSent) * 100;
                analytics.replyRate = (analytics.replied / analytics.totalSent) * 100;
                analytics.spamRate = (analytics.spam / analytics.totalSent) * 100;
            }

            return analytics;
        } catch (error) {
            console.error('❌ Error getting email analytics:', error);
            return null;
        }
    }
}

const trackingService = new TrackingService();
module.exports = trackingService;