const industryContexts = {
    technology: {
        topics: ["AI implementation", "Cloud migration", "Cybersecurity"],
        challenges: ["Technical debt", "Security threats", "Talent shortage"]
    },
    finance: {
        topics: ["Portfolio optimization", "Risk management", "Fintech innovation"],
        challenges: ["Market volatility", "Digital transformation", "Compliance"]
    },
    healthcare: {
        topics: ["Telemedicine", "Data interoperability", "Patient care"],
        challenges: ["Privacy compliance", "Cost management", "Technology adoption"]
    },
    general: {
        topics: ["Business strategy", "Operational efficiency", "Innovation"],
        challenges: ["Market disruption", "Scaling operations", "Growth balance"]
    }
};

class TemplateEmailService {
    generateEmail(senderName, receiverName, industry = "general") {
        const industryData = industryContexts[industry] || industryContexts.general;
        const topic = this.getRandomItem(industryData.topics);
        const challenge = this.getRandomItem(industryData.challenges);
        const receiverFirst = receiverName.split(' ')[0];

        const templates = {
            "direct-question": {
                subject: `Your work on ${topic}`,
                content: `<!DOCTYPE html>
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
    
    <div class="paragraph">I admire your results in ${topic}.</div>
    
    <div class="paragraph">Open to discussing ${challenge}? Your perspective would be valuable.</div>
    
    <div class="signature">
        Best,<br>
        <strong>${senderName}</strong>
    </div>
</body>
</html>`
            },
            "compliment-request": {
                subject: `Your ${industry} expertise`,
                content: `<!DOCTYPE html>
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
    
    <div class="paragraph">Your approach to ${challenge} is impressive.</div>
    
    <div class="paragraph">Could we connect briefly about ${topic}?</div>
    
    <div class="signature">
        Best,<br>
        <strong>${senderName}</strong>
    </div>
</body>
</html>`
            },
            "shared-challenge": {
                subject: `${topic} strategies`,
                content: `<!DOCTYPE html>
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
    
    <div class="paragraph">Your work on ${challenge} stands out.</div>
    
    <div class="paragraph">Open to sharing your approach? A quick call would help.</div>
    
    <div class="signature">
        Best,<br>
        <strong>${senderName}</strong>
    </div>
</body>
</html>`
            },
            "industry-focus": {
                subject: `Your ${industry} perspective`,
                content: `<!DOCTYPE html>
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
    
    <div class="paragraph">Your insights on ${topic} are notable.</div>
    
    <div class="paragraph">Would you share your thoughts on ${challenge}? Brief chat possible?</div>
    
    <div class="signature">
        Best,<br>
        <strong>${senderName}</strong>
    </div>
</body>
</html>`
            }
        };

        const templateKey = this.getRandomItem(Object.keys(templates));
        const email = templates[templateKey];

        return {
            subject: email.subject,
            content: email.content,
            industry: industry,
            provider: 'template',
            format: 'html'
        };
    }

    generateReply(originalEmail) {
        const shortReplies = [
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
    <div class="paragraph">Thanks for your email. Your perspective is valuable.</div>
    
    <div class="paragraph">Would you be open to a brief call next week?</div>
    
    <div class="signature">
        Best regards
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
    <div class="paragraph">Appreciate you reaching out. Your insights align with our focus areas.</div>
    
    <div class="paragraph">Let me know if a quick call next week works for you.</div>
    
    <div class="signature">
        Best
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
    <div class="paragraph">Thank you for the email. Your approach sounds interesting.</div>
    
    <div class="paragraph">Happy to connect briefly. What timing works for you?</div>
    
    <div class="signature">
        Best
    </div>
</body>
</html>`
        ];

        return {
            reply_content: this.getRandomItem(shortReplies),
            provider: 'template',
            format: 'html'
        };
    }

    getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    generateReplyWithRetry(originalEmail, maxRetries = 2) {
        return this.generateReply(originalEmail);
    }
}

// Contextual email generator with HTML
function generateContextualEmail(senderName, receiverName, industry, specificContext) {
    const industryData = industryContexts[industry] || industryContexts.general;
    const receiverFirst = receiverName.split(' ')[0];

    return {
        subject: `Your work on ${specificContext.achievement || industryData.topics[0]}`,
        content: `<!DOCTYPE html>
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
    
    <div class="paragraph">Your approach to ${specificContext.methodology || industryData.challenges[0]} is impressive.</div>
    
    <div class="paragraph">Open to a brief chat about ${specificContext.question || industryData.topics[0]}?</div>
    
    <div class="signature">
        Best,<br>
        <strong>${senderName}</strong>
    </div>
</body>
</html>`
    };
}

const emailService = new TemplateEmailService();

module.exports = {
    generateEmail: (senderName, receiverName, industry) =>
        emailService.generateEmail(senderName, receiverName, industry),

    generateReply: (originalEmail) =>
        emailService.generateReply(originalEmail),

    generateReplyWithRetry: (originalEmail, maxRetries) =>
        emailService.generateReplyWithRetry(originalEmail, maxRetries),

    generateContextualEmail: (senderName, receiverName, industry, specificContext) =>
        generateContextualEmail(senderName, receiverName, industry, specificContext)
};