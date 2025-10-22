// Professional industry-specific contexts (keep your existing ones)
const industryContexts = {
    technology: {
        topics: [
            "digital transformation initiatives",
            "emerging tech stack architectures",
            "cloud migration strategies",
            "AI and machine learning implementations",
            "cybersecurity frameworks",
            "devops and agile methodologies",
            "data analytics and business intelligence"
        ],
        challenges: [
            "scaling infrastructure efficiently",
            "managing technical debt",
            "staying ahead of security threats",
            "hiring and retaining top tech talent",
            "balancing innovation with stability"
        ]
    },
    finance: {
        topics: [
            "portfolio optimization strategies",
            "risk management frameworks",
            "regulatory compliance updates",
            "financial technology innovations",
            "investment analysis methodologies",
            "wealth management trends",
            "market volatility strategies"
        ],
        challenges: [
            "navigating regulatory changes",
            "managing client expectations in volatile markets",
            "digital transformation in traditional finance",
            "cybersecurity in financial systems",
            "sustainable investing integration"
        ]
    },
    healthcare: {
        topics: [
            "telemedicine implementations",
            "healthcare data interoperability",
            "patient engagement technologies",
            "value-based care models",
            "medical device innovations",
            "healthcare policy updates",
            "precision medicine advances"
        ],
        challenges: [
            "balancing technology with patient care",
            "data privacy and security compliance",
            "healthcare cost management",
            "regulatory approval processes",
            "health equity and access"
        ]
    },
    marketing: {
        topics: [
            "customer journey optimization",
            "data-driven campaign strategies",
            "content marketing ROI measurement",
            "social media algorithm changes",
            "personalization at scale",
            "brand storytelling techniques",
            "influencer marketing effectiveness"
        ],
        challenges: [
            "attribution modeling accuracy",
            "adapting to privacy regulations",
            "content saturation in digital spaces",
            "measuring true marketing impact",
            "staying relevant with changing consumer behavior"
        ]
    },
    general: {
        topics: [
            "strategic business development",
            "leadership in changing markets",
            "operational efficiency improvements",
            "team collaboration methodologies",
            "professional development strategies",
            "industry networking best practices",
            "innovation management frameworks"
        ],
        challenges: [
            "adapting to market disruptions",
            "talent development and retention",
            "maintaining competitive advantage",
            "scaling operations effectively",
            "balancing growth with sustainability"
        ]
    }
};

// Professional tone variations
const professionalTones = [
    "collaborative and insightful",
    "strategic and forward-thinking",
    "analytical and data-driven",
    "innovative and progressive",
    "experienced and pragmatic",
    "visionary and inspiring",
    "consultative and supportive"
];

// Sophisticated email structures
const emailStructures = [
    "insight-sharing-followed-by-question",
    "compliment-then-industry-perspective",
    "shared-challenge-discussion",
    "trend-analysis-with-invitation",
    "achievement-recognition-and-learning",
    "future-focused-strategic-discussion",
    "value-proposition-with-collaboration"
];

class TemplateEmailService {
    constructor() {
        this.initialized = true;
        console.log("✅ Template-based email service initialized");
    }

    getIndustryContext(industry = "general") {
        const normalizedIndustry = industry.toLowerCase();
        return industryContexts[normalizedIndustry] || industryContexts.general;
    }

    getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    generateEmail(senderName, receiverName, industry = "general") {
        const industryData = this.getIndustryContext(industry);
        const topic = this.getRandomItem(industryData.topics);
        const challenge = this.getRandomItem(industryData.challenges);
        const tone = this.getRandomItem(professionalTones);
        const structure = this.getRandomItem(emailStructures);

        console.log('📧 Generating template-based professional email...');

        const emailTemplate = this.selectEmailTemplate(structure, senderName, receiverName, industry, topic, challenge, tone);

        console.log(`✅ Generated professional email: "${emailTemplate.subject}"`);

        return {
            subject: emailTemplate.subject,
            content: emailTemplate.content,
            industry: industry,
            tone: tone,
            structure: structure,
            provider: 'template'
        };
    }

    selectEmailTemplate(structure, senderName, receiverName, industry, topic, challenge, tone) {
        const templates = {
            "insight-sharing-followed-by-question": {
                subject: `Industry Insights: ${topic}`,
                content: `Dear ${receiverName},

I hope this message finds you well. I've been closely following developments around ${topic} in our ${industry} sector and wanted to share some observations that might be of mutual interest.

Recently, I've been considering how ${challenge} is impacting our approaches to ${topic}. In my experience, the most effective strategies often involve balancing innovation with practical implementation considerations.

I'm particularly curious about your perspective on how you see this landscape evolving over the coming months. What emerging approaches have you found most promising in addressing these challenges?

I'd greatly value the opportunity to learn from your experiences and insights.

Best regards,
${senderName}`
            },
            "compliment-then-industry-perspective": {
                subject: `Appreciating Your Work in ${industry}`,
                content: `Dear ${receiverName},

I hope you're doing well. I've been impressed by your professional contributions to our ${industry} community, particularly regarding ${topic}. Your insights have consistently demonstrated depth and practical relevance.

Given your expertise, I wanted to connect about how professionals like us are navigating ${challenge}. The current environment presents both significant opportunities and complex considerations that require thoughtful strategic approaches.

From your vantage point, what do you see as the most critical factors for success in this area? I'm always looking to learn from peers who share a commitment to excellence in our field.

Warm regards,
${senderName}`
            },
            "shared-challenge-discussion": {
                subject: `Navigating ${challenge} Together`,
                content: `Dear ${receiverName},

I'm reaching out because I believe we share common ground in addressing ${challenge} within the ${industry} space. Your professional approach to ${topic} has been particularly noteworthy.

Like many in our industry, I've been considering how to best balance innovation with stability while addressing evolving market expectations. The intersection of ${topic} and operational excellence seems increasingly crucial for sustainable success.

I'd be very interested to hear about any strategies or approaches you've found effective in your work. Your perspective would be invaluable as we all navigate these complex dynamics.

Sincerely,
${senderName}`
            },
            "trend-analysis-with-invitation": {
                subject: `Emerging Trends in ${industry}`,
                content: `Dear ${receiverName},

I hope this email finds you well. I've been analyzing emerging trends in ${industry}, particularly around ${topic}, and your work came to mind as exemplary in this space.

The ongoing evolution of ${challenge} presents both challenges and opportunities for professionals committed to excellence. I've observed that organizations focusing on strategic alignment and continuous learning tend to navigate these waters most successfully.

Would you be open to sharing your perspective on the developments you're most excited about in our industry? I believe our exchange could be mutually beneficial.

Best regards,
${senderName}`
            },
            "achievement-recognition-and-learning": {
                subject: `Learning from Excellence in ${industry}`,
                content: `Dear ${receiverName},

I hope you're having a productive week. I wanted to reach out and acknowledge the quality of your work in addressing ${topic} within our ${industry} sector. Your approach demonstrates both innovation and practical wisdom.

As I continue to explore solutions for ${challenge}, I'm increasingly convinced that collaboration and knowledge-sharing among experienced professionals like yourself is key to meaningful progress.

I'd be grateful for the opportunity to learn from your experiences. What insights have you gained recently that might benefit others in our professional community?

Thank you for your consideration.

Warm regards,
${senderName}`
            },
            "future-focused-strategic-discussion": {
                subject: `Strategic Outlook: ${topic} in ${industry}`,
                content: `Dear ${receiverName},

I hope this message finds you well. I've been contemplating the future trajectory of ${topic} in our ${industry} sector, and your strategic perspective would be invaluable.

The challenge of ${challenge} continues to shape how we approach both immediate priorities and long-term planning. I'm particularly interested in how organizations are preparing for the next phase of industry evolution while maintaining operational excellence.

From your vantage point, what strategic considerations should be top of mind for professionals focused on sustainable growth and innovation?

I look forward to potentially exchanging more thoughts on these important topics.

Best regards,
${senderName}`
            },
            "value-proposition-with-collaboration": {
                subject: `Collaborative Opportunities in ${industry}`,
                content: `Dear ${receiverName},

I hope you're doing well. I'm writing to explore potential areas of mutual interest regarding ${topic} in our ${industry} sector. Your work in this area has been impressive and professionally relevant.

As we both navigate ${challenge}, I'm struck by how shared insights and collaborative thinking can enhance our individual approaches. The complexity of current market dynamics suggests that diverse perspectives are more valuable than ever.

I'm curious about your thoughts on the most promising opportunities for professional collaboration and knowledge exchange in our field. Would you be open to sharing your perspective?

Sincerely,
${senderName}`
            }
        };

        return templates[structure] || templates["insight-sharing-followed-by-question"];
    }

    generateReply(originalEmail) {
        console.log('📧 Generating template-based professional reply...');

        const replyTemplates = [
            `Thank you for your thoughtful email regarding ${originalEmail.subject?.toLowerCase() || 'this important topic'}. I appreciate you sharing your insights and perspective.

Your points resonate with my own experiences in the industry. I've been considering similar questions around balancing innovation with practical implementation, and your perspective adds valuable context to this conversation.

I'd be interested to learn more about any specific approaches or strategies you've found particularly effective. The exchange of ideas among experienced professionals like yourself is what moves our industry forward.

Best regards`,

            `I appreciate you reaching out and sharing your perspective. Your email demonstrates a keen understanding of the current ${originalEmail.industry || 'industry'} landscape and the challenges we collectively face.

The intersection of strategy and implementation you mentioned is indeed crucial in today's environment. It's refreshing to connect with someone who understands both the theoretical and practical dimensions of our work.

What are your thoughts on the evolving role of leadership in navigating these complex dynamics? I believe there's much we can learn from each other's experiences.`,

            `Thank you for your insightful email. I've been considering similar questions around ${originalEmail.subject?.toLowerCase() || 'these industry developments'}, and your perspective adds valuable depth to the conversation.

The balance between innovation and stability you referenced is something I encounter regularly. It's a challenge that requires both strategic vision and operational discipline, and your approach seems to strike that balance effectively.

I'm curious to learn more about your methodology for measuring success in these initiatives. Are there specific metrics or indicators you've found particularly meaningful?`
        ];

        const replyContent = this.getRandomItem(replyTemplates);

        return {
            reply_content: replyContent,
            provider: 'template'
        };
    }

    generateReplyWithRetry(originalEmail, maxRetries = 2) {
        // For template-based service, retry isn't needed but maintaining interface consistency
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
}

const emailService = new TemplateEmailService();

module.exports = {
    generateEmail: (senderName, receiverName, industry) =>
        emailService.generateEmail(senderName, receiverName, industry),

    generateReply: (originalEmail) =>
        emailService.generateReply(originalEmail),

    generateReplyWithRetry: (originalEmail, maxRetries) =>
        emailService.generateReplyWithRetry(originalEmail, maxRetries),

    getIndustryExpertise: (industry) =>
        emailService.getIndustryExpertise(industry)
};