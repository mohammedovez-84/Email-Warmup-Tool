// services/template-email-service.js
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

const professionalTones = [
    "collaborative and insightful",
    "strategic and forward-thinking",
    "analytical and data-driven",
    "innovative and progressive",
    "experienced and pragmatic",
    "visionary and inspiring",
    "consultative and supportive"
];

const emailStructures = [
    "insight-question",
    "compliment-connection",
    "shared-challenge",
    "trend-discussion"
];

class TemplateEmailService {
    constructor() {
        this.initialized = true;
        console.log("✅ HTML Template-based email service initialized");
    }

    getIndustryContext(industry = "general") {
        const normalizedIndustry = industry.toLowerCase();
        return industryContexts[normalizedIndustry] || industryContexts.general;
    }

    getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    extractFirstName(fullName) {
        return fullName.split(' ')[0] || fullName;
    }

    async generateEmail(senderName, receiverName, industry = "general") {
        try {
            console.log('📧 Generating HTML professional email...');

            const industryData = this.getIndustryContext(industry);
            const topic = this.getRandomItem(industryData.topics);
            const challenge = this.getRandomItem(industryData.challenges);
            const tone = this.getRandomItem(professionalTones);
            const structure = this.getRandomItem(emailStructures);

            const emailTemplate = this.selectEmailTemplate(structure, senderName, receiverName, industry, topic, challenge, tone);

            console.log(`✅ Generated professional email: "${emailTemplate.subject}"`);

            return {
                subject: emailTemplate.subject,
                content: emailTemplate.content,
                industry: industry,
                tone: tone,
                structure: structure,
                provider: 'template',
                format: 'html'
            };
        } catch (error) {
            console.log('❌ Template email generation failed:', error);
            throw error;
        }
    }

    selectEmailTemplate(structure, senderName, receiverName, industry, topic, challenge, tone) {
        const receiverFirst = this.extractFirstName(receiverName);

        const templates = {
            "insight-question": {
                subject: `${topic} - Quick Question`,
                content: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Professional Connection</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
        .email-container { background: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; text-align: center; }
        .content { padding: 30px; }
        .topic { background: #f8f9fa; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px; }
        .question { background: #fff3cd; padding: 15px; border-radius: 6px; margin: 25px 0; border-left: 4px solid #ffc107; }
        .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        @media (max-width: 600px) { .content { padding: 20px; } .header { padding: 20px; } }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1 style="margin: 0; font-size: 24px;">Professional Connection</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${industry.charAt(0).toUpperCase() + industry.slice(1)} Industry</p>
        </div>
        
        <div class="content">
            <p>Dear <strong>${receiverFirst}</strong>,</p>
            
            <div class="topic">
                <p><strong>Topic:</strong> ${topic}</p>
                <p><strong>Focus:</strong> ${challenge}</p>
            </div>
            
            <p>I've been following developments in this area and wanted to connect.</p>
            
            <div class="question">
                <p><strong>What approaches have you found most effective in addressing this challenge?</strong></p>
            </div>
            
            <p>I'd appreciate your perspective.</p>
            
            <div class="signature">
                <p>Best regards,<br>
                <strong style="color: #2c3e50;">${senderName}</strong></p>
            </div>
        </div>
        
        <div class="footer">
            <p>Professional networking email • ${industry} industry insights</p>
        </div>
    </div>
</body>
</html>`
            },
            "compliment-connection": {
                subject: `Industry Insights - ${topic}`,
                content: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Industry Connection</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.7; color: #2c3e50; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f7fa; }
        .email-container { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; }
        .content { padding: 30px; }
        .highlight { background: linear-gradient(120deg, #a8edea 0%, #fed6e3 100%); padding: 20px; border-radius: 8px; margin: 20px 0; }
        .signature { margin-top: 30px; text-align: center; }
        .footer { background: #2c3e50; color: white; padding: 15px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1 style="margin: 0; font-size: 22px;">Industry Insights Exchange</h1>
        </div>
        
        <div class="content">
            <p>Dear <strong>${receiverFirst}</strong>,</p>
            
            <div class="highlight">
                <p style="margin: 0; font-size: 16px; line-height: 1.5;">Your expertise in <strong>${topic}</strong> within the ${industry} space is impressive and highly relevant to current industry discussions.</p>
            </div>
            
            <p>I'm reaching out because I believe your perspective on <strong>${challenge}</strong> would be valuable.</p>
            
            <p>Would you be open to sharing your insights on current best practices?</p>
            
            <div class="signature">
                <p>Warm regards,<br>
                <strong style="font-size: 16px;">${senderName}</strong></p>
            </div>
        </div>
        
        <div class="footer">
            <p>Professional Networking • ${new Date().getFullYear()}</p>
        </div>
    </div>
</body>
</html>`
            },
            "shared-challenge": {
                subject: `Navigating ${challenge}`,
                content: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Professional Discussion</title>
    <style>
        body { font-family: Georgia, serif; line-height: 1.7; color: #444; max-width: 580px; margin: 0 auto; padding: 20px; background: #fefefe; }
        .email-container { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .challenge-box { background: #f8f9fa; border-left: 4px solid #6c757d; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0; }
        .signature { margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; }
        .industry-tag { display: inline-block; background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="industry-tag">${industry.toUpperCase()}</div>
        
        <p>Dear ${receiverFirst},</p>
        
        <div class="challenge-box">
            <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                <strong style="display: block; margin-bottom: 8px;">Industry Focus:</strong>
                ${topic}<br><br>
                <strong style="display: block; margin-bottom: 8px;">Current Challenge:</strong>
                ${challenge}
            </p>
        </div>
        
        <p>Many professionals in our field are addressing this while advancing strategic objectives.</p>
        
        <p><strong>What strategies are you finding most impactful in your current work?</strong></p>
        
        <div class="signature">
            <p>Best regards,<br>
            <strong>${senderName}</strong></p>
        </div>
    </div>
</body>
</html>`
            },
            "trend-discussion": {
                subject: `Industry Perspective: ${topic}`,
                content: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Industry Trends</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background: #f0f2f5; }
        .container { background: #ffffff; }
        .header { background: #4a90e2; color: white; padding: 25px; text-align: center; }
        .body { padding: 30px; }
        .bullet-point { margin: 20px 0; padding-left: 20px; border-left: 3px solid #4a90e2; }
        .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee; }
        .cta { background: #4a90e2; color: white; padding: 12px 20px; border-radius: 5px; text-align: center; margin: 25px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 22px;">Industry Perspective</h1>
        </div>
        
        <div class="body">
            <p>Dear ${receiverFirst},</p>
            
            <div class="bullet-point">
                <p><strong>Topic of Interest:</strong> ${topic}</p>
            </div>
            
            <div class="bullet-point">
                <p><strong>Current Focus:</strong> ${challenge}</p>
            </div>
            
            <p>I'm interested in your perspective on emerging approaches in this area.</p>
            
            <div class="cta">
                <p style="margin: 0; font-weight: bold;">Would you be open to sharing your insights?</p>
            </div>
            
            <div class="signature">
                <p>Sincerely,<br>
                <strong>${senderName}</strong></p>
            </div>
        </div>
    </div>
</body>
</html>`
            }
        };

        return templates[structure] || templates["insight-question"];
    }

    async generateReply(originalEmail) {
        console.log('📧 Generating HTML professional reply...');

        const replyTemplates = [
            `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
        .email-container { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .content { margin: 20px 0; }
        .signature { margin-top: 25px; padding-top: 15px; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="content">
            <p>Thank you for your email regarding <strong>${originalEmail.subject || 'this important topic'}</strong>.</p>
            
            <p>I appreciate you sharing your insights. Your perspective aligns with current industry discussions and adds valuable context.</p>
            
            <p>I'd be interested to learn more about your approach. Would you be available for a brief discussion next week?</p>
        </div>
        
        <div class="signature">
            <p>Best regards,<br>
            <strong>${originalEmail.receiverName || 'Team'}</strong></p>
        </div>
    </div>
</body>
</html>`
        ];

        const replyContent = this.getRandomItem(replyTemplates);

        return {
            reply_content: replyContent,
            provider: 'template',
            format: 'html'
        };
    }

    async generateReplyWithRetry(originalEmail, maxRetries = 2) {
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

// Export functions
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