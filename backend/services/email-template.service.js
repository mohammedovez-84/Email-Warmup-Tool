// services/template-email-service.js
class TemplateEmailService {
    constructor() {
        this.templates = this.initializeTemplates();
        console.log(`✅ Template system ready with natural, human-like email templates`);
    }

    initializeTemplates() {
        return {
            casual: this.generateCasualTemplates(50),
            professional: this.generateProfessionalTemplates(30),
            friendly: this.generateFriendlyTemplates(20)
        };
    }

    generateCasualTemplates(count) {
        const templates = [];

        const subjects = [
            "Hey {receiver_first} 👋",
            "Quick question",
            "Following up",
            "Checking in",
            "Hope you're doing well",
            "Quick connect",
            "Came across your profile",
            "Loved your work on {topic}",
            "Inspired by your approach",
            "Had to reach out"
        ];

        const openings = [
            "I hope everything is going well for you",
            "Sending good vibes your way for the day",
            "Hope you're having a productive week",
            "Quick note coming your way",
            "Just wanted to touch base",
            "Hope this email finds you well",
            "Wanted to quickly connect",
            "Reaching out with a quick thought",
            "Came across your work and had to reach out",
            "Hope you're doing amazing"
        ];

        const bodies = [
            "I've been testing out {product} and I'm blown away by its capabilities. How about we work together to see what kind of results we can get?",
            "As someone in the {industry} space, I'm sure you know the importance of {topic}. That's why I wanted to see if you'd be interested in discussing how we can help improve your results.",
            "I noticed we're both interested in {topic} and thought it would be great to connect. Would you be open to sharing experiences?",
            "Been following your work on {topic} and really impressed with your approach. Would love to learn more about your process.",
            "I've been experimenting with {approach} lately and getting some interesting results. Thought you might find it valuable given your work in {industry}.",
            "Came across your profile while researching {topic} and was really impressed. Would you be open to a quick chat about shared interests?",
            "I've been working on some exciting developments in {area} and thought you might find them interesting given your expertise.",
            "Been meaning to connect with fellow {industry} professionals. Would you be open to sharing insights and experiences?",
            "I've found some interesting patterns in {topic} recently and thought you might have valuable perspectives to share.",
            "Working on something exciting in {area} and thought you'd be the perfect person to get feedback from."
        ];

        const closings = [
            "Can't wait to hear your thoughts",
            "Would love to get your perspective",
            "Looking forward to connecting",
            "Hope to hear from you soon",
            "Would appreciate your thoughts",
            "Let me know what you think",
            "Excited to hear your take",
            "Would value your input",
            "Looking forward to your reply",
            "Can't wait to connect"
        ];

        const signatures = [
            "Best,\n{sender}",
            "Cheers,\n{sender}",
            "Thanks,\n{sender}",
            "All the best,\n{sender}",
            "Talk soon,\n{sender}",
            "Warm regards,\n{sender}",
            "Appreciate you,\n{sender}",
            "Looking forward,\n{sender}",
            "Best wishes,\n{sender}",
            "Take care,\n{sender}"
        ];

        for (let i = 0; i < count; i++) {
            templates.push({
                id: `casual_${i}`,
                type: 'casual',
                subject: this.getRandomItem(subjects),
                opening: this.getRandomItem(openings),
                body: this.getRandomItem(bodies),
                closing: this.getRandomItem(closings),
                signature: this.getRandomItem(signatures),
                variables: {
                    product: ['Frintent', 'this new tool', 'our platform', 'this software', 'the system'][i % 5],
                    industry: ['eCommerce', 'tech', 'marketing', 'sales', 'business'][i % 5],
                    topic: ['outbound sales', 'conversion rates', 'growth strategies', 'team collaboration', 'digital transformation'][i % 5],
                    approach: ['this new method', 'a different approach', 'innovative strategies', 'creative solutions', 'unique techniques'][i % 5],
                    area: ['AI tools', 'automation', 'team efficiency', 'client engagement', 'process optimization'][i % 5]
                }
            });
        }

        return templates;
    }

    generateProfessionalTemplates(count) {
        const templates = [];

        const subjects = [
            "Quick question about {topic}",
            "Following up on {project}",
            "Would love your thoughts on {idea}",
            "Connecting re: {opportunity}",
            "Quick chat about {subject}?",
            "Your insights on {topic}",
            "Potential collaboration",
            "Industry insights exchange",
            "Professional connection",
            "Mutual interests in {area}"
        ];

        // ... similar structure for professional templates
        return templates;
    }

    generateFriendlyTemplates(count) {
        const templates = [];

        const subjects = [
            "Hey {receiver_first}! 👋",
            "Quick hello",
            "Thinking of you",
            "Had to share this",
            "You came to mind",
            "Quick thought",
            "Inspired by your work",
            "Loved your recent post",
            "Your work is amazing!",
            "We should connect"
        ];

        // ... similar structure for friendly templates
        return templates;
    }

    getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    extractFirstName(fullName) {
        return fullName.split(' ')[0] || fullName;
    }

    async generateEmail(senderName, receiverName, industry = "general") {
        console.log('📧 Generating natural, human-like email...');

        const templateType = this.getRandomItem(['casual', 'professional', 'friendly']);
        const templates = this.templates[templateType];
        const template = this.getRandomItem(templates);

        const receiverFirst = this.extractFirstName(receiverName);
        const senderFirst = this.extractFirstName(senderName);

        // Replace variables
        let subject = template.subject.replace(/{receiver_first}/g, receiverFirst);
        let body = template.body;

        for (const [key, value] of Object.entries(template.variables)) {
            subject = subject.replace(new RegExp(`{${key}}`, 'g'), value);
            body = body.replace(new RegExp(`{${key}}`, 'g'), value);
        }

        // Build the email
        const emailContent = `${template.opening}\n\n${body}\n\n${template.closing}\n\n${template.signature.replace(/{sender}/g, senderName)}`;

        // Add random personal touches
        const finalEmail = this.addPersonalTouches(emailContent);

        console.log(`✅ Generated ${templateType} email: "${subject}"`);

        return {
            subject: subject,
            content: finalEmail,
            style: templateType,
            provider: 'template'
        };
    }

    addPersonalTouches(content) {
        // Add some natural variations
        const variations = [
            "\n\nPS. Let me know if you have any questions!",
            "\n\nPS. Would love to hear what you're working on these days!",
            "\n\nPS. Hope you're having a great week!",
            "\n\nPS. Excited to hear your thoughts!",
            "" // Sometimes no PS
        ];

        return content + this.getRandomItem(variations);
    }

    async generateReply(originalEmail) {
        console.log('📧 Generating natural reply...');

        const replyStyles = [
            // Casual reply
            `Hey {sender_first} 👋\n\nThanks for reaching out! {original_subject} sounds interesting.\n\n{response}\n\nLooking forward to connecting!\n\nBest,\n{receiver}`,

            // Friendly reply  
            `Hi {sender_first}!\n\nAppreciate you getting in touch about {original_subject}. {response}\n\nWould love to continue the conversation!\n\nCheers,\n{receiver}`,

            // Professional reply
            `Hi {sender_first},\n\nThank you for your email regarding {original_subject}. {response}\n\nLooking forward to your thoughts.\n\nBest regards,\n{receiver}`
        ];

        const responses = [
            "I'd be happy to discuss this further. When would be a good time to connect?",
            "This aligns with some work I've been doing recently. Would love to compare notes!",
            "Interesting approach! I've been exploring similar ideas and would value your perspective.",
            "Thanks for sharing! I've been working on something related and would appreciate your insights.",
            "Great timing! I was just looking into this area and would love to hear more about your approach.",
            "Fascinating! I've had similar thoughts about this topic and would enjoy exchanging ideas.",
            "Appreciate you reaching out! This is definitely an area I'm passionate about.",
            "Thanks for the thoughtful email! I'd be interested in learning more about your work."
        ];

        const template = this.getRandomItem(replyStyles);
        const response = this.getRandomItem(responses);

        const senderFirst = this.extractFirstName(originalEmail.senderName || '');
        const originalSubject = originalEmail.subject?.toLowerCase() || 'your email';

        const replyContent = template
            .replace(/{sender_first}/g, senderFirst)
            .replace(/{original_subject}/g, originalSubject)
            .replace(/{response}/g, response)
            .replace(/{receiver}/g, originalEmail.receiverName || '');

        return {
            reply_content: replyContent,
            provider: 'template'
        };
    }

    async generateReplyWithRetry(originalEmail, maxRetries = 2) {
        return this.generateReply(originalEmail);
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
        templateService.generateReplyWithRetry(originalEmail, maxRetries)
};