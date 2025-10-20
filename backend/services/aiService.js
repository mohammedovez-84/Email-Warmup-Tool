const OpenAI = require("openai")
const dotenv = require("dotenv")
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Array of different email templates to ensure variety
const emailTemplates = [
    "Introduce yourself and mention you came across their profile and were impressed by their work in the industry",
    "Talk about recent industry trends and ask for their perspective",
    "Mention a specific achievement or project you noticed and compliment them on it",
    "Discuss common challenges in the industry and ask how they're navigating them",
    "Share an interesting insight about the industry and ask for their thoughts",
    "Talk about the importance of networking in the field and express interest in connecting",
    "Mention a recent industry event or development and ask for their take on it"
];

// Array of different opening lines
const openingLines = [
    "I hope this email finds you well!",
    "I'm reaching out to connect with you.",
    "I came across your profile and was impressed by your work.",
    "I've been following developments in our industry and wanted to connect.",
    "I noticed we're both in the {industry} space and thought it would be great to connect.",
    "I've been admiring your contributions to the {industry} industry.",
    "As fellow professionals in {industry}, I thought it would be valuable to connect."
];

// Array of different closing lines
const closingLines = [
    "Looking forward to hearing your thoughts!",
    "I'd love to hear more about your perspective on this.",
    "Would be great to connect and exchange ideas sometime.",
    "Hope to hear from you soon!",
    "Looking forward to potentially collaborating in the future!",
    "I'm excited about the possibility of working together.",
    "Let me know if you'd be open to connecting further!"
];

function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

async function generateEmail(senderName, receiverName, industry) {
    const template = getRandomItem(emailTemplates);
    const opening = getRandomItem(openingLines).replace('{industry}', industry);
    const closing = getRandomItem(closingLines);

    const prompt = `
Generate a unique and professional warmup email with the following details:
- From: ${senderName}
- To: ${receiverName} 
- Industry: ${industry}
- Template direction: ${template}

Requirements:
- Use this opening: "${opening}"
- Use this closing: "${closing}"
- Make it sound natural and conversational
- Keep it between 50-150 words
- Vary the structure and content from previous emails
- Include specific but generic industry references
- Return JSON with "subject" and "content" fields

IMPORTANT: Make each email unique in content, structure, and wording.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a professional email writer. Generate unique, varied warmup emails. Always return valid JSON with 'subject' and 'content' fields."
                },
                { role: "user", content: prompt },
            ],
            temperature: 0.9, // Higher temperature for more variety
            max_tokens: 300,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;

        try {
            const parsed = JSON.parse(content);

            // Validate response
            if (parsed.subject && parsed.content) {
                console.log(`✅ Generated unique email: "${parsed.subject.substring(0, 50)}..."`);
                return parsed;
            } else {
                throw new Error("Missing subject or content in AI response");
            }
        } catch (parseError) {
            console.error("❌ Failed to parse AI response as JSON:", parseError.message);
            // Fallback with variety
            return generateFallbackEmail(senderName, receiverName, industry);
        }

    } catch (err) {
        console.error("❌ OpenAI Error:", err.message);
        return generateFallbackEmail(senderName, receiverName, industry);
    }
}

function generateFallbackEmail(senderName, receiverName, industry) {
    const templates = [
        {
            subject: `Connecting from ${senderName}`,
            content: `Hi ${receiverName}, ${getRandomItem(openingLines).replace('{industry}', industry)} I noticed we're both in the ${industry} space and thought it would be great to connect. Would be wonderful to exchange thoughts on recent industry developments. ${getRandomItem(closingLines)} Best, ${senderName}`
        },
        {
            subject: `Industry insights from ${industry}`,
            content: `Hello ${receiverName}, ${getRandomItem(openingLines).replace('{industry}', industry)} I've been following the latest trends in ${industry} and would value your perspective. It's always helpful to connect with others who understand the landscape. ${getRandomItem(closingLines)} Warm regards, ${senderName}`
        },
        {
            subject: `Networking in ${industry}`,
            content: `Hi ${receiverName}, ${getRandomItem(openingLines).replace('{industry}', industry)} As professionals in ${industry}, building connections is so important. I'd love to hear about your experiences and share some of mine. ${getRandomItem(closingLines)} Cheers, ${senderName}`
        },
        {
            subject: `Great to connect in ${industry}`,
            content: `Dear ${receiverName}, ${getRandomItem(openingLines).replace('{industry}', industry)} The ${industry} field is evolving so quickly - always valuable to connect with others navigating the same changes. ${getRandomItem(closingLines)} All the best, ${senderName}`
        }
    ];

    const email = getRandomItem(templates);
    console.log(`🔄 Using fallback email template`);
    return email;
}

async function generateReply(originalEmail) {
    console.log("Generating reply for:", {
        subject: originalEmail.subject,
        content_preview: originalEmail.content?.substring(0, 100) + '...'
    });

    const prompt = `
Generate a professional email reply to the following message. Return ONLY JSON with "reply_content" field.

Original Email:
Subject: ${originalEmail.subject}
Content: ${originalEmail.content}

Requirements:
- Keep it warm, friendly, and professional
- Sound like a natural human response
- Vary your reply style and content
- Mention something specific from their email
- Keep it concise (2-4 sentences)
- Return valid JSON: {"reply_content": "your reply here"}
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a professional email assistant. Always return valid JSON with "reply_content" field. Vary your response style.`
                },
                { role: "user", content: prompt },
            ],
            temperature: 0.8,
            response_format: { type: "json_object" }
        });

        const reply = completion.choices[0].message.content;

        try {
            const parsedReply = JSON.parse(reply);

            if (parsedReply.reply_content && parsedReply.reply_content.trim().length > 10) {
                console.log("✅ Generated unique reply");
                return parsedReply;
            } else {
                console.warn("⚠️ AI returned empty reply_content");
                return generateFallbackReply(originalEmail);
            }
        } catch (parseError) {
            console.error("❌ Failed to parse AI reply:", parseError.message);
            return generateFallbackReply(originalEmail);
        }

    } catch (err) {
        console.error("❌ OpenAI Reply Error:", err.message);
        return generateFallbackReply(originalEmail);
    }
}

function generateFallbackReply(originalEmail) {
    const fallbacks = [
        `Thanks for your email! ${originalEmail.subject} sounds interesting. I'd love to hear more about your thoughts on this.`,
        `Appreciate you reaching out about ${originalEmail.subject?.toLowerCase() || 'this'}. Looking forward to learning more.`,
        `Thanks for connecting! ${originalEmail.content?.includes('industry') ? 'The industry insights you shared are valuable.' : 'Your message is much appreciated.'}`,
        `Great to hear from you! ${originalEmail.content?.includes('project') ? 'The project you mentioned sounds fascinating.' : 'I appreciate you taking the time to connect.'}`,
        `Thanks for your message! ${originalEmail.content?.includes('collaborat') ? 'Collaboration sounds like a wonderful idea.' : 'It would be great to exchange more ideas soon.'}`
    ];

    return {
        reply_content: getRandomItem(fallbacks),
        is_fallback: true
    };
}

// Enhanced version with retry logic
async function generateReplyWithRetry(originalEmail, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            console.log(`🔄 Reply generation attempt ${attempt}/${maxRetries + 1}`);
            const result = await generateReply(originalEmail);

            if (result && result.reply_content && result.reply_content.trim().length > 10) {
                return result;
            }
        } catch (error) {
            console.error(`❌ Attempt ${attempt} failed:`, error.message);
        }

        if (attempt <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }

    return generateFallbackReply(originalEmail);
}

module.exports = {
    generateEmail,
    generateReply,
    generateReplyWithRetry
};