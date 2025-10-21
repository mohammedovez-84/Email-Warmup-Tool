const { pipeline } = require('@xenova/transformers');

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

class GPT2EmailService {
    constructor() {
        this.generator = null;
        this.initialized = false;
        this.suppressAllLogs();
        this.initializeModel();
    }

    suppressAllLogs() {
        // Store original console methods
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info
        };

        // Suppress ALL console output during model operations
        console.log = (...args) => {
            // Only allow our specific success messages
            if (args[0] && (
                args[0].includes('✅ GPT-2 model loaded successfully') ||
                args[0].includes('✅ Generated professional email') ||
                args[0].includes('✅ Generated professional reply') ||
                args[0].includes('🧠 Loading GPT-2 model') ||
                args[0].includes('🤖 Attempting GPT-2') ||
                args[0].includes('🔄 Using professional fallback') ||
                args[0].includes('❌ GPT-2 generation error') ||
                args[0].includes('❌ GPT-2 reply error')
            )) {
                this.originalConsole.log(...args);
            }
            // Suppress everything else
        };

        console.warn = (...args) => {
            // Suppress all warnings
        };

        console.error = (...args) => {
            // Only allow our specific error messages
            if (args[0] && (
                args[0].includes('❌ GPT-2 generation error') ||
                args[0].includes('❌ GPT-2 reply error') ||
                args[0].includes('❌ Failed to load GPT-2 model')
            )) {
                this.originalConsole.error(...args);
            }
            // Suppress everything else
        };

        console.info = () => { }; // Suppress all info logs

        // Suppress process warnings
        process.removeAllListeners('warning');
    }

    restoreLogs() {
        // Restore original console methods
        if (this.originalConsole) {
            console.log = this.originalConsole.log;
            console.warn = this.originalConsole.warn;
            console.error = this.originalConsole.error;
            console.info = this.originalConsole.info;
        }
    }

    async initializeModel() {
        try {
            console.log('🧠 Loading GPT-2 model...');

            this.generator = await pipeline('text-generation', 'Xenova/gpt2', {
                progress_callback: () => {
                    // Suppress download progress logs
                }
            });

            console.log('✅ GPT-2 model loaded successfully');
            this.initialized = true;

        } catch (error) {
            console.error('❌ Failed to load GPT-2 model:', error.message);
            this.initialized = false;
        }
    }

    getIndustryContext(industry = "general") {
        const normalizedIndustry = industry.toLowerCase();
        return industryContexts[normalizedIndustry] || industryContexts.general;
    }

    getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    async generateEmail(senderName, receiverName, industry = "general") {
        if (!this.initialized) {
            return this.generateProfessionalFallbackEmail(senderName, receiverName, industry);
        }

        const industryData = this.getIndustryContext(industry);
        const topic = this.getRandomItem(industryData.topics);
        const challenge = this.getRandomItem(industryData.challenges);
        const tone = this.getRandomItem(professionalTones);
        const structure = this.getRandomItem(emailStructures);

        try {
            console.log('🤖 Attempting GPT-2 email generation...');

            const prompt = this.createEmailPrompt(senderName, receiverName, industry, topic, challenge, tone, structure);

            const output = await this.generator(prompt, {
                max_new_tokens: 250,
                temperature: 0.8,
                do_sample: true,
                top_k: 50,
                top_p: 0.95,
                repetition_penalty: 1.1,
            });

            const generatedText = output[0].generated_text;
            const email = this.parseGeneratedEmail(generatedText, prompt, senderName, receiverName);

            console.log(`✅ Generated professional email: "${email.subject}"`);

            return {
                subject: email.subject,
                content: email.content,
                industry: industry,
                tone: tone,
                structure: structure,
                provider: 'gpt2'
            };

        } catch (error) {
            console.error('❌ GPT-2 generation error:', error.message);
            return this.generateProfessionalFallbackEmail(senderName, receiverName, industry, topic, challenge);
        }
    }

    createEmailPrompt(senderName, receiverName, industry, topic, challenge, tone, structure) {
        return `Generate a professional business email with these specifications:

CONTEXT:
- Sender: ${senderName} (experienced professional in ${industry})
- Recipient: ${receiverName} (respected peer in ${industry})
- Industry Focus: ${industry}
- Specific Topic: ${topic}
- Business Challenge: ${challenge}
- Desired Tone: ${tone}
- Email Structure: ${structure}

PROFESSIONAL REQUIREMENTS:
- Sound like a senior executive or experienced professional
- Demonstrate deep industry knowledge and insights
- Use sophisticated business vocabulary appropriately
- Show genuine curiosity about the recipient's perspective
- Include specific, relevant industry references
- Maintain perfect business etiquette
- Keep length between 100-200 words
- End with a thoughtful, open-ended question

Return email with subject and content in this format:
Subject: [Professional subject about ${topic}]

Dear ${receiverName},

[Professional opening and context]
[Insightful content about ${topic} and ${challenge}]
[Engaging question]

Best regards,
${senderName}

Email:`;
    }

    parseGeneratedEmail(generatedText, prompt, senderName, receiverName) {
        // Remove the prompt from the generated text
        let emailText = generatedText.replace(prompt, '').trim();

        // Extract subject
        let subject = `Professional Connection - ${this.getRandomItem(['Industry Insights', 'Business Collaboration', 'Professional Network'])}`;
        const subjectMatch = emailText.match(/Subject:\s*(.+?)(?:\n|$)/i);
        if (subjectMatch) {
            subject = subjectMatch[1].trim();
            emailText = emailText.replace(subjectMatch[0], '');
        }

        // Clean up the content
        let content = emailText
            .replace(/^Dear\s+.+?,/i, `Dear ${receiverName},`)
            .replace(/Best regards,.*$/i, `Best regards,\n${senderName}`)
            .replace(/Sincerely,.*$/i, `Best regards,\n${senderName}`)
            .replace(/Warm regards,.*$/i, `Best regards,\n${senderName}`)
            .replace(/Thank you,.*$/i, `Best regards,\n${senderName}`)
            .trim();

        // Ensure it ends with sender name and has proper formatting
        if (!content.includes(senderName)) {
            content += `\n\nBest regards,\n${senderName}`;
        }

        return {
            subject: subject,
            content: content
        };
    }

    generateProfessionalFallbackEmail(senderName, receiverName, industry, topic, challenge) {
        if (!topic || !challenge) {
            const industryData = this.getIndustryContext(industry);
            topic = topic || this.getRandomItem(industryData.topics);
            challenge = challenge || this.getRandomItem(industryData.challenges);
        }

        const professionalTemplates = [
            {
                subject: `Perspectives on ${topic} in ${industry}`,
                content: `Dear ${receiverName},

I hope this message finds you well. I've been following the evolving landscape of ${topic} within our ${industry} sector and was particularly impressed by the insights you've shared in our professional community.

The challenges around ${challenge} have been top of mind for many of us, and I'm curious about your perspective on balancing innovation with practical implementation. In my experience, the most successful approaches often involve ${this.getRandomItem(['strategic partnerships', 'incremental innovation', 'cross-functional collaboration', 'data-informed decision making'])}.

I'd be very interested to hear your thoughts on how you see ${topic} evolving over the next quarter, and what you believe will be the most significant factors driving successful outcomes.

Thank you for your time and consideration.

Best regards,
${senderName}`
            },
            {
                subject: `Navigating ${challenge} in Today's ${industry} Environment`,
                content: `Hello ${receiverName},

I'm reaching out because I've noticed our shared interest in addressing ${challenge} within the ${industry} space. Your professional approach to ${topic} particularly caught my attention.

As we both know, the current environment presents both significant opportunities and complex challenges. I've found that focusing on ${this.getRandomItem(['sustainable growth strategies', 'client-centric solutions', 'operational excellence', 'digital transformation'])} has been crucial for navigating these waters successfully.

I'd appreciate hearing about any insights you've gained recently regarding ${topic}, especially as it relates to long-term strategic positioning.

Looking forward to potentially exchanging more thoughts.

Warm regards,
${senderName}`
            },
            {
                subject: `Strategic Insights on ${industry} Evolution`,
                content: `Dear ${receiverName},

I hope this email finds you well. I've been admiring your strategic approach to ${topic} within our industry, and I believe our perspectives on ${challenge} might be well-aligned.

The intersection of ${topic} and market dynamics has created some fascinating opportunities for professionals like us who understand both the technical and business dimensions. I'm particularly interested in how organizations are leveraging ${this.getRandomItem(['emerging technologies', 'data analytics', 'strategic partnerships', 'talent development'])} to create sustainable advantage.

Would you be open to sharing your perspective on the most promising developments you're seeing in our space?

Thank you for considering this connection.

Sincerely,
${senderName}`
            }
        ];

        const email = this.getRandomItem(professionalTemplates);
        console.log(`🔄 Using professional fallback template`);
        return {
            ...email,
            industry: industry,
            provider: 'fallback'
        };
    }

    async generateReply(originalEmail) {
        if (!this.initialized) {
            return this.generateProfessionalFallbackReply(originalEmail);
        }

        try {
            console.log('🤖 Attempting GPT-2 reply generation...');

            const prompt = this.createReplyPrompt(originalEmail);

            const output = await this.generator(prompt, {
                max_new_tokens: 150,
                temperature: 0.7,
                do_sample: true,
                top_k: 50,
                top_p: 0.9,
            });

            const generatedText = output[0].generated_text;
            const reply = this.parseGeneratedReply(generatedText, prompt);

            console.log("✅ Generated professional reply");
            return {
                reply_content: reply,
                provider: 'gpt2'
            };

        } catch (error) {
            console.error('❌ GPT-2 reply error:', error.message);
            return this.generateProfessionalFallbackReply(originalEmail);
        }
    }

    createReplyPrompt(originalEmail) {
        return `Generate a professional email reply to this business email:

ORIGINAL EMAIL:
Subject: ${originalEmail.subject}
Content: ${originalEmail.content}
Industry Context: ${originalEmail.industry || "general"}

REPLY REQUIREMENTS:
- Sound like an experienced industry professional
- Acknowledge the sender's insights thoughtfully
- Add value with your own relevant perspective
- Demonstrate emotional intelligence and business acumen
- Keep the conversation moving forward naturally
- Maintain perfect professional etiquette
- Length: 3-5 substantive sentences

Reply in a professional, business-appropriate tone:

`;
    }

    parseGeneratedReply(generatedText, prompt) {
        return generatedText.replace(prompt, '').trim();
    }

    generateProfessionalFallbackReply(originalEmail) {
        const professionalReplies = [
            `Thank you for your thoughtful email regarding ${originalEmail.subject?.toLowerCase() || 'this important topic'}. I appreciate you sharing your insights and perspective on this matter.

Your points about the industry challenges resonate with my own experiences, particularly around the need for strategic alignment between innovation and execution. I've found that focusing on sustainable approaches often yields the most meaningful long-term results.

I'd be interested to hear more about any specific initiatives or strategies you've seen successfully address these challenges in practice.`,

            `I appreciate you reaching out and sharing your perspective on ${originalEmail.subject?.toLowerCase() || 'this subject'}. Your email demonstrates a keen understanding of the current landscape.

The intersection of strategy and implementation you mentioned is indeed crucial, and it's refreshing to connect with someone who understands both the theoretical and practical dimensions of our work.

What are your thoughts on the evolving role of leadership in navigating these complex environments?`,

            `Thank you for your insightful email. I've been considering similar questions around ${originalEmail.subject?.toLowerCase() || 'these industry developments'}, and your perspective adds valuable context to the conversation.

The balance between innovation and stability you referenced is something I encounter regularly in my work. It's a challenge that requires both strategic vision and operational discipline.

I'm curious to learn more about your approach to measuring success in these initiatives.`
        ];

        return {
            reply_content: this.getRandomItem(professionalReplies),
            is_fallback: true,
            provider: 'fallback'
        };
    }

    async generateReplyWithRetry(originalEmail, maxRetries = 2) {
        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
            try {
                const result = await this.generateReply(originalEmail);

                if (result && result.reply_content && result.reply_content.trim().length > 20) {
                    return result;
                }
            } catch (error) {
                // Error already logged in generateReply
            }

            if (attempt <= maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }

        console.log(`🔄 Using professional fallback reply`);
        return this.generateProfessionalFallbackReply(originalEmail);
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

const emailService = new GPT2EmailService();

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