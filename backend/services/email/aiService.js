const axios = require('axios');

const industryContexts = {
    technology: {
        topics: ["AI implementation", "Cloud migration", "Cybersecurity", "DevOps"],
        challenges: ["Technical debt", "Security threats", "Talent shortage"]
    },
    finance: {
        topics: ["Portfolio optimization", "Risk management", "Fintech innovation"],
        challenges: ["Market volatility", "Digital transformation", "Compliance costs"]
    },
    healthcare: {
        topics: ["Telemedicine", "Data interoperability", "Patient engagement"],
        challenges: ["Privacy compliance", "Cost management", "Technology adoption"]
    },
    general: {
        topics: ["Business strategy", "Operational efficiency", "Innovation management"],
        challenges: ["Market disruption", "Scaling operations", "Competitive advantage"]
    }
};

class AIService {
    constructor() {
        this.huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
        this.freeModels = ['microsoft/DialoGPT-medium', 'gpt2', 'distilgpt2'];
    }

    async generateEmail(senderName, receiverName, industry = "general") {
        try {
            const industryData = industryContexts[industry] || industryContexts.general;
            const topic = industryData.topics[Math.floor(Math.random() * industryData.topics.length)];
            const challenge = industryData.challenges[Math.floor(Math.random() * industryData.challenges.length)];

            const receiverFirst = receiverName.split(' ')[0];

            const prompt = `Write a short professional email (2-3 sentences max) to ${receiverFirst} about ${topic} and ${challenge}. Keep it concise and direct.`;

            const aiResponse = await this.generateWithAI(prompt);

            if (aiResponse && aiResponse.length > 20) {
                const cleanResponse = this.cleanAIResponse(aiResponse, receiverFirst);
                return {
                    subject: `Your work on ${topic}`,
                    content: this.formatEmail(cleanResponse, senderName, receiverFirst),
                    provider: 'ai',
                    format: 'html'
                };
            }

            // Fallback template
            return this.generateTemplateEmail(senderName, receiverName, industry, topic, challenge);

        } catch (error) {
            console.log('AI generation failed, using template');
            return this.generateTemplateEmail(senderName, receiverName, industry);
        }
    }

    async generateWithAI(prompt) {
        if (!this.huggingFaceApiKey) return null;

        try {
            const model = this.freeModels[0];
            const response = await axios.post(
                `https://api-inference.huggingface.co/models/${model}`,
                {
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 60,
                        temperature: 0.7,
                        do_sample: true
                    }
                },
                {
                    headers: { 'Authorization': `Bearer ${this.huggingFaceApiKey}` },
                    timeout: 15000
                }
            );

            return response.data?.[0]?.generated_text || null;
        } catch (error) {
            return null;
        }
    }

    cleanAIResponse(text, receiverFirst) {
        let cleaned = text
            .replace(/Write a short professional email.*?\./g, '')
            .replace(/^(From|To|Subject):.*$/gim, '')
            .trim();

        if (!cleaned.toLowerCase().includes('hi ') && !cleaned.toLowerCase().includes('hello ')) {
            cleaned = `Hi ${receiverFirst},\n\n${cleaned}`;
        }

        return cleaned.substring(0, 200);
    }

    generateTemplateEmail(senderName, receiverName, industry, topic, challenge) {
        const receiverFirst = receiverName.split(' ')[0];
        const industryData = industryContexts[industry] || industryContexts.general;
        const usedTopic = topic || industryData.topics[0];
        const usedChallenge = challenge || industryData.challenges[0];

        const templates = [
            `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .paragraph { margin-bottom: 16px; }
        .signature { margin-top: 20px; }
    </style>
</head>
<body>
    <div class="paragraph">Hi ${receiverFirst},</div>
    
    <div class="paragraph">Your work on ${usedTopic} is impressive.</div>
    
    <div class="paragraph">Would you share your approach to ${usedChallenge}? A brief chat would help.</div>
    
    <div class="signature">
        Best,<br>
        <strong>${senderName}</strong>
    </div>
</body>
</html>`,

            `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .paragraph { margin-bottom: 16px; }
        .signature { margin-top: 20px; }
    </style>
</head>
<body>
    <div class="paragraph">Hi ${receiverFirst},</div>
    
    <div class="paragraph">I admire your results in ${usedTopic}.</div>
    
    <div class="paragraph">Open to discussing ${usedChallenge}? Your perspective would be valuable.</div>
    
    <div class="signature">
        Best,<br>
        <strong>${senderName}</strong>
    </div>
</body>
</html>`,

            `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .paragraph { margin-bottom: 16px; }
        .signature { margin-top: 20px; }
    </style>
</head>
<body>
    <div class="paragraph">Hi ${receiverFirst},</div>
    
    <div class="paragraph">Your approach to ${usedChallenge} stands out.</div>
    
    <div class="paragraph">Could we connect briefly about ${usedTopic}? Your insights would help.</div>
    
    <div class="signature">
        Best,<br>
        <strong>${senderName}</strong>
    </div>
</body>
</html>`
        ];

        return {
            subject: `Your ${usedTopic} work`,
            content: templates[Math.floor(Math.random() * templates.length)],
            provider: 'ai-template',
            format: 'html'
        };
    }

    formatEmail(content, senderName, receiverFirst) {
        const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
        let htmlContent = '';

        paragraphs.forEach(paragraph => {
            htmlContent += `<div class="paragraph">${paragraph.trim()}</div>\n\n`;
        });

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .paragraph { margin-bottom: 16px; }
        .signature { margin-top: 20px; }
    </style>
</head>
<body>
    ${htmlContent}
    <div class="signature">
        Best,<br>
        <strong>${senderName}</strong>
    </div>
</body>
</html>`;
    }

    async generateReply(originalEmail) {
        return {
            reply_content: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .paragraph { margin-bottom: 16px; }
        .signature { margin-top: 20px; }
    </style>
</head>
<body>
    <div class="paragraph">Thanks for your email. Your perspective is valuable.</div>
    
    <div class="paragraph">Would you be open to a brief call next week?</div>
    
    <div class="signature">
        Best regards
    </div>
</body>
</html>`,
            provider: 'ai',
            format: 'html'
        };
    }

    async generateReplyWithRetry(originalEmail, maxRetries = 2) {
        return this.generateReply(originalEmail);
    }
}

module.exports = {
    generateEmail: (senderName, receiverName, industry) =>
        new AIService().generateEmail(senderName, receiverName, industry),

    generateReplyWithRetry: (originalEmail) =>
        new AIService().generateReplyWithRetry(originalEmail)
};