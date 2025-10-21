// services/template-email-service.js
class TemplateEmailService {
    constructor() {
        this.templates = this.initializeTemplates();
        this.cache = new Map();
        this.performance = {
            totalRequests: 0,
            cacheHits: 0,
            averageResponseTime: 0
        };
        console.log(`✅ Template system ready with ${this.getTemplateCount()} professional templates`);
    }

    initializeTemplates() {
        return {
            technology: this.generateIndustryTemplates('technology', 50),
            finance: this.generateIndustryTemplates('finance', 50),
            healthcare: this.generateIndustryTemplates('healthcare', 50),
            marketing: this.generateIndustryTemplates('marketing', 50),
            general: this.generateIndustryTemplates('general', 100)
        };
    }

    generateIndustryTemplates(industry, count) {
        const industryData = this.getIndustryData(industry);
        const templates = [];

        for (let i = 0; i < count; i++) {
            templates.push(this.createTemplate(industry, industryData, i));
        }

        return templates;
    }

    createTemplate(industry, industryData, index) {
        const topic = industryData.topics[index % industryData.topics.length];
        const challenge = industryData.challenges[index % industryData.challenges.length];

        const templateTypes = [
            // Insight + Question
            {
                type: 'insight_question',
                subject: `Thoughts on ${topic}`,
                content: `Dear {receiver},

I've been following the developments around ${topic} in our ${industry} space. The challenges of ${challenge} are particularly relevant right now, and I'm interested in your perspective.

Many professionals are finding that focusing on {solution} yields the best results. What approaches have you found most effective?

Best regards,
{sender}`
            },
            // Collaboration Focus
            {
                type: 'collaboration',
                subject: `Professional Connection - ${industry}`,
                content: `Hello {receiver},

I'm reaching out to connect professionally within the ${industry} sector. Your work in ${topic} has caught my attention.

As we navigate ${challenge}, I believe there's value in exchanging perspectives. The industry seems to be moving toward {trend}, and I'm curious about your experience.

Would you be open to sharing your thoughts?

Warm regards,
{sender}`
            },
            // Trend Discussion
            {
                type: 'trend_discussion',
                subject: `${industry} Trends: ${topic}`,
                content: `Dear {receiver},

I hope this message finds you well. I've been analyzing the current landscape of ${topic} in ${industry} and would value your insights.

The ongoing challenge of ${challenge} presents opportunities for {innovation}. Many organizations are exploring new approaches to stay competitive.

What developments in ${topic} are you finding most impactful?

Best regards,
{sender}`
            },
            // Problem-Solving
            {
                type: 'problem_solving',
                subject: `Navigating ${challenge}`,
                content: `Hello {receiver},

I'm writing because I appreciate your approach to ${topic} in our industry. The challenge of ${challenge} is something many of us are working to address.

I've found that strategies focusing on {approach} tend to deliver strong results. How has your organization been tackling this?

Looking forward to your perspective.

Sincerely,
{sender}`
            },
            // Future Focused
            {
                type: 'future_focused',
                subject: `Looking Ahead in ${industry}`,
                content: `Dear {receiver},

I've been considering the future of ${topic} in ${industry} and wanted to connect. Your insights would be valuable as we look toward what's next.

With ${challenge} affecting many organizations, I'm interested in how different strategies are evolving. The intersection of {area_a} and {area_b} seems particularly promising.

What trends are you watching most closely?

Best regards,
{sender}`
            }
        ];

        const template = templateTypes[index % templateTypes.length];
        const variables = this.getTemplateVariables(index);

        return {
            id: `${industry}_${index}`,
            type: template.type,
            industry: industry,
            subject: this.replaceVariables(template.subject, variables),
            content: this.replaceVariables(template.content, variables),
            quality: 0.8 + (Math.random() * 0.2) // Quality score for A/B testing
        };
    }

    getTemplateVariables(index) {
        const solutions = [
            'strategic partnerships', 'incremental improvements', 'technology adoption',
            'process optimization', 'talent development', 'customer-centric approaches',
            'data-driven decisions', 'agile methodologies', 'cross-functional collaboration'
        ];

        const trends = [
            'digital transformation', 'AI integration', 'sustainable practices',
            'remote collaboration', 'personalization', 'automation',
            'cloud migration', 'cybersecurity focus', 'API-first development'
        ];

        const innovations = [
            'AI-powered solutions', 'blockchain applications', 'IoT integration',
            'predictive analytics', 'machine learning', 'edge computing',
            'zero-trust security', 'composable architecture', 'hyperautomation'
        ];

        const approaches = [
            'balanced risk-taking', 'continuous learning', 'experimental mindset',
            'strategic patience', 'rapid iteration', 'customer feedback loops',
            'ecosystem partnerships', 'platform thinking', 'design-led development'
        ];

        const areas = [
            ['technology', 'business strategy'],
            ['innovation', 'operational excellence'],
            ['growth', 'sustainability'],
            ['automation', 'human expertise'],
            ['data analytics', 'customer experience']
        ];

        return {
            solution: solutions[index % solutions.length],
            trend: trends[index % trends.length],
            innovation: innovations[index % innovations.length],
            approach: approaches[index % approaches.length],
            area_a: areas[index % areas.length][0],
            area_b: areas[index % areas.length][1]
        };
    }

    replaceVariables(text, variables) {
        let result = text;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(`{${key}}`, value);
        }
        return result;
    }

    getIndustryData(industry) {
        const industries = {
            technology: {
                topics: [
                    'AI implementation', 'cloud migration', 'cybersecurity frameworks',
                    'digital transformation', 'data analytics', 'devops practices',
                    'microservices architecture', 'API development', 'machine learning',
                    'containerization', 'serverless computing', 'data privacy',
                    'cloud security', 'automation tools', 'CI/CD pipelines',
                    'infrastructure as code', 'monitoring solutions', 'performance optimization',
                    'technical debt management', 'agile methodologies'
                ],
                challenges: [
                    'technical debt', 'talent acquisition', 'security threats',
                    'infrastructure scaling', 'legacy system integration', 'cost optimization',
                    'compliance requirements', 'technology selection', 'team collaboration',
                    'innovation balance', 'data management', 'vendor lock-in',
                    'skill gaps', 'rapid technology changes', 'budget constraints',
                    'performance issues', 'integration complexity', 'change management',
                    'quality assurance', 'disaster recovery'
                ]
            },
            finance: {
                topics: [
                    'investment strategies', 'risk management', 'regulatory compliance',
                    'fintech innovation', 'portfolio optimization', 'digital banking',
                    'blockchain applications', 'algorithmic trading', 'wealth management',
                    'financial planning', 'market analysis', 'credit risk assessment',
                    'payment systems', 'insurtech solutions', 'regtech adoption',
                    'customer experience', 'data security', 'compliance automation',
                    'investment analytics', 'financial modeling'
                ],
                challenges: [
                    'regulatory changes', 'market volatility', 'digital transformation',
                    'cybersecurity threats', 'customer expectations', 'competition from fintech',
                    'data privacy compliance', 'legacy system modernization', 'talent retention',
                    'cost pressure', 'innovation adoption', 'risk assessment accuracy',
                    'compliance costs', 'technology integration', 'customer trust',
                    'operational efficiency', 'fraud prevention', 'liquidity management',
                    'interest rate changes', 'economic uncertainty'
                ]
            },
            healthcare: {
                topics: [
                    'telemedicine', 'patient engagement', 'healthtech innovation',
                    'electronic health records', 'medical devices', 'healthcare analytics',
                    'precision medicine', 'value-based care', 'population health',
                    'healthcare interoperability', 'clinical decision support', 'remote monitoring',
                    'healthcare AI', 'patient privacy', 'regulatory compliance',
                    'healthcare costs', 'patient outcomes', 'medical research',
                    'healthcare access', 'preventive care'
                ],
                challenges: [
                    'regulatory compliance', 'patient privacy', 'healthcare costs',
                    'technology adoption', 'interoperability issues', 'data security',
                    'staff shortages', 'patient engagement', 'reimbursement models',
                    'quality measurement', 'access to care', 'health disparities',
                    'medical errors', 'burnout prevention', 'innovation implementation',
                    'budget constraints', 'legacy systems', 'patient satisfaction',
                    'clinical workflow', 'population health management'
                ]
            },
            marketing: {
                topics: [
                    'customer journey optimization', 'data-driven campaigns', 'content strategy',
                    'social media marketing', 'brand development', 'influencer partnerships',
                    'marketing automation', 'customer segmentation', 'personalization',
                    'conversion optimization', 'email marketing', 'SEO strategies',
                    'performance marketing', 'brand storytelling', 'customer retention',
                    'market research', 'competitive analysis', 'campaign measurement',
                    'omnichannel strategy', 'customer experience'
                ],
                challenges: [
                    'ROI measurement', 'changing algorithms', 'audience attention',
                    'data privacy regulations', 'content saturation', 'budget constraints',
                    'technology integration', 'team coordination', 'campaign performance',
                    'customer acquisition costs', 'brand consistency', 'market competition',
                    'talent retention', 'innovation adoption', 'data quality',
                    'attribution modeling', 'channel selection', 'creative development',
                    'performance tracking', 'customer loyalty'
                ]
            },
            general: {
                topics: [
                    'business strategy', 'professional growth', 'industry trends',
                    'leadership development', 'operational efficiency', 'team collaboration',
                    'innovation management', 'customer focus', 'market expansion',
                    'talent development', 'strategic planning', 'performance improvement',
                    'change management', 'competitive advantage', 'stakeholder engagement',
                    'risk management', 'quality improvement', 'process optimization',
                    'business development', 'organizational culture'
                ],
                challenges: [
                    'market changes', 'team development', 'innovation balance',
                    'competition', 'resource allocation', 'strategic alignment',
                    'change resistance', 'performance measurement', 'talent retention',
                    'customer satisfaction', 'operational costs', 'technology adoption',
                    'quality standards', 'growth management', 'risk assessment',
                    'stakeholder expectations', 'market positioning', 'process efficiency',
                    'knowledge management', 'sustainability'
                ]
            }
        };

        return industries[industry] || industries.general;
    }

    async generateEmail(senderName, receiverName, industry = "general") {
        const startTime = Date.now();
        this.performance.totalRequests++;

        const cacheKey = `${industry}_${senderName}_${receiverName}`;

        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.performance.cacheHits++;
            const responseTime = Date.now() - startTime;
            this.updateAverageResponseTime(responseTime);
            return { ...cached, responseTime, provider: 'template-cache' };
        }

        // Get random template from industry
        const industryTemplates = this.templates[industry] || this.templates.general;
        const template = industryTemplates[Math.floor(Math.random() * industryTemplates.length)];

        // Personalize template
        const email = {
            subject: template.subject,
            content: template.content
                .replace(/{sender}/g, senderName)
                .replace(/{receiver}/g, receiverName),
            industry: industry,
            templateId: template.id,
            quality: template.quality
        };

        // Cache for future use (24 hours)
        this.cache.set(cacheKey, email);
        setTimeout(() => this.cache.delete(cacheKey), 24 * 60 * 60 * 1000);

        const responseTime = Date.now() - startTime;
        this.updateAverageResponseTime(responseTime);

        return {
            ...email,
            responseTime,
            provider: 'template'
        };
    }

    async generateReply(originalEmail) {
        const replyTemplates = [
            {
                content: `Thank you for your email regarding {topic}. I appreciate you sharing your insights and perspective on this matter.

Your points about the industry challenges resonate with my own experiences. I've found that focusing on sustainable approaches often yields the most meaningful long-term results.

I'd be interested to hear more about any specific initiatives or strategies you've seen successfully address these challenges.`
            },
            {
                content: `I appreciate you reaching out and sharing your perspective on {topic}. Your email demonstrates a keen understanding of the current landscape.

The intersection of strategy and implementation you mentioned is indeed crucial. It's refreshing to connect with someone who understands both the theoretical and practical dimensions of our work.

What are your thoughts on the evolving role of leadership in navigating these complex environments?`
            },
            {
                content: `Thank you for your insightful email. I've been considering similar questions around {topic}, and your perspective adds valuable context to the conversation.

The balance between innovation and stability you referenced is something I encounter regularly. It's a challenge that requires both strategic vision and operational discipline.

I'm curious to learn more about your approach to measuring success in these initiatives.`
            },
            {
                content: `I appreciate you connecting about {topic}. Your insights come at an interesting time as we're evaluating similar approaches in our work.

Many of the challenges you mentioned align with what we're seeing across the industry. Finding the right balance between innovation and practical execution continues to be key.

What trends or developments are you finding most promising right now?`
            },
            {
                content: `Thank you for your thoughtful email. It's great to connect with professionals who are thinking deeply about {topic} and its implications for our industry.

Your perspective on the current challenges is valuable. I've observed similar patterns and believe collaboration across organizations could lead to better solutions.

How are you approaching the measurement of impact for these types of initiatives?`
            }
        ];

        const template = replyTemplates[Math.floor(Math.random() * replyTemplates.length)];
        const topic = originalEmail.subject?.toLowerCase() || 'this important topic';

        const reply = {
            reply_content: template.content.replace(/{topic}/g, topic),
            provider: 'template',
            responseTime: 1
        };

        return reply;
    }

    async generateReplyWithRetry(originalEmail, maxRetries = 2) {
        // Templates are 100% reliable - no retry needed
        return this.generateReply(originalEmail);
    }

    getIndustryExpertise(industry) {
        const expertise = {
            technology: "digital transformation, cloud architecture, and emerging technologies",
            finance: "investment strategies, risk management, and financial innovation",
            healthcare: "healthcare technology, patient care models, and regulatory compliance",
            marketing: "brand strategy, digital marketing, and customer engagement",
            general: "business strategy, leadership, and operational excellence"
        };
        return expertise[industry] || expertise.general;
    }

    updateAverageResponseTime(newTime) {
        this.performance.averageResponseTime =
            (this.performance.averageResponseTime * (this.performance.totalRequests - 1) + newTime) /
            this.performance.totalRequests;
    }

    getTemplateCount() {
        return Object.values(this.templates).reduce((total, industryTemplates) =>
            total + industryTemplates.length, 0
        );
    }

    getPerformanceStats() {
        return {
            ...this.performance,
            cacheHitRate: this.performance.totalRequests > 0 ?
                (this.performance.cacheHits / this.performance.totalRequests) * 100 : 0,
            totalTemplates: this.getTemplateCount(),
            cacheSize: this.cache.size
        };
    }

    // Method to add new templates dynamically
    addTemplates(industry, newTemplates) {
        if (!this.templates[industry]) {
            this.templates[industry] = [];
        }
        this.templates[industry].push(...newTemplates);
    }
}

// Export singleton instance
const templateService = new TemplateEmailService();
module.exports = {
    generateEmail: (senderName, receiverName, industry) =>
        templateService.generateEmail(senderName, receiverName, industry),

    generateReply: (originalEmail) =>
        templateService.generateReply(originalEmail),

    generateReplyWithRetry: (originalEmail, maxRetries) =>
        templateService.generateReplyWithRetry(originalEmail, maxRetries),

    getIndustryExpertise: (industry) =>
        templateService.getIndustryExpertise(industry),

    // Bonus: Monitoring methods
    getPerformanceStats: () => templateService.getPerformanceStats(),
    getTemplateCount: () => templateService.getTemplateCount()
};