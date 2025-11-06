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

class EmailGenerationService {
    constructor() {
        this.templates = this.initializeTemplates();
    }

    generateHashCode() {
        const part1 = crypto.randomBytes(8).toString('base64').replace(/[+/=]/g, '').substring(0, 9);
        const part2 = crypto.randomBytes(8).toString('base64').replace(/[+/=]/g, '').substring(0, 9);
        return `${part1} ${part2}`;
    }

    initializeTemplates() {
        return {
            "professional-intro": {
                subject: "Exploring Potential Collaboration",
                template: (senderName, receiverName, industryData) => {
                    const topic = this.getRandomItem(industryData.topics);
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

    <div class="paragraph">I hope this message finds you well.</div>

    <div class="paragraph">I wanted to reach out and introduce myself and my outbound sales team. We specialize in email outreach and have achieved strong engagement results with decision-makers. While going through professionals in ${topic}, your profile stood out and I thought there might be an opportunity for us to connect.</div>

    <div class="paragraph">Would you be open to a short conversation to explore possible collaboration opportunities?</div>

    <div class="paragraph">Looking forward to hearing from you.</div>

    <div class="signature">
        Best regards,<br>
        <strong>${senderName}</strong>
    </div>

    <div class="hashcode">${this.generateHashCode()}</div>
</body>
</html>`;
                }
            },

            "direct-approach": {
                subject: "Quick Introduction and Possible Synergies",
                template: (senderName, receiverName, industryData) => {
                    const topic = this.getRandomItem(industryData.topics);
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
    <div class="paragraph">Hi ${receiverName},</div>

    <div class="paragraph">I came across your work in ${topic} and was really impressed by your professional background.</div>

    <div class="paragraph">Our team helps businesses strengthen their outbound strategies and improve engagement outcomes. I believe there could be meaningful synergies between what we do and your ongoing initiatives.</div>

    <div class="paragraph">Would you be open to a short call to explore how we could support each other?</div>

    <div class="signature">
        Regards,<br>
        <strong>${senderName}</strong>
    </div>

    <div class="hashcode">${this.generateHashCode()}</div>
</body>
</html>`;
                }
            },

            "value-proposition": {
                subject: "Opportunity to Connect and Collaborate",
                template: (senderName, receiverName, industryData) => {
                    const challenge = this.getRandomItem(industryData.challenges);
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

    <div class="paragraph">I hope you're doing well.</div>

    <div class="paragraph">I've been following recent developments around ${challenge} and thought our expertise might align. My team has been working with professionals who face similar challenges, and together we've achieved measurable improvements in outreach success.</div>

    <div class="paragraph">If it makes sense, I'd love to schedule a quick chat to see how our experience might be useful to your work.</div>

    <div class="signature">
        Best,<br>
        <strong>${senderName}</strong>
    </div>

    <div class="hashcode">${this.generateHashCode()}</div>
</body>
</html>`;
                }
            },

            "industry-specific": {
                subject: "Exploring Common Interests in ${industryData.topics[0]}",
                template: (senderName, receiverName, industryData) => {
                    const topic = this.getRandomItem(industryData.topics);
                    const challenge = this.getRandomItem(industryData.challenges);
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
    <div class="paragraph">Hi ${receiverName},</div>

    <div class="paragraph">I came across your recent work in ${topic}, especially your perspective on ${challenge}. It’s great to see professionals addressing these important topics.</div>

    <div class="paragraph">Our team focuses on creating effective outreach and relationship-building strategies for industry leaders. I believe we could exchange valuable insights or even collaborate on a few initiatives.</div>

    <div class="paragraph">Would you be open to a brief call sometime this week?</div>

    <div class="signature">
        Warm regards,<br>
        <strong>${senderName}</strong>
    </div>

    <div class="hashcode">${this.generateHashCode()}</div>
</body>
</html>`;
                }
            }
        };
    }

    generateEmail(senderName, receiverName, industry = "general") {
        const industryData = industryContexts[industry] || industryContexts.general;
        const templateKeys = Object.keys(this.templates);
        const selectedTemplate = this.getRandomItem(templateKeys);
        const template = this.templates[selectedTemplate];

        return {
            subject: template.subject,
            content: template.template(senderName, receiverName, industryData),
            industry: industry,
            provider: 'template',
            format: 'html',
            hashCode: this.generateHashCode()
        };
    }

    generateReply(originalEmail) {
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
    <div class="paragraph">Thank you for reaching out. I appreciate the introduction and the clear overview of what your team does.</div>

    <div class="paragraph">I'd be interested in learning more about your approach. Could we set up a short call next week to discuss this further?</div>

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

</style>
</head>
<body>
    <div class="paragraph">Thanks for connecting and sharing what your team focuses on. Your results sound impressive.</div>

    <div class="paragraph">I'm open to exploring potential ways we could work together. Feel free to suggest a suitable time for a quick discussion.</div>

    <div class="signature">
        Regards
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
    <div class="paragraph">Appreciate your message and the detailed introduction.</div>

    <div class="paragraph">Your experience sounds relevant to some of our current projects. Let’s arrange a short call to see if there’s a fit.</div>

    <div class="signature">
        Best
    </div>

    <div class="hashcode">${this.generateHashCode()}</div>
</body>
</html>`
        ];

        return {
            reply_content: this.getRandomItem(replyTemplates),
            provider: 'template',
            format: 'html',
            hashCode: this.generateHashCode()
        };
    }

    getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    generateReplyWithRetry(originalEmail, maxRetries = 2) {
        return this.generateReply(originalEmail);
    }
}

const emailService = new EmailGenerationService();

module.exports = {
    generateEmail: (senderName, receiverName, industry) =>
        emailService.generateEmail(senderName, receiverName, industry),

    generateReply: (originalEmail) =>
        emailService.generateReply(originalEmail),

    generateReplyWithRetry: (originalEmail, maxRetries) =>
        emailService.generateReplyWithRetry(originalEmail, maxRetries),

    generateHashCode: () => emailService.generateHashCode()
};
