const EmailMetric = require("../../models/EmailMetric");
const EngagementTracking = require("../../models/EngagementTracking");
const SpamAnalysis = require("../../models/SpamAnalysis");
const { Op } = require("sequelize");

class SpamDetectionService {
    constructor(sequelize) {
        this.sequelize = sequelize;
    }

    async analyzeCrossDomainDelivery(messageId, senderDomain, receiverDomain, deliveryData) {
        const factors = {
            score: 0,
            warnings: [],
            recommendations: [],
            riskLevel: 'low',
            crossDomain: true,
            domainPair: `${senderDomain}-${receiverDomain}`
        };

        // Domain reputation check
        const domainReputation = await this.analyzeDomainReputation(senderDomain, receiverDomain);
        factors.score += domainReputation.score;
        factors.warnings.push(...domainReputation.warnings);

        // Cross-domain pattern analysis
        const patternAnalysis = await this.analyzeCrossDomainPatterns(senderDomain, receiverDomain);
        factors.score += patternAnalysis.score;
        factors.warnings.push(...patternAnalysis.warnings);

        // Delivery folder analysis
        if (deliveryData.deliveryFolder && this.isSpamFolder(deliveryData.deliveryFolder)) {
            factors.score += 5;
            factors.warnings.push(`Email delivered to spam folder: ${deliveryData.deliveryFolder}`);
        }

        // Calculate overall risk
        factors.riskLevel = this.calculateRiskLevel(factors.score);

        // Cross-domain specific recommendations
        if (factors.riskLevel === 'high' || factors.riskLevel === 'critical') {
            factors.recommendations.push(
                'Consider warming up this domain pair more gradually',
                'Review authentication records (SPF, DKIM, DMARC)',
                'Monitor engagement rates for this domain combination'
            );
        }

        console.log(`🔍 CROSS-DOMAIN ANALYSIS: ${senderDomain} → ${receiverDomain} - ${factors.riskLevel} risk`);

        return factors;
    }

    async analyzeDomainReputation(senderDomain, receiverDomain) {
        const analysis = {
            score: 0,
            warnings: []
        };

        // Check for known problematic domain combinations
        const problematicPairs = [
            'gmail.com-outlook.com',
            'outlook.com-gmail.com',
            'custom-domain-gmail.com',
            'custom-domain-outlook.com'
        ];

        const domainPair = `${senderDomain}-${receiverDomain}`;
        if (problematicPairs.includes(domainPair)) {
            analysis.score += 2;
            analysis.warnings.push(`Known challenging domain pair: ${domainPair}`);
        }

        // New domain sending to established domain
        if (this.isNewDomain(senderDomain) && this.isEstablishedDomain(receiverDomain)) {
            analysis.score += 3;
            analysis.warnings.push(`New domain ${senderDomain} sending to established domain ${receiverDomain}`);
        }

        return analysis;
    }

    async analyzeCrossDomainPatterns(senderDomain, receiverDomain) {
        const analysis = {
            score: 0,
            warnings: []
        };

        // Check sending volume patterns
        const volumeAnalysis = await this.analyzeCrossDomainVolume(senderDomain, receiverDomain);
        analysis.score += volumeAnalysis.score;
        analysis.warnings.push(...volumeAnalysis.warnings);

        // Check engagement patterns
        const engagementAnalysis = await this.analyzeCrossDomainEngagement(senderDomain, receiverDomain);
        analysis.score += engagementAnalysis.score;
        analysis.warnings.push(...engagementAnalysis.warnings);

        return analysis;
    }

    isNewDomain(domain) {
        // Implement logic to check if domain is new (recently created)
        // This could check domain age from WHOIS data
        return domain.includes('new') || domain.includes('test');
    }

    isEstablishedDomain(domain) {
        // Implement logic to check if domain is established
        const establishedDomains = ['gmail.com', 'outlook.com', 'yahoo.com', 'aol.com'];
        return establishedDomains.includes(domain);
    }
    async analyzeSpamFactors(messageId, emailData = {}) {
        try {
            const factors = {
                score: 0,
                warnings: [],
                recommendations: [],
                riskLevel: 'low',
                contentAnalysis: {},
                senderReputation: {},
                technicalFactors: {},
                engagementPatterns: {}
            };

            // 1. Content Analysis
            const contentAnalysis = await this.analyzeContent(emailData);
            factors.score += contentAnalysis.score;
            factors.warnings.push(...contentAnalysis.warnings);
            factors.contentAnalysis = contentAnalysis;

            // 2. Sender Reputation Analysis
            const senderAnalysis = await this.analyzeSenderReputation(emailData.senderEmail);
            factors.score += senderAnalysis.score;
            factors.warnings.push(...senderAnalysis.warnings);
            factors.senderReputation = senderAnalysis;

            // 3. Technical Analysis
            const technicalAnalysis = this.analyzeTechnicalFactors(emailData);
            factors.score += technicalAnalysis.score;
            factors.warnings.push(...technicalAnalysis.warnings);
            factors.technicalFactors = technicalAnalysis;

            // 4. Engagement Analysis (FIXED - with graceful fallback)
            const engagementAnalysis = await this.analyzeEngagementPatterns(emailData.senderEmail);
            factors.score += engagementAnalysis.score;
            factors.warnings.push(...engagementAnalysis.warnings);
            factors.engagementPatterns = engagementAnalysis;

            // Calculate overall risk level
            factors.riskLevel = this.calculateRiskLevel(factors.score);

            // Generate recommendations
            factors.recommendations = this.generateRecommendations(factors);

            // Store spam analysis
            await this.storeSpamAnalysis(messageId, emailData, factors);

            console.log(`🔍 Spam analysis for ${messageId}: ${factors.riskLevel} risk (score: ${factors.score})`);

            return factors;

        } catch (error) {
            console.error('❌ Error in spam analysis:', error);
            return {
                score: 0,
                warnings: ['Analysis failed'],
                recommendations: ['Check system configuration'],
                riskLevel: 'low'
            };
        }
    }

    async analyzeEngagementPatterns(senderEmail) {
        const analysis = {
            score: 0,
            warnings: [],
            metrics: {}
        };

        try {
            // 🚨 FIXED: Check if columns exist before querying
            const tableInfo = await this.checkEmailMetricsSchema();

            let emailMetrics;

            if (tableInfo.hasRepliedColumn) {
                // Use the full query with replied column
                emailMetrics = await EmailMetric.findAll({
                    where: { senderEmail: senderEmail },
                    attributes: ['messageId', 'sentAt', 'replied']
                });
            } else {
                // Fallback query without replied column
                console.log(`⚠️  Using fallback engagement analysis for ${senderEmail} (missing 'replied' column)`);
                emailMetrics = await EmailMetric.findAll({
                    where: { senderEmail: senderEmail },
                    attributes: ['messageId', 'sentAt']
                });

                // Mark all as not replied since we don't have the data
                emailMetrics.forEach(metric => metric.replied = false);
            }

            if (!emailMetrics || emailMetrics.length === 0) {
                analysis.score += 1;
                analysis.warnings.push('No engagement data available');
                analysis.metrics.noData = true;
                return analysis;
            }

            const messageIds = emailMetrics.map(metric => metric.messageId);

            // Get engagement data using separate query
            const engagementData = await EngagementTracking.findAll({
                where: {
                    messageId: {
                        [Op.in]: messageIds
                    }
                }
            });

            const totalEmails = emailMetrics.length;
            const openedEmails = engagementData.filter(e => e.opened).length;
            const openRate = totalEmails > 0 ? (openedEmails / totalEmails) * 100 : 0;

            analysis.metrics.totalEmails = totalEmails;
            analysis.metrics.openRate = openRate;

            // Evaluate open rate
            if (openRate < 10) {
                analysis.score += 3;
                analysis.warnings.push(`Very low open rate: ${openRate.toFixed(1)}%`);
            } else if (openRate < 20) {
                analysis.score += 1;
                analysis.warnings.push(`Low open rate: ${openRate.toFixed(1)}%`);
            }

            // Check reply patterns (only if we have the data)
            if (tableInfo.hasRepliedColumn) {
                const repliedEmails = emailMetrics.filter(metric => metric.replied).length;
                const replyRate = totalEmails > 0 ? (repliedEmails / totalEmails) * 100 : 0;
                analysis.metrics.replyRate = replyRate;

                if (replyRate < 2) {
                    analysis.score += 2;
                    analysis.warnings.push(`Very low reply rate: ${replyRate.toFixed(1)}%`);
                }
            } else {
                analysis.metrics.replyRate = 0;
                analysis.warnings.push('Reply rate data unavailable (database schema outdated)');
            }

        } catch (error) {
            console.error('❌ Error analyzing engagement patterns:', error.message);
            analysis.warnings.push('Engagement analysis failed');
            analysis.metrics.error = error.message;
        }

        return analysis;
    }

    // 🚨 NEW: Check database schema for required columns
    async checkEmailMetricsSchema() {
        try {
            // Check if 'replied' column exists
            const result = await this.sequelize.query(
                "SHOW COLUMNS FROM email_metrics LIKE 'replied'",
                { type: this.sequelize.QueryTypes.SELECT }
            );

            // Check if 'opened' column exists
            const openedResult = await this.sequelize.query(
                "SHOW COLUMNS FROM email_metrics LIKE 'opened'",
                { type: this.sequelize.QueryTypes.SELECT }
            );

            // Check if 'clicked' column exists
            const clickedResult = await this.sequelize.query(
                "SHOW COLUMNS FROM email_metrics LIKE 'clicked'",
                { type: this.sequelize.QueryTypes.SELECT }
            );

            return {
                hasRepliedColumn: result.length > 0,
                hasOpenedColumn: openedResult.length > 0,
                hasClickedColumn: clickedResult.length > 0
            };

        } catch (error) {
            console.error('❌ Error checking database schema:', error.message);
            // Default to false if we can't check
            return {
                hasRepliedColumn: false,
                hasOpenedColumn: false,
                hasClickedColumn: false
            };
        }
    }

    async analyzeContent(emailData) {
        const analysis = {
            score: 0,
            warnings: [],
            triggers: [],
            contentMetrics: {}
        };

        const subject = emailData.subject || '';
        const content = emailData.content || '';

        // Spam trigger words with weights
        const spamTriggers = [
            { word: 'urgent', weight: 2 },
            { word: 'free', weight: 3 },
            { word: 'winner', weight: 3 },
            { word: 'prize', weight: 3 },
            { word: 'cash', weight: 2 },
            { word: 'money', weight: 2 },
            { word: 'guaranteed', weight: 2 },
            { word: 'risk-free', weight: 3 },
            { word: 'special promotion', weight: 2 },
            { word: 'limited time', weight: 2 },
            { word: 'act now', weight: 2 },
            { word: 'click here', weight: 2 },
            { word: 'buy now', weight: 2 },
            { word: 'discount', weight: 1 },
            { word: 'offer expires', weight: 2 }
        ];

        // Check subject for spam triggers
        spamTriggers.forEach(trigger => {
            if (subject.toLowerCase().includes(trigger.word)) {
                analysis.score += trigger.weight;
                analysis.triggers.push(trigger.word);
                analysis.warnings.push(`Subject contains spam trigger: "${trigger.word}"`);
            }
        });

        // Check content length
        analysis.contentMetrics.contentLength = content.length;
        if (content.length < 50) {
            analysis.score += 1;
            analysis.warnings.push('Content too short (may trigger spam filters)');
        }

        if (content.length > 2000) {
            analysis.score += 1;
            analysis.warnings.push('Content very long (may trigger spam filters)');
        }

        // Check for excessive capitalization
        const capsCount = (content.match(/[A-Z]/g) || []).length;
        const capsRatio = content.length > 0 ? capsCount / content.length : 0;
        analysis.contentMetrics.capsRatio = capsRatio;

        if (capsRatio > 0.3) {
            analysis.score += 2;
            analysis.warnings.push('Excessive capitalization detected');
        }

        // Check link ratio
        const linkCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;
        const wordCount = content.split(/\s+/).length;
        const linkRatio = wordCount > 0 ? linkCount / wordCount : 0;
        analysis.contentMetrics.linkRatio = linkRatio;

        if (linkRatio > 0.1) {
            analysis.score += 2;
            analysis.warnings.push('High link-to-text ratio');
        }

        return analysis;
    }

    async analyzeSenderReputation(senderEmail) {
        const analysis = {
            score: 0,
            warnings: [],
            metrics: {}
        };

        try {
            // Check schema first
            const schemaInfo = await this.checkEmailMetricsSchema();

            let senderMetrics;

            if (schemaInfo.hasRepliedColumn && schemaInfo.hasOpenedColumn) {
                // Use full query if columns exist
                senderMetrics = await EmailMetric.findAll({
                    where: {
                        senderEmail: senderEmail,
                        sentAt: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                    }
                });
            } else {
                // Fallback query for basic metrics
                console.log(`⚠️  Using fallback sender reputation analysis for ${senderEmail}`);
                senderMetrics = await EmailMetric.findAll({
                    where: {
                        senderEmail: senderEmail,
                        sentAt: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                    },
                    attributes: ['messageId', 'sentAt', 'status'] // Only basic columns
                });
            }

            if (!senderMetrics || senderMetrics.length === 0) {
                analysis.score += 3;
                analysis.warnings.push('New sender - no sending history');
                analysis.metrics.isNewSender = true;
                return analysis;
            }

            const totalSent = senderMetrics.length;
            const bounced = senderMetrics.filter(m => m.status === 'bounced').length;
            const delivered = senderMetrics.filter(m => m.status === 'delivered').length;

            // Calculate rates
            const bounceRate = totalSent > 0 ? (bounced / totalSent) * 100 : 0;
            const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0;

            analysis.metrics = {
                totalSent,
                bounceRate,
                deliveryRate
            };

            // Evaluate bounce rate
            if (bounceRate > 10) {
                analysis.score += 5;
                analysis.warnings.push(`High bounce rate: ${bounceRate.toFixed(1)}%`);
            } else if (bounceRate > 5) {
                analysis.score += 2;
                analysis.warnings.push(`Moderate bounce rate: ${bounceRate.toFixed(1)}%`);
            }

            // Evaluate delivery rate
            if (deliveryRate < 80) {
                analysis.score += 3;
                analysis.warnings.push(`Low delivery rate: ${deliveryRate.toFixed(1)}%`);
            }

            // Check sending volume patterns
            const recentVolume = senderMetrics.filter(m =>
                m.sentAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
            ).length;

            analysis.metrics.recentVolume = recentVolume;

            if (recentVolume > 50) {
                analysis.score += 2;
                analysis.warnings.push(`High sending volume in last 24h: ${recentVolume} emails`);
            }

        } catch (error) {
            console.error('❌ Error analyzing sender reputation:', error);
            analysis.warnings.push('Sender reputation analysis failed');
        }

        return analysis;
    }

    analyzeTechnicalFactors(emailData) {
        const analysis = {
            score: 0,
            warnings: [],
            authentication: {}
        };

        // Check authentication
        analysis.authentication.spf = !!emailData.spfPassed;
        analysis.authentication.dkim = !!emailData.dkimPassed;
        analysis.authentication.dmarc = !!emailData.dmarcPassed;

        if (!emailData.spfPassed) {
            analysis.score += 3;
            analysis.warnings.push('SPF authentication missing or failed');
        }

        if (!emailData.dkimPassed) {
            analysis.score += 3;
            analysis.warnings.push('DKIM authentication missing or failed');
        }

        if (!emailData.dmarcPassed) {
            analysis.score += 2;
            analysis.warnings.push('DMARC authentication missing or failed');
        }

        // Check for proper message structure
        analysis.authentication.hasMessageId = !!emailData.messageId;
        if (!emailData.messageId || !emailData.messageId.includes('@')) {
            analysis.score += 1;
            analysis.warnings.push('Invalid or missing Message-ID header');
        }

        // Check subject structure
        const subject = emailData.subject || '';
        analysis.authentication.subjectLength = subject.length;

        if (subject.length > 100) {
            analysis.score += 1;
            analysis.warnings.push('Subject line too long');
        }

        if (subject.trim() === '') {
            analysis.score += 3;
            analysis.warnings.push('Missing subject line');
        }

        return analysis;
    }

    async storeSpamAnalysis(messageId, emailData, factors) {
        try {
            // Check if analysis already exists
            const existingAnalysis = await SpamAnalysis.findOne({
                where: { messageId: messageId }
            });

            const analysisData = {
                riskScore: factors.score,
                riskLevel: factors.riskLevel,
                warnings: factors.warnings,
                recommendations: factors.recommendations,
                contentAnalysis: factors.contentAnalysis,
                senderReputation: factors.senderReputation,
                technicalFactors: factors.technicalFactors,
                engagementPatterns: factors.engagementPatterns,
                deliveryFolder: emailData.deliveryFolder || null,
                deliveredInbox: emailData.deliveredInbox || null,
                analyzedAt: new Date()
            };

            if (existingAnalysis) {
                await existingAnalysis.update(analysisData);
                console.log(`✅ Spam analysis updated for ${messageId}`);
            } else {
                await SpamAnalysis.create({
                    messageId: messageId,
                    senderEmail: emailData.senderEmail || 'unknown',
                    receiverEmail: emailData.receiverEmail || null,
                    ...analysisData
                });
                console.log(`✅ Spam analysis stored for ${messageId}`);
            }
        } catch (error) {
            console.error('❌ Error storing spam analysis:', error.message);
            // Don't throw error - this shouldn't break the email flow
        }
    }

    calculateRiskLevel(score) {
        if (score >= 15) return 'critical';
        if (score >= 10) return 'high';
        if (score >= 5) return 'medium';
        return 'low';
    }

    generateRecommendations(factors) {
        const recommendations = [];

        if (factors.score >= 10) {
            recommendations.push('🚨 HIGH RISK: Review email content and sending patterns immediately');
        }

        if (factors.warnings.some(w => w.includes('bounce rate'))) {
            recommendations.push('✅ Clean your email list to reduce bounce rate');
        }

        if (factors.warnings.some(w => w.includes('spam complaint'))) {
            recommendations.push('✅ Review email content and frequency to reduce spam complaints');
        }

        if (factors.warnings.some(w => w.includes('authentication'))) {
            recommendations.push('✅ Set up SPF, DKIM, and DMARC records for your domain');
        }

        if (factors.warnings.some(w => w.includes('engagement'))) {
            recommendations.push('✅ Improve email content to increase engagement');
        }

        if (factors.warnings.some(w => w.includes('capitalization'))) {
            recommendations.push('✅ Avoid excessive capitalization in subject and content');
        }

        if (factors.warnings.some(w => w.includes('trigger'))) {
            recommendations.push('✅ Avoid spam trigger words in subject lines');
        }

        if (factors.warnings.some(w => w.includes('link'))) {
            recommendations.push('✅ Reduce the number of links in your email content');
        }

        if (factors.warnings.some(w => w.includes('volume'))) {
            recommendations.push('✅ Reduce sending volume and warm up your domain gradually');
        }

        if (recommendations.length === 0) {
            recommendations.push('✅ Good sending practices detected. Continue monitoring.');
        }

        return recommendations;
    }

    async preSendSpamCheck(emailData) {
        const analysis = await this.analyzeSpamFactors('pre-send-check', emailData);

        if (analysis.riskLevel === 'critical') {
            throw new Error(`🚨 CRITICAL SPAM RISK: Email likely to be flagged as spam. Review: ${analysis.warnings.join(', ')}`);
        }

        if (analysis.riskLevel === 'high') {
            console.warn(`⚠️ HIGH SPAM RISK: ${analysis.warnings.join(', ')}`);
        }

        return analysis;
    }

    async getSenderSpamHistory(senderEmail, days = 30) {
        try {
            const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            const analyses = await SpamAnalysis.findAll({
                where: {
                    senderEmail: senderEmail,
                    analyzedAt: { [Op.gte]: sinceDate }
                },
                order: [['analyzedAt', 'DESC']],
                limit: 100
            });

            return analyses;
        } catch (error) {
            console.error('Error getting spam history:', error);
            return [];
        }
    }

    async getSpamRiskTrends(senderEmail, days = 7) {
        try {
            const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            const analyses = await SpamAnalysis.findAll({
                where: {
                    senderEmail: senderEmail,
                    analyzedAt: { [Op.gte]: sinceDate }
                },
                attributes: [
                    'riskLevel',
                    'riskScore',
                    'analyzedAt'
                ],
                order: [['analyzedAt', 'ASC']]
            });

            return analyses;
        } catch (error) {
            console.error('Error getting spam trends:', error);
            return [];
        }
    }

    // 🚨 TEMPORARY FIX: Simple engagement analysis without database dependencies
    async analyzeEngagementPatternsSimple(senderEmail) {
        // Temporary fallback that doesn't depend on database schema
        return {
            score: 0,
            warnings: ['Engagement analysis temporarily disabled - updating database schema'],
            metrics: {
                totalEmails: 0,
                openRate: 0,
                replyRate: 0,
                usingFallback: true
            }
        };
    }
}

module.exports = SpamDetectionService;