const OpenAI = require("openai")
const dotenv = require("dotenv")
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Professional industry-specific contexts
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

function getIndustryContext(industry = "general") {
    const normalizedIndustry = industry.toLowerCase();
    return industryContexts[normalizedIndustry] || industryContexts.general;
}

function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

async function generateEmail(senderName, receiverName, industry = "general") {
    const industryData = getIndustryContext(industry);
    const topic = getRandomItem(industryData.topics);
    const challenge = getRandomItem(industryData.challenges);
    const tone = getRandomItem(professionalTones);
    const structure = getRandomItem(emailStructures);

    const prompt = `
Generate a highly professional and sophisticated business email with these specifications:

CONTEXT:
- Sender: ${senderName} (experienced professional in ${industry})
- Recipient: ${receiverName} (respected peer in ${industry})
- Industry Focus: ${industry}
- Specific Topic: ${topic}
- Business Challenge: ${challenge}
- Desired Tone: ${tone}
- Email Structure: ${structure}

PROFESSIONAL REQUIREMENTS:
1. Sound like a senior executive or experienced professional
2. Demonstrate deep industry knowledge and insights
3. Use sophisticated business vocabulary appropriately
4. Show genuine curiosity about the recipient's perspective
5. Include specific, relevant industry references
6. Maintain perfect business etiquette
7. Keep length between 100-200 words
8. End with a thoughtful, open-ended question

CONTENT EXPECTATIONS:
- Opening: Professional greeting with context
- Body: 2-3 substantive paragraphs with insights
- Value: Share a brief relevant observation or experience
- Engagement: Ask a thoughtful, industry-specific question
- Closing: Professional sign-off that invites continued dialogue

STYLISTIC GUIDELINES:
- Avoid generic phrases and clichés
- Use confident but not arrogant language
- Show respect for the recipient's time and expertise
- Demonstrate emotional intelligence
- Maintain professional boundaries

Return JSON with "subject" and "content" fields. The subject should be compelling and professional.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-5", // Using GPT-4 for better quality
            messages: [
                {
                    role: "system",
                    content: `You are an experienced ${industry} executive with 15+ years of industry experience. You write sophisticated, professional business emails that demonstrate expertise while building genuine professional relationships. Your writing is insightful, respectful, and strategically valuable. Always return valid JSON.`
                },
                { role: "user", content: prompt },
            ],
            temperature: 0.7, // Balanced for creativity and professionalism
            max_tokens: 500,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;

        try {
            const parsed = JSON.parse(content);

            // Enhanced validation
            if (parsed.subject && parsed.content) {
                console.log(`✅ Generated professional email: "${parsed.subject}"`);
                return {
                    subject: parsed.subject,
                    content: parsed.content,
                    industry: industry,
                    tone: tone,
                    structure: structure
                };
            } else {
                throw new Error("Invalid AI response structure");
            }
        } catch (parseError) {
            console.error("❌ Failed to parse AI response:", parseError.message);
            return generateProfessionalFallbackEmail(senderName, receiverName, industry, topic, challenge);
        }

    } catch (err) {
        console.error("❌ OpenAI Error:", err.message);
        return generateProfessionalFallbackEmail(senderName, receiverName, industry, topic, challenge);
    }
}

function generateProfessionalFallbackEmail(senderName, receiverName, industry, topic, challenge) {
    const professionalTemplates = [
        {
            subject: `Perspectives on ${topic} in ${industry}`,
            content: `Dear ${receiverName},

I hope this message finds you well. I've been following the evolving landscape of ${topic} within our ${industry} sector and was particularly impressed by the insights you've shared in our professional community.

The challenges around ${challenge} have been top of mind for many of us, and I'm curious about your perspective on balancing innovation with practical implementation. In my experience, the most successful approaches often involve ${getRandomItem(['strategic partnerships', 'incremental innovation', 'cross-functional collaboration', 'data-informed decision making'])}.

I'd be very interested to hear your thoughts on how you see ${topic} evolving over the next quarter, and what you believe will be the most significant factors driving successful outcomes.

Thank you for your time and consideration.

Best regards,
${senderName}`
        },
        {
            subject: `Navigating ${challenge} in Today's ${industry} Environment`,
            content: `Hello ${receiverName},

I'm reaching out because I've noticed our shared interest in addressing ${challenge} within the ${industry} space. Your professional approach to ${topic} particularly caught my attention.

As we both know, the current environment presents both significant opportunities and complex challenges. I've found that focusing on ${getRandomItem(['sustainable growth strategies', 'client-centric solutions', 'operational excellence', 'digital transformation'])} has been crucial for navigating these waters successfully.

I'd appreciate hearing about any insights you've gained recently regarding ${topic}, especially as it relates to long-term strategic positioning.

Looking forward to potentially exchanging more thoughts.

Warm regards,
${senderName}`
        },
        {
            subject: `Strategic Insights on ${industry} Evolution`,
            content: `Dear ${receiverName},

I hope this email finds you well. I've been admiring your strategic approach to ${topic} within our industry, and I believe our perspectives on ${challenge} might be well-aligned.

The intersection of ${topic} and market dynamics has created some fascinating opportunities for professionals like us who understand both the technical and business dimensions. I'm particularly interested in how organizations are leveraging ${getRandomItem(['emerging technologies', 'data analytics', 'strategic partnerships', 'talent development'])} to create sustainable advantage.

Would you be open to sharing your perspective on the most promising developments you're seeing in our space?

Thank you for considering this connection.

Sincerely,
${senderName}`
        }
    ];

    const email = getRandomItem(professionalTemplates);
    console.log(`🔄 Using professional fallback template`);
    return email;
}

async function generateReply(originalEmail) {
    console.log("Generating professional reply for:", {
        subject: originalEmail.subject,
        industry: originalEmail.industry || "general"
    });

    const prompt = `
Generate a highly professional and sophisticated email reply that demonstrates executive-level communication skills.

ORIGINAL EMAIL:
Subject: ${originalEmail.subject}
Content: ${originalEmail.content}
Industry Context: ${originalEmail.industry || "general"}

REPLY REQUIREMENTS:
1. Sound like an experienced industry professional
2. Acknowledge the sender's insights thoughtfully
3. Add value with your own relevant perspective
4. Demonstrate emotional intelligence and business acumen
5. Keep the conversation moving forward naturally
6. Maintain perfect professional etiquette
7. Length: 3-5 substantive sentences

STYLISTIC GUIDELINES:
- Use sophisticated but accessible business language
- Show appreciation for the sender's time and insights
- Provide thoughtful, relevant additions to the discussion
- Ask a follow-up question that shows engagement
- Avoid generic responses and clichés

Return JSON: {"reply_content": "your professional reply here"}
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [
                {
                    role: "system",
                    content: `You are a senior executive with excellent communication skills. You write replies that are insightful, professional, and build meaningful business relationships. Your responses demonstrate expertise while showing genuine interest in the sender's perspective.`
                },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const reply = completion.choices[0].message.content;

        try {
            const parsedReply = JSON.parse(reply);

            if (parsedReply.reply_content && parsedReply.reply_content.trim().length > 20) {
                console.log("✅ Generated professional reply");
                return parsedReply;
            } else {
                console.warn("⚠️ AI returned insufficient reply content");
                return generateProfessionalFallbackReply(originalEmail);
            }
        } catch (parseError) {
            console.error("❌ Failed to parse AI reply:", parseError.message);
            return generateProfessionalFallbackReply(originalEmail);
        }

    } catch (err) {
        console.error("❌ OpenAI Reply Error:", err.message);
        return generateProfessionalFallbackReply(originalEmail);
    }
}

function generateProfessionalFallbackReply(originalEmail) {
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
        reply_content: getRandomItem(professionalReplies),
        is_fallback: true
    };
}


async function generateReplyWithRetry(originalEmail, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            console.log(`🔄 Professional reply generation attempt ${attempt}/${maxRetries + 1}`);
            const result = await generateReply(originalEmail);

            if (result && result.reply_content && result.reply_content.trim().length > 20) {
                return result;
            }
        } catch (error) {
            console.error(`❌ Professional reply attempt ${attempt} failed:`, error.message);
        }

        if (attempt <= maxRetries) {
            const delayMs = 2000 * attempt; // Longer delays for quality
            console.log(`⏳ Retrying professional reply in ${delayMs / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    console.log(`🔄 Using professional fallback reply`);
    return generateProfessionalFallbackReply(originalEmail);
}


function getIndustryExpertise(industry) {
    const expertise = {
        technology: "digital transformation, cloud architecture, and emerging technologies",
        finance: "investment strategies, risk management, and financial innovation",
        healthcare: "healthcare technology, patient care models, and regulatory compliance",
        marketing: "brand strategy, digital marketing, and customer engagement",
        general: "business strategy, leadership, and operational excellence"
    };
    return expertise[industry] || expertise.general;
}

module.exports = {
    generateEmail,
    generateReply,
    generateReplyWithRetry,
    getIndustryExpertise
};