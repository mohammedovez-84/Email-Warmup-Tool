const EmailMetric = require('../../models/EmailMetric');
const BounceTracking = require('../../models/BounceTracking');
const EngagementTracking = require('../../models/EngagementTracking');
const SpamComplaint = require('../../models/SpamComplaint'); // 🚨 Use SpamComplaint for actual complaints
const SpamAnalysis = require('../../models/SpamAnalysis'); // 🚨 Use SpamAnalysis for predictive analysis
const ReplyTracking = require('../../models/ReplyTracking');
const EmailExchange = require('../../models/MailExchange');
const { Op } = require("sequelize");

class TrackingService {
    constructor() {
        // No spam detection service - we'll handle it directly
    }

    // 🚨 ENHANCED: Track email sends with proper model usage
    async trackEmailSent(emailData) {
        try {
            console.log(`📊 TRACKING: ${emailData.senderEmail} → ${emailData.receiverEmail}`);

            const validatedData = this.validateAndCompleteEmailData(emailData);

            // Track in EmailMetric
            const emailMetric = await EmailMetric.create({
                senderEmail: validatedData.senderEmail,
                senderType: validatedData.senderType,
                senderDomain: this.getDomain(validatedData.senderEmail),
                receiverEmail: validatedData.receiverEmail,
                receiverType: validatedData.receiverType,
                receiverDomain: this.getDomain(validatedData.receiverEmail),
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
                crossDomain: this.isCrossDomain(validatedData.senderEmail, validatedData.receiverEmail),
                domainPair: `${this.getDomain(validatedData.senderEmail)}-${this.getDomain(validatedData.receiverEmail)}`
            });

            // Track in EmailExchange for bidirectional tracking
            await EmailExchange.create({
                warmupAccount: validatedData.direction === 'WARMUP_TO_POOL' ? validatedData.senderEmail : validatedData.receiverEmail,
                poolAccount: validatedData.direction === 'WARMUP_TO_POOL' ? validatedData.receiverEmail : validatedData.senderEmail,
                direction: validatedData.direction,
                messageId: validatedData.messageId,
                status: 'sent',
                sentAt: new Date(),
                crossDomain: this.isCrossDomain(validatedData.senderEmail, validatedData.receiverEmail)
            });

            console.log(`✅ EMAIL TRACKED: ${validatedData.messageId}`);
            return emailMetric;

        } catch (error) {
            console.error('❌ Email tracking error:', error.message);
            return null;
        }
    }

    // 🚨 NEW: Track email open with pixel tracking
    async trackEmailOpen(messageId, openData = {}) {
        try {
            if (!messageId) {
                console.log('⚠️ No messageId for open tracking');
                return false;
            }

            const emailMetric = await EmailMetric.findOne({ where: { messageId } });

            if (!emailMetric) {
                console.log(`⚠️ Email not found for open tracking: ${messageId}`);
                return false;
            }

            let engagement = await EngagementTracking.findOne({
                where: { messageId: messageId }
            });

            const isFirstOpen = !engagement || !engagement.opened;

            if (engagement) {
                // Update existing engagement
                await engagement.update({
                    opened: true,
                    lastOpenedAt: new Date(),
                    openCount: (engagement.openCount || 0) + 1,
                    uniqueOpens: openData.isUnique ? (engagement.uniqueOpens || 0) + 1 : engagement.uniqueOpens,
                    userAgent: openData.userAgent || engagement.userAgent,
                    ipAddress: openData.ipAddress || engagement.ipAddress,
                    platform: openData.platform || engagement.platform,
                    clientType: openData.clientType || engagement.clientType
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
                    uniqueOpens: openData.isUnique ? 1 : 0,
                    userAgent: openData.userAgent,
                    ipAddress: openData.ipAddress,
                    platform: openData.platform,
                    clientType: openData.clientType
                });
            }

            // Update EmailMetric with open status
            await EmailMetric.update({
                opened: true,
                firstOpenedAt: engagement.firstOpenedAt,
                lastOpenedAt: engagement.lastOpenedAt,
                openCount: engagement.openCount
            }, {
                where: { messageId }
            });

            console.log(`✅ EMAIL OPENED: ${messageId} - ${isFirstOpen ? 'FIRST' : 'REPEAT'} open (count: ${engagement.openCount})`);
            return true;

        } catch (error) {
            console.error('❌ Open tracking error:', error.message);
            return false;
        }
    }

    // 🚨 NEW: Generate open tracking pixel URL
    generateOpenTrackingPixel(messageId) {
        // This URL should be embedded in emails as a 1x1 transparent pixel
        const trackingUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/tracking/open/${messageId}`;

        return `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="Open Tracking Pixel" />`;
    }

    // 🚨 NEW: Track email delivery
    async trackEmailDelivered(messageId, deliveryData = {}) {
        try {
            if (!messageId) {
                console.log('⚠️ No messageId for delivery tracking');
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
                // Update EmailExchange
                await EmailExchange.update({
                    status: 'delivered',
                    deliveredAt: new Date()
                }, {
                    where: { messageId }
                });

                console.log(`✅ EMAIL DELIVERED: ${messageId} in ${deliveryData.deliveryFolder}`);
                return true;
            }

            return false;

        } catch (error) {
            console.error('❌ Delivery tracking error:', error.message);
            return false;
        }
    }

    // 🚨 NEW: Track spam complaint (using SpamComplaint model)
    async trackSpamComplaint(messageId, complaintData = {}) {
        try {
            if (!messageId) {
                console.log('⚠️ No messageId for spam complaint tracking');
                return false;
            }

            const emailMetric = await EmailMetric.findOne({ where: { messageId } });

            if (!emailMetric) {
                console.log(`⚠️ Email not found for spam complaint: ${messageId}`);
                return false;
            }

            // Create spam complaint record
            await SpamComplaint.create({
                emailMetricId: emailMetric.id,
                senderEmail: emailMetric.senderEmail,
                receiverEmail: emailMetric.receiverEmail,
                messageId: messageId,
                complaintType: complaintData.complaintType || 'user_complaint',
                complaintSource: complaintData.complaintSource || 'unknown',
                complaintFeedback: complaintData.complaintFeedback,
                reportingIsp: complaintData.reportingIsp || this.detectISP(emailMetric.receiverEmail),
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

            console.log(`⚠️ SPAM COMPLAINT: ${messageId}`);
            return true;

        } catch (error) {
            console.error('❌ Spam complaint tracking error:', error.message);
            return false;
        }
    }

    // 🚨 NEW: Create spam analysis (using SpamAnalysis model)
    async createSpamAnalysis(messageId, analysisData = {}) {
        try {
            const emailMetric = await EmailMetric.findOne({ where: { messageId } });

            if (!emailMetric) {
                console.log(`⚠️ Email not found for spam analysis: ${messageId}`);
                return false;
            }

            // Create spam analysis record
            await SpamAnalysis.create({
                messageId: messageId,
                senderEmail: emailMetric.senderEmail,
                receiverEmail: emailMetric.receiverEmail,
                riskScore: analysisData.riskScore || 0,
                riskLevel: analysisData.riskLevel || 'low',
                warnings: analysisData.warnings || [],
                recommendations: analysisData.recommendations || [],
                contentAnalysis: analysisData.contentAnalysis,
                senderReputation: analysisData.senderReputation,
                technicalFactors: analysisData.technicalFactors,
                engagementPatterns: analysisData.engagementPatterns,
                deliveryFolder: analysisData.deliveryFolder,
                deliveredInbox: analysisData.deliveredInbox,
                analyzedAt: new Date()
            });

            console.log(`🔍 SPAM ANALYSIS: ${messageId} - ${analysisData.riskLevel} risk`);
            return true;

        } catch (error) {
            console.error('❌ Spam analysis creation error:', error.message);
            return false;
        }
    }

    // 🚨 NEW: Track replies (using ReplyTracking model)
    async trackReply(originalMessageId, replyData = {}) {
        try {
            if (!originalMessageId) {
                console.log('⚠️ No originalMessageId for reply tracking');
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

            // Create reply tracking record
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
                replyQuality: replyData.replyQuality || 'medium'
            });

            // Update original email metric
            await EmailMetric.update({
                replied: true,
                repliedAt: replyData.repliedAt || new Date(),
                replyMessageId: replyData.replyMessageId || `reply-${originalMessageId}`
            }, {
                where: { messageId: originalMessageId }
            });

            console.log(`✅ REPLY TRACKED: ${originalMessageId} → ${replyData.replyMessageId || 'unknown'}`);
            return true;

        } catch (error) {
            console.error('❌ Reply tracking error:', error.message);
            return false;
        }
    }

    // 🚨 NEW: Track bounces
    async trackEmailBounce(messageId, bounceData = {}) {
        try {
            if (!messageId) return false;

            const [affectedRows] = await EmailMetric.update({
                status: 'bounced',
                bouncedAt: new Date()
            }, {
                where: { messageId }
            });

            if (affectedRows > 0) {
                const emailMetric = await EmailMetric.findOne({ where: { messageId } });

                if (emailMetric) {
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
                        isp: bounceData.isp || this.detectISP(emailMetric.receiverEmail),
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

                    console.log(`✅ BOUNCE TRACKED: ${messageId} - ${bounceData.bounceType}`);
                    return true;
                }
            }

            return false;

        } catch (error) {
            console.error('❌ Bounce tracking error:', error.message);
            return false;
        }
    }

    // 🚨 NEW: Calculate open rates
    async calculateOpenRate(senderEmail, days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const metrics = await EmailMetric.findAll({
                where: {
                    senderEmail: senderEmail,
                    sentAt: { [Op.gte]: startDate },
                    status: 'delivered'
                },
                include: [{
                    model: EngagementTracking,
                    required: false
                }]
            });

            const totalDelivered = metrics.length;
            const openedEmails = metrics.filter(metric =>
                metric.EngagementTracking && metric.EngagementTracking.opened
            ).length;

            const openRate = totalDelivered > 0 ? (openedEmails / totalDelivered) * 100 : 0;

            console.log(`📊 OPEN RATE: ${senderEmail} - ${openedEmails}/${totalDelivered} (${openRate.toFixed(1)}%)`);

            return {
                openRate: parseFloat(openRate.toFixed(2)),
                openedEmails: openedEmails,
                totalDelivered: totalDelivered,
                period: `${days} days`
            };

        } catch (error) {
            console.error('❌ Open rate calculation error:', error);
            return { openRate: 0, openedEmails: 0, totalDelivered: 0, period: `${days} days` };
        }
    }

    // 🚨 NEW: Get comprehensive analytics
    async getEmailAnalytics(senderEmail, days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const metrics = await EmailMetric.findAll({
                where: {
                    senderEmail: senderEmail,
                    sentAt: { [Op.gte]: startDate }
                },
                include: [
                    { model: BounceTracking, required: false },
                    { model: EngagementTracking, required: false },
                    { model: SpamComplaint, required: false },
                    { model: ReplyTracking, as: 'sentReplies', required: false }
                ]
            });

            const totalSent = metrics.length;
            const delivered = metrics.filter(m => m.status === 'delivered').length;
            const bounced = metrics.filter(m => m.status === 'bounced').length;
            const opened = metrics.filter(m => m.EngagementTracking?.opened).length;
            const replied = metrics.filter(m => m.replied).length;
            const spam = metrics.filter(m => m.spamReported).length;

            const analytics = {
                totalSent: totalSent,
                delivered: delivered,
                bounced: bounced,
                opened: opened,
                replied: replied,
                spam: spam,
                deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
                openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
                replyRate: delivered > 0 ? (replied / delivered) * 100 : 0,
                spamRate: totalSent > 0 ? (spam / totalSent) * 100 : 0,
                period: `${days} days`,
                generatedAt: new Date().toISOString()
            };

            // Round percentages
            analytics.deliveryRate = parseFloat(analytics.deliveryRate.toFixed(2));
            analytics.openRate = parseFloat(analytics.openRate.toFixed(2));
            analytics.replyRate = parseFloat(analytics.replyRate.toFixed(2));
            analytics.spamRate = parseFloat(analytics.spamRate.toFixed(2));

            console.log(`📈 ANALYTICS: ${senderEmail} - Delivery: ${analytics.deliveryRate}%, Open: ${analytics.openRate}%, Reply: ${analytics.replyRate}%`);

            return analytics;

        } catch (error) {
            console.error('❌ Analytics error:', error);
            return this.getFallbackAnalytics();
        }
    }

    // Utility methods
    getDomain(email) {
        return email.split('@')[1]?.toLowerCase() || 'unknown';
    }

    isCrossDomain(senderEmail, receiverEmail) {
        const senderDomain = this.getDomain(senderEmail);
        const receiverDomain = this.getDomain(receiverEmail);
        return senderDomain !== receiverDomain;
    }

    detectISP(email) {
        if (!email) return 'unknown';
        const domain = this.getDomain(email);

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

    validateAndCompleteEmailData(emailData) {
        const validated = { ...emailData };

        if (!validated.messageId) {
            validated.messageId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        if (!validated.senderType) {
            validated.senderType = this.determineSenderType(validated.senderEmail, validated);
        }

        if (!validated.receiverType) {
            validated.receiverType = this.determineReceiverType(validated.receiverEmail, validated);
        }

        return validated;
    }

    determineSenderType(senderEmail, emailData) {
        if (emailData.direction === 'POOL_TO_WARMUP') return 'pool';
        if (emailData.direction === 'WARMUP_TO_POOL') return emailData.senderType || 'warmup';
        return 'unknown';
    }

    determineReceiverType(receiverEmail, emailData) {
        if (emailData.direction === 'WARMUP_TO_POOL') return 'pool';
        if (emailData.direction === 'POOL_TO_WARMUP') return 'warmup';
        return 'unknown';
    }

    getFallbackAnalytics() {
        return {
            totalSent: 0,
            delivered: 0,
            bounced: 0,
            opened: 0,
            replied: 0,
            spam: 0,
            deliveryRate: 0,
            openRate: 0,
            replyRate: 0,
            spamRate: 0,
            period: '7 days',
            generatedAt: new Date().toISOString()
        };
    }


    async trackCrossDomainSpam(spamData) {
        try {
            console.log(`🔍 TRACKING CROSS-DOMAIN SPAM: ${spamData.senderProvider} → ${spamData.receiverProvider}`);

            // Create spam analysis record for cross-domain pattern
            await SpamAnalysis.create({
                senderEmail: spamData.senderEmail,
                receiverEmail: spamData.receiverEmail,
                messageId: spamData.messageId || `cross-domain-${Date.now()}`,
                riskScore: this.calculateCrossDomainRisk(spamData),
                riskLevel: this.determineCrossDomainRiskLevel(spamData),
                warnings: this.generateCrossDomainWarnings(spamData),
                recommendations: this.generateCrossDomainRecommendations(spamData),
                contentAnalysis: {
                    senderProvider: spamData.senderProvider,
                    receiverProvider: spamData.receiverProvider,
                    communicationType: spamData.communicationType,
                    folder: spamData.folder,
                    direction: spamData.direction,
                    warmupDay: spamData.warmupDay
                },
                senderReputation: this.assessSenderReputation(spamData.senderProvider),
                technicalFactors: {
                    crossDomain: true,
                    providerPair: `${spamData.senderProvider}_TO_${spamData.receiverProvider}`,
                    spamRisk: spamData.spamRisk || 'unknown'
                },
                deliveryFolder: spamData.folder,
                deliveredInbox: false,
                analyzedAt: new Date(),
                analysisType: 'cross_domain_pattern'
            });

            // Also track as a spam complaint for analytics
            await this.trackSpamComplaint(spamData.messageId, {
                complaintType: 'automated_filter',
                complaintSource: 'ISP_FILTER',
                complaintFeedback: `Cross-domain spam placement: ${spamData.senderProvider} → ${spamData.receiverProvider} in ${spamData.folder}`,
                reportingIsp: this.detectISP(spamData.receiverEmail),
                folder: spamData.folder,
                resolved: false
            });

            console.log(`✅ CROSS-DOMAIN SPAM TRACKED: ${spamData.communicationType} in ${spamData.folder}`);
            return true;

        } catch (error) {
            console.error('❌ Cross-domain spam tracking error:', error);
            return false;
        }
    }

    // 🚨 NEW: Track cross-domain failures
    async trackCrossDomainFailure(failureData) {
        try {
            console.log(`❌ TRACKING CROSS-DOMAIN FAILURE: ${failureData.senderProvider} → ${failureData.receiverProvider}`);

            // Create a bounce record for cross-domain failure analysis
            await BounceTracking.create({
                senderEmail: failureData.senderEmail,
                receiverEmail: failureData.receiverEmail,
                messageId: failureData.messageId || `failure-${Date.now()}`,
                bounceType: 'cross_domain_failure',
                bounceCategory: 'transient',
                bounceReason: `Cross-domain communication failure: ${failureData.error}`,
                isp: failureData.receiverProvider,
                canRetry: true,
                crossDomainData: {
                    senderProvider: failureData.senderProvider,
                    receiverProvider: failureData.receiverProvider,
                    direction: failureData.direction,
                    timestamp: failureData.timestamp
                }
            });

            console.log(`✅ CROSS-DOMAIN FAILURE TRACKED: ${failureData.senderProvider} → ${failureData.receiverProvider}`);
            return true;

        } catch (error) {
            console.error('❌ Cross-domain failure tracking error:', error);
            return false;
        }
    }

    // 🚨 NEW: Track volume adjustments for provider pairs
    async trackVolumeAdjustment(adjustmentData) {
        try {
            console.log(`📊 TRACKING VOLUME ADJUSTMENT: ${adjustmentData.senderEmail} → ${adjustmentData.receiverProvider}`);

            // You might want to create a new model for this or use an existing one
            // For now, we'll log it and potentially store in EmailMetric or a new table
            await EmailMetric.create({
                senderEmail: adjustmentData.senderEmail,
                receiverEmail: `provider:${adjustmentData.receiverProvider}`, // Synthetic receiver
                messageId: `volume-adjust-${Date.now()}`,
                subject: `Volume Adjustment: ${adjustmentData.action}`,
                status: 'system_event',
                sentAt: adjustmentData.timestamp,
                emailType: 'volume_adjustment',
                direction: 'SYSTEM',
                systemData: {
                    action: adjustmentData.action,
                    receiverProvider: adjustmentData.receiverProvider,
                    type: 'volume_adjustment'
                }
            });

            console.log(`✅ VOLUME ADJUSTMENT TRACKED: ${adjustmentData.senderEmail} → ${adjustmentData.receiverProvider} - ${adjustmentData.action}`);
            return true;

        } catch (error) {
            console.error('❌ Volume adjustment tracking error:', error);
            return false;
        }
    }

    // 🚨 NEW: Track provider pair pauses
    async trackProviderPairPause(pauseData) {
        try {
            console.log(`⏸️ TRACKING PROVIDER PAIR PAUSE: ${pauseData.senderEmail} → ${pauseData.receiverProvider}`);

            await EmailMetric.create({
                senderEmail: pauseData.senderEmail,
                receiverEmail: `provider:${pauseData.receiverProvider}`,
                messageId: `pause-${Date.now()}`,
                subject: `Provider Pair Paused`,
                status: 'system_event',
                sentAt: pauseData.pausedAt,
                emailType: 'provider_pause',
                direction: 'SYSTEM',
                systemData: {
                    action: 'pause',
                    receiverProvider: pauseData.receiverProvider,
                    resumeAfter: pauseData.resumeAfter,
                    type: 'provider_pause'
                }
            });

            console.log(`✅ PROVIDER PAIR PAUSE TRACKED: ${pauseData.senderEmail} → ${pauseData.receiverProvider}`);
            return true;

        } catch (error) {
            console.error('❌ Provider pair pause tracking error:', error);
            return false;
        }
    }

    // 🚨 NEW: Get cross-domain performance analytics
    async getCrossDomainAnalytics(senderEmail, days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const metrics = await EmailMetric.findAll({
                where: {
                    senderEmail: senderEmail,
                    sentAt: { [Op.gte]: startDate },
                    crossDomain: true
                },
                include: [
                    { model: BounceTracking, required: false },
                    { model: EngagementTracking, required: false },
                    { model: SpamComplaint, required: false }
                ]
            });

            // Group by domain pairs
            const domainPerformance = {};

            metrics.forEach(metric => {
                const domainPair = metric.domainPair;
                if (!domainPerformance[domainPair]) {
                    domainPerformance[domainPair] = {
                        totalSent: 0,
                        delivered: 0,
                        opened: 0,
                        replied: 0,
                        spam: 0,
                        bounced: 0
                    };
                }

                domainPerformance[domainPair].totalSent++;

                if (metric.status === 'delivered') {
                    domainPerformance[domainPair].delivered++;
                }
                if (metric.status === 'bounced') {
                    domainPerformance[domainPair].bounced++;
                }
                if (metric.EngagementTracking?.opened) {
                    domainPerformance[domainPair].opened++;
                }
                if (metric.replied) {
                    domainPerformance[domainPair].replied++;
                }
                if (metric.spamReported) {
                    domainPerformance[domainPair].spam++;
                }
            });

            // Calculate rates
            Object.keys(domainPerformance).forEach(domainPair => {
                const data = domainPerformance[domainPair];
                data.deliveryRate = data.totalSent > 0 ? (data.delivered / data.totalSent) * 100 : 0;
                data.openRate = data.delivered > 0 ? (data.opened / data.delivered) * 100 : 0;
                data.replyRate = data.delivered > 0 ? (data.replied / data.delivered) * 100 : 0;
                data.spamRate = data.totalSent > 0 ? (data.spam / data.totalSent) * 100 : 0;

                // Round percentages
                data.deliveryRate = parseFloat(data.deliveryRate.toFixed(2));
                data.openRate = parseFloat(data.openRate.toFixed(2));
                data.replyRate = parseFloat(data.replyRate.toFixed(2));
                data.spamRate = parseFloat(data.spamRate.toFixed(2));
            });

            console.log(`📈 CROSS-DOMAIN ANALYTICS: ${senderEmail} - ${Object.keys(domainPerformance).length} domain pairs`);

            return {
                domainPerformance,
                period: `${days} days`,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Cross-domain analytics error:', error);
            return { domainPerformance: {}, period: `${days} days`, generatedAt: new Date().toISOString() };
        }
    }

    // 🚨 NEW: Get provider pair spam history
    async getProviderPairSpamHistory(senderEmail, receiverProvider, hours = 24) {
        try {
            const startDate = new Date();
            startDate.setHours(startDate.getHours() - hours);

            const spamRecords = await SpamAnalysis.findAll({
                where: {
                    senderEmail: senderEmail,
                    analyzedAt: { [Op.gte]: startDate }
                }
            });

            // Filter by receiver provider pattern
            const relevantSpam = spamRecords.filter(record => {
                const content = record.contentAnalysis || {};
                return content.receiverProvider === receiverProvider ||
                    record.technicalFactors?.providerPair?.includes(receiverProvider);
            });

            // Calculate consecutive spam
            let consecutiveCount = 0;
            let maxConsecutive = 0;
            let currentConsecutive = 0;

            relevantSpam.sort((a, b) => new Date(a.analyzedAt) - new Date(b.analyzedAt))
                .forEach(record => {
                    if (record.riskLevel === 'high' || record.riskLevel === 'medium') {
                        currentConsecutive++;
                        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
                    } else {
                        currentConsecutive = 0;
                    }
                });

            consecutiveCount = maxConsecutive;

            return {
                consecutiveCount: consecutiveCount,
                totalCount: relevantSpam.length,
                spamRate: relevantSpam.length > 0 ? (relevantSpam.length / spamRecords.length) * 100 : 0,
                lastSpamTime: relevantSpam.length > 0 ? relevantSpam[relevantSpam.length - 1].analyzedAt : null
            };

        } catch (error) {
            console.error('❌ Provider pair spam history error:', error);
            return { consecutiveCount: 0, totalCount: 0, spamRate: 0, lastSpamTime: null };
        }
    }

    // 🚨 NEW: Helper methods for cross-domain risk assessment
    calculateCrossDomainRisk(spamData) {
        let riskScore = 50; // Base score

        // Adjust based on provider combinations
        const providerRisk = {
            'GMAIL_PERSONAL_TO_OUTLOOK_PERSONAL': 30,
            'OUTLOOK_PERSONAL_TO_GMAIL_PERSONAL': 35,
            'MICROSOFT_ORGANIZATIONAL_TO_GMAIL_PERSONAL': 25,
            'GMAIL_PERSONAL_TO_MICROSOFT_ORGANIZATIONAL': 40,
            'CUSTOM_SMTP_TO_GMAIL_PERSONAL': 60,
            'CUSTOM_SMTP_TO_OUTLOOK_PERSONAL': 55
        };

        const pairKey = `${spamData.senderProvider}_TO_${spamData.receiverProvider}`;
        if (providerRisk[pairKey]) {
            riskScore += providerRisk[pairKey];
        }

        // Adjust based on spam folder
        if (spamData.folder === 'SPAM' || spamData.folder === 'JUNK') {
            riskScore += 20;
        } else if (spamData.folder.includes('BULK')) {
            riskScore += 10;
        }

        // Adjust based on warmup day
        if (spamData.warmupDay <= 2) {
            riskScore += 15; // Higher risk early in warmup
        }

        return Math.min(riskScore, 100);
    }

    determineCrossDomainRiskLevel(spamData) {
        const riskScore = this.calculateCrossDomainRisk(spamData);

        if (riskScore >= 80) return 'high';
        if (riskScore >= 60) return 'medium';
        if (riskScore >= 40) return 'low';
        return 'very_low';
    }

    generateCrossDomainWarnings(spamData) {
        const warnings = [];
        const pairKey = `${spamData.senderProvider}_TO_${spamData.receiverProvider}`;

        if (spamData.warmupDay <= 2) {
            warnings.push('Early warmup stage - high sensitivity to spam filters');
        }

        if (spamData.senderProvider === 'CUSTOM_SMTP') {
            warnings.push('Custom domain sending - ensure proper DNS records');
        }

        if (pairKey.includes('CUSTOM_SMTP')) {
            warnings.push('Cross-domain custom SMTP communication - monitor closely');
        }

        return warnings;
    }

    generateCrossDomainRecommendations(spamData) {
        const recommendations = [];

        if (spamData.warmupDay <= 2) {
            recommendations.push('Reduce sending volume temporarily');
            recommendations.push('Focus on same-domain communications initially');
        }

        if (spamData.spamRisk === 'high') {
            recommendations.push('Pause communications to this provider for 24 hours');
            recommendations.push('Review email content and authentication');
        }

        if (spamData.senderProvider === 'CUSTOM_SMTP') {
            recommendations.push('Verify SPF, DKIM, and DMARC records');
            recommendations.push('Check domain reputation');
        }

        return recommendations;
    }

    assessSenderReputation(providerType) {
        const reputationScores = {
            'GMAIL_PERSONAL': 'high',
            'GSUITE_ORGANIZATIONAL': 'high',
            'OUTLOOK_PERSONAL': 'high',
            'MICROSOFT_ORGANIZATIONAL': 'high',
            'CUSTOM_SMTP': 'variable'
        };

        return reputationScores[providerType] || 'unknown';
    }
}

const trackingService = new TrackingService();
module.exports = trackingService;