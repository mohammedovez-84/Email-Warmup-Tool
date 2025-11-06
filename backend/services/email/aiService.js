const axios = require('axios');
const crypto = require('crypto');

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

    generateHashCode() {
        const part1 = crypto.randomBytes(8).toString('base64').replace(/[+/=]/g, '').substring(0, 9);
        const part2 = crypto.randomBytes(8).toString('base64').replace(/[+/=]/g, '').substring(0, 9);
        return `${part1} ${part2}`;
    }

    async generateEmail(senderName, receiverName, industry = "general") {
        try {
            const industryData = industryContexts[industry] || industryContexts.general;
            const topic = industryData.topics[Math.floor(Math.random() * industryData.topics.length)];
            const challenge = industryData.challenges[Math.floor(Math.random() * industryData.challenges.length)];

            const receiverFirst = receiverName.split(' ')[0];

            const prompt = `Write a concise, professional email to ${receiverName}. Introduce yourself and your outbound sales team that helps companies connect with decision-makers effectively. Express genuine interest in exploring possible collaboration or synergies, and offer to schedule a short demo call. Keep it warm, credible, and naturally conversational.`;

            const aiResponse = await this.generateWithAI(prompt);

            if (aiResponse && aiResponse.length > 20) {
                const cleanResponse = this.cleanAIResponse(aiResponse, receiverName);
                return {
                    subject: "Exploring a Potential Collaboration",
                    content: this.formatEmail(cleanResponse, senderName, receiverName),
                    provider: 'ai',
                    format: 'html',
                    hashCode: this.generateHashCode()
                };
            }

            return this.generateTemplateEmail(senderName, receiverName, industry, topic, challenge);

        } catch (error) {
            console.log('AI generation failed, using template');
            return this.generateTemplateEmail(senderName, receiverName, industry);
        }
    }

    async generateWithAI(prompt) {
        if (!this.huggingFaceApiKey) {
            console.log('❌ No HuggingFace API key found');
            return null;
        }

        try {
            console.log('🤖 Attempting HuggingFace API call...');
            console.log('🔑 API Key present:', !!this.huggingFaceApiKey);
            console.log('📝 Prompt length:', prompt.length);
            console.log('🔍 Using model:', this.freeModels[0]);

            const model = this.freeModels[0];

            // 🚨 TEST DIFFERENT ENDPOINTS
            const endpoints = [
                `https://router.huggingface.co/hf-inference/models/${model}`,
                `https://router.huggingface.co/hf-inference/models/${model}/generate`,
                `https://router.huggingface.co/hf-inference/models/${model}/completion`
            ];

            let lastError = null;

            for (const endpoint of endpoints) {
                try {
                    console.log(`🔄 Trying endpoint: ${endpoint}`);

                    const response = await axios.post(
                        endpoint,
                        {
                            inputs: prompt,
                            parameters: {
                                max_new_tokens: 150,
                                temperature: 0.8,
                                do_sample: true,
                                return_full_text: false
                            }
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${this.huggingFaceApiKey}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 30000
                        }
                    );

                    console.log('✅ HuggingFace API call successful!');
                    console.log('📦 Response status:', response.status);
                    console.log('📦 Response data:', response.data);

                    return response.data?.[0]?.generated_text || null;

                } catch (endpointError) {
                    lastError = endpointError;
                    console.log(`❌ Endpoint failed: ${endpoint}`);
                    console.log(`   Status: ${endpointError.response?.status}`);
                    console.log(`   Message: ${endpointError.message}`);

                    // If it's a 410, continue to next endpoint
                    if (endpointError.response?.status === 410) {
                        continue;
                    }

                    // For other errors, break and return
                    break;
                }
            }

            console.log('❌ All HuggingFace endpoints failed');
            if (lastError) {
                console.log('📋 Last error details:', {
                    status: lastError.response?.status,
                    statusText: lastError.response?.statusText,
                    data: lastError.response?.data,
                    message: lastError.message
                });
            }

            return null;

        } catch (error) {
            console.log('💥 HuggingFace API error:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message,
                code: error.code
            });
            return null;
        }
    }

    cleanAIResponse(text, receiverName) {
        let cleaned = text
            .replace(/Write a concise.*?\./g, '')
            .replace(/^(From|To|Subject):.*$/gim, '')
            .replace(/["']/g, '')
            .trim();

        if (!cleaned.toLowerCase().includes('hello ') && !cleaned.toLowerCase().includes('dear ')) {
            cleaned = `Hello ${receiverName},\n\n${cleaned}`;
        }

        return cleaned.substring(0, 500);
    }

    generateTemplateEmail(senderName, receiverName, industry, topic, challenge) {
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
<div class="paragraph">Hello ${receiverName},</div>

<div class="paragraph">I hope you're doing well.</div>

<div class="paragraph">I'm ${senderName}, and I lead an outbound sales team that helps businesses connect with key decision-makers effectively. We’ve consistently achieved a 96% success rate through personalized outreach and strategic targeting.</div>

<div class="paragraph">I came across your profile while exploring professionals working in ${usedTopic}, and I believe there might be some meaningful opportunities for collaboration — especially around ${usedChallenge}.</div>

<div class="paragraph">Would you be open to a quick 15-minute call next week to explore how we could work together?</div>

<div class="paragraph">Looking forward to hearing from you.</div>

<div class="signature">
Best regards,<br>
<strong>${senderName}</strong>
</div>

<div class="hashcode">${this.generateHashCode()}</div>
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
<div class="paragraph">Hello ${receiverName},</div>

<div class="paragraph">I hope this message finds you well.</div>

<div class="paragraph">I wanted to briefly introduce myself — I'm ${senderName}, and I manage a sales outreach team that’s been helping companies enhance their engagement with decision-makers. We’ve been fortunate to maintain a strong success rate through consistent, data-driven campaigns.</div>

<div class="paragraph">Given your experience in ${usedTopic}, I thought it might make sense to connect and see if there’s potential for collaboration, particularly around ${usedChallenge}.</div>

<div class="paragraph">Would you be available for a short intro call this week?</div>

<div class="signature">
Kind regards,<br>
<strong>${senderName}</strong>
</div>

<div class="hashcode">${this.generateHashCode()}</div>
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
<div class="paragraph">Hi ${receiverName},</div>

<div class="paragraph">Hope you’re doing great.</div>

<div class="paragraph">I came across your work in ${usedTopic}, and it immediately caught my attention. My team specializes in outbound sales operations, helping brands streamline their outreach and drive stronger engagement rates — currently averaging around 96% success.</div>

<div class="paragraph">I’d love to exchange ideas and explore if there’s a fit for potential collaboration, especially considering the challenges in ${usedChallenge}.</div>

<div class="paragraph">Would you be open to a quick discussion sometime this week?</div>

<div class="signature">
Sincerely,<br>
<strong>${senderName}</strong>
</div>

<div class="hashcode">${this.generateHashCode()}</div>
</body>
</html>`
        ];

        return {
            subject: "Exploring a Potential Collaboration",
            content: templates[Math.floor(Math.random() * templates.length)],
            provider: 'ai-template',
            format: 'html',
            hashCode: this.generateHashCode()
        };
    }

    formatEmail(content, senderName, receiverName) {
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
<div class="paragraph">Hello ${receiverName},</div>

${htmlContent}

<div class="signature">
Best regards,<br>
<strong>${senderName}</strong>
</div>

<div class="hashcode">${this.generateHashCode()}</div>
</body>
</html>`;
    }

    async generateReply(originalEmail) {
        const replyTemplates = [
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
<div class="paragraph">Thanks for reaching out, I appreciate your message.</div>

<div class="paragraph">Your team’s results sound impressive. I’d be happy to learn more about your process and discuss potential ways we could work together.</div>

<div class="paragraph">Would you be available for a short call early next week?</div>

<div class="signature">
Best regards
</div>

<div class="hashcode">${this.generateHashCode()}</div>
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
.hashcode { margin-top: 30px; font-size: 12px; color: #666; font-family: monospace; }
</style>
</head>
<body>
<div class="paragraph">Appreciate your introduction, and I’m impressed with your team’s outreach results.</div>

<div class="paragraph">I’d be open to exploring potential collaboration and understanding your approach better. A quick demo or discussion could be helpful.</div>

<div class="paragraph">Let me know a convenient time that works for you.</div>

<div class="signature">
Kind regards
</div>

<div class="hashcode">${this.generateHashCode()}</div>
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
<div class="paragraph">Thank you for connecting, and great to learn about your team’s experience with outreach.</div>

<div class="paragraph">I’d be happy to explore this further. How about we schedule a short introductory call to discuss potential synergies?</div>

<div class="paragraph">Looking forward to hearing from you.</div>

<div class="signature">
Sincerely
</div>

<div class="hashcode">${this.generateHashCode()}</div>
</body>
</html>`
        ];

        return {
            reply_content: replyTemplates[Math.floor(Math.random() * replyTemplates.length)],
            provider: 'ai',
            format: 'html',
            hashCode: this.generateHashCode()
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
        new AIService().generateReplyWithRetry(originalEmail),

    generateHashCode: () => new AIService().generateHashCode()
};
