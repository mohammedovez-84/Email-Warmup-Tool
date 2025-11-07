
const crypto = require('crypto');
const industryContexts = {
    // Technology (15)
    technology: {
        topics: ["AI implementation", "Cloud migration", "Cybersecurity", "DevOps", "Digital transformation", "IoT solutions", "Blockchain integration", "Machine learning", "Data analytics", "Software development", "IT infrastructure", "Automation", "Digital innovation", "Tech consulting", "SaaS solutions"],
        challenges: ["Technical debt", "Security threats", "Talent shortage", "Legacy systems", "Scalability issues", "Data privacy", "Integration complexity", "Budget constraints", "Rapid technology changes", "Digital skills gap"]
    },
    finance: {
        topics: ["Portfolio optimization", "Risk management", "Fintech innovation", "Wealth management", "Investment strategies", "Financial planning", "Digital banking", "Payment solutions", "Asset management", "Financial consulting"],
        challenges: ["Market volatility", "Regulatory compliance", "Digital transformation", "Cybersecurity risks", "Customer acquisition", "Competition from fintech", "Interest rate changes", "Economic uncertainty"]
    },
    healthcare: {
        topics: ["Telemedicine", "Data interoperability", "Patient engagement", "Medical devices", "Healthcare IT", "Clinical trials", "Pharmaceuticals", "Medical research", "Healthcare analytics", "Patient care"],
        challenges: ["Regulatory compliance", "Data security", "Cost management", "Staff shortages", "Technology adoption", "Patient privacy", "Insurance complexities", "Interoperability issues"]
    },
    education: {
        topics: ["EdTech solutions", "Online learning", "Curriculum development", "Student engagement", "Educational technology", "Learning management", "Professional development", "Educational consulting", "E-learning platforms", "Digital classrooms"],
        challenges: ["Digital divide", "Budget constraints", "Teacher training", "Technology integration", "Student retention", "Remote learning challenges", "Curriculum updates", "Assessment methods"]
    },
    real_estate: {
        topics: ["Property management", "Real estate technology", "Commercial real estate", "Residential sales", "Property investment", "Real estate marketing", "Construction management", "Facility management", "Real estate consulting", "Property development"],
        challenges: ["Market fluctuations", "Regulatory changes", "Property management", "Tenant acquisition", "Maintenance costs", "Competition", "Economic conditions", "Interest rates"]
    },
    retail: {
        topics: ["E-commerce", "Retail technology", "Customer experience", "Inventory management", "Supply chain", "Retail marketing", "Store operations", "Merchandising", "Retail analytics", "Omnichannel strategy"],
        challenges: ["Competition", "Supply chain disruptions", "Changing consumer behavior", "Inventory management", "Profit margins", "Digital transformation", "Customer retention", "Seasonal fluctuations"]
    },
    manufacturing: {
        topics: ["Industrial automation", "Supply chain optimization", "Quality control", "Production efficiency", "Lean manufacturing", "Industrial IoT", "Manufacturing technology", "Process improvement", "Equipment maintenance", "Operational excellence"],
        challenges: ["Supply chain disruptions", "Labor shortages", "Quality control", "Cost management", "Technology adoption", "Regulatory compliance", "Global competition", "Environmental regulations"]
    },
    marketing: {
        topics: ["Digital marketing", "Content strategy", "Social media marketing", "Brand development", "Marketing automation", "Customer acquisition", "Marketing analytics", "Influencer marketing", "SEO optimization", "Marketing consulting"],
        challenges: ["ROI measurement", "Changing algorithms", "Audience engagement", "Budget optimization", "Competition", "Data privacy", "Content creation", "Platform changes"]
    },
    consulting: {
        topics: ["Business strategy", "Management consulting", "Operational efficiency", "Organizational development", "Change management", "Strategic planning", "Business transformation", "Performance improvement", "Process optimization", "Executive advisory"],
        challenges: ["Client acquisition", "Talent retention", "Project delivery", "Competition", "Economic uncertainty", "Client expectations", "Scope creep", "Knowledge management"]
    },
    legal: {
        topics: ["Legal technology", "Contract management", "Compliance solutions", "Legal consulting", "Intellectual property", "Corporate law", "Legal research", "Document automation", "Legal operations", "Risk management"],
        challenges: ["Regulatory changes", "Client expectations", "Technology adoption", "Billing pressures", "Competition", "Data security", "Talent acquisition", "Process efficiency"]
    },

    // Additional Industries (90+)
    automotive: {
        topics: ["Electric vehicles", "Autonomous driving", "Automotive technology", "Supply chain management", "Manufacturing efficiency", "Vehicle design", "Automotive software", "Connected cars", "Aftermarket services", "Fleet management"],
        challenges: ["Supply chain disruptions", "Technology integration", "Regulatory compliance", "Consumer preferences", "Competition", "Sustainability requirements", "Cost pressures", "Skill gaps"]
    },
    energy: {
        topics: ["Renewable energy", "Energy efficiency", "Smart grid technology", "Oil and gas", "Energy storage", "Utility management", "Energy consulting", "Sustainability solutions", "Power generation", "Energy trading"],
        challenges: ["Regulatory changes", "Infrastructure investment", "Environmental concerns", "Price volatility", "Technology adoption", "Grid modernization", "Competition", "Supply chain issues"]
    },
    transportation: {
        topics: ["Logistics optimization", "Supply chain management", "Fleet operations", "Transportation technology", "Last-mile delivery", "Route optimization", "Freight management", "Transportation consulting", "Warehouse management", "Distribution networks"],
        challenges: ["Fuel costs", "Driver shortages", "Regulatory compliance", "Infrastructure limitations", "Competition", "Technology adoption", "Supply chain disruptions", "Environmental regulations"]
    },
    hospitality: {
        topics: ["Hotel management", "Tourism development", "Customer service excellence", "Revenue management", "Hospitality technology", "Event management", "Restaurant operations", "Travel services", "Hospitality consulting", "Guest experience"],
        challenges: ["Seasonal demand", "Labor shortages", "Competition", "Online reviews", "Economic fluctuations", "Technology integration", "Customer expectations", "Health and safety"]
    },
    insurance: {
        topics: ["Insurance technology", "Risk assessment", "Claims management", "Customer service", "Product development", "Insurance consulting", "Digital transformation", "Underwriting", "Policy management", "Insurance analytics"],
        challenges: ["Regulatory compliance", "Digital disruption", "Claims fraud", "Customer acquisition", "Competition", "Data security", "Climate risks", "Profitability pressures"]
    },
    telecommunications: {
        topics: ["5G technology", "Network infrastructure", "Telecom services", "Mobile solutions", "Broadband expansion", "Telecom consulting", "IoT connectivity", "Cloud communications", "Network security", "Digital services"],
        challenges: ["Infrastructure costs", "Regulatory compliance", "Competition", "Technology upgrades", "Customer retention", "Network security", "Spectrum allocation", "Service quality"]
    },
    construction: {
        topics: ["Construction management", "Project planning", "Building technology", "Sustainable construction", "Construction consulting", "Infrastructure development", "Safety management", "Cost estimation", "Quality control", "Contract management"],
        challenges: ["Project delays", "Cost overruns", "Labor shortages", "Regulatory compliance", "Safety concerns", "Supply chain issues", "Weather disruptions", "Competition"]
    },
    agriculture: {
        topics: ["Precision farming", "Agricultural technology", "Sustainable agriculture", "Crop management", "Livestock management", "Agricultural consulting", "Supply chain optimization", "Food safety", "Irrigation systems", "Farm management"],
        challenges: ["Climate change", "Water scarcity", "Price volatility", "Labor shortages", "Regulatory compliance", "Technology adoption", "Supply chain issues", "Market access"]
    },
    pharmaceuticals: {
        topics: ["Drug development", "Clinical research", "Regulatory affairs", "Pharmaceutical manufacturing", "Quality assurance", "Medical affairs", "Pharmacovigilance", "Market access", "Medical writing", "Clinical operations"],
        challenges: ["Regulatory hurdles", "R&D costs", "Patent expiration", "Market competition", "Supply chain complexity", "Quality control", "Clinical trial recruitment", "Pricing pressures"]
    },
    biotechnology: {
        topics: ["Biotech research", "Drug discovery", "Genetic engineering", "Biomanufacturing", "Bioinformatics", "Clinical development", "Regulatory strategy", "Biotech consulting", "Laboratory management", "Research collaboration"],
        challenges: ["Funding constraints", "Regulatory approval", "Intellectual property", "Talent acquisition", "R&D costs", "Market competition", "Technology transfer", "Clinical trial success"]
    },

    // More industries...
    media_entertainment: {
        topics: ["Content creation", "Digital media", "Streaming services", "Content distribution", "Media production", "Entertainment technology", "Audience engagement", "Media strategy", "Content marketing", "Broadcast operations"],
        challenges: ["Content piracy", "Changing consumption", "Revenue models", "Competition", "Technology changes", "Audience fragmentation", "Production costs", "Rights management"]
    },
    nonprofit: {
        topics: ["Fundraising strategies", "Program development", "Volunteer management", "Grant writing", "Nonprofit technology", "Community outreach", "Advocacy campaigns", "Strategic planning", "Donor relations", "Impact measurement"],
        challenges: ["Funding uncertainty", "Donor retention", "Volunteer recruitment", "Measuring impact", "Regulatory compliance", "Competition for funds", "Staff turnover", "Technology adoption"]
    },
    government: {
        topics: ["Public policy", "Government technology", "Citizen services", "Regulatory compliance", "Public administration", "Policy development", "Government consulting", "Digital government", "Public safety", "Infrastructure planning"],
        challenges: ["Budget constraints", "Regulatory complexity", "Technology adoption", "Public scrutiny", "Bureaucratic processes", "Cybersecurity threats", "Staff training", "Interagency coordination"]
    },
    aerospace: {
        topics: ["Aerospace engineering", "Aviation technology", "Space exploration", "Aircraft manufacturing", "Defense systems", "Aerospace consulting", "Aviation safety", "Satellite technology", "Aerospace materials", "Flight operations"],
        challenges: ["Regulatory compliance", "Safety requirements", "Technology innovation", "Global competition", "Supply chain complexity", "R&D costs", "Environmental regulations", "Skilled labor shortage"]
    },
    fashion: {
        topics: ["Fashion design", "Retail merchandising", "Brand development", "Sustainable fashion", "Fashion technology", "Supply chain management", "Fashion marketing", "E-commerce strategy", "Product development", "Fashion consulting"],
        challenges: ["Fast fashion competition", "Sustainability pressures", "Supply chain ethics", "Seasonal trends", "Inventory management", "Digital transformation", "Brand differentiation", "Consumer preferences"]
    },
    sports: {
        topics: ["Sports management", "Athlete development", "Sports technology", "Event management", "Sports marketing", "Facility management", "Sports analytics", "Sponsorship acquisition", "Team operations", "Sports consulting"],
        challenges: ["Revenue generation", "Fan engagement", "Player acquisition", "Competition", "Injury management", "Sponsorship retention", "Media rights", "Facility costs"]
    },
    food_beverage: {
        topics: ["Food production", "Beverage development", "Supply chain management", "Quality assurance", "Food safety", "Product innovation", "Restaurant management", "Food technology", "Distribution networks", "Menu development"],
        challenges: ["Food safety", "Supply chain disruptions", "Consumer preferences", "Regulatory compliance", "Competition", "Cost management", "Sustainability", "Talent retention"]
    },
    environmental: {
        topics: ["Environmental consulting", "Sustainability solutions", "Climate change", "Environmental compliance", "Renewable energy", "Waste management", "Environmental technology", "Conservation", "Environmental impact", "Green building"],
        challenges: ["Regulatory changes", "Funding limitations", "Public awareness", "Technology adoption", "Measurement challenges", "Stakeholder engagement", "Climate risks", "Competition"]
    },
    logistics: {
        topics: ["Supply chain optimization", "Warehouse management", "Transportation logistics", "Inventory control", "Logistics technology", "Distribution networks", "Freight management", "Last-mile delivery", "Logistics consulting", "Route optimization"],
        challenges: ["Fuel costs", "Driver shortages", "Capacity constraints", "Technology integration", "Regulatory compliance", "Customer expectations", "Global disruptions", "Competition"]
    },
    cybersecurity: {
        topics: ["Security consulting", "Threat intelligence", "Incident response", "Security architecture", "Vulnerability management", "Security operations", "Compliance auditing", "Risk assessment", "Security training", "Cloud security"],
        challenges: ["Evolving threats", "Talent shortage", "Budget constraints", "Compliance requirements", "Technology complexity", "Alert fatigue", "Third-party risks", "Skills gap"]
    },

    // Add 70+ more industries as needed...
    // [industry_name]: { topics: [], challenges: [] }
};

class AIService {
    constructor() {
        this.huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
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

            // 🎯 RANDOMLY SELECT EMAIL FORMAT (6 different formats)
            const formatSelector = Math.floor(Math.random() * 6);

            switch (formatSelector) {
                case 0:
                    return this.generateFormat1(senderName, receiverName, industry, topic, challenge);
                case 1:
                    return this.generateFormat2(senderName, receiverName, industry, topic, challenge);
                case 2:
                    return this.generateFormat3(senderName, receiverName, industry, topic, challenge);
                case 3:
                    return this.generateFormat4(senderName, receiverName, industry, topic, challenge);
                case 4:
                    return this.generateFormat5(senderName, receiverName, industry, topic, challenge);
                case 5:
                    return this.generateFormat6(senderName, receiverName, industry, topic, challenge);
                default:
                    return this.generateFormat1(senderName, receiverName, industry, topic, challenge);
            }

        } catch (error) {
            console.log('Email generation failed, using default template');
            return this.generateFormat1(senderName, receiverName, industry);
        }
    }

    // 🎯 FORMAT 1: Professional Introduction
    generateFormat1(senderName, receiverName, industry, topic, challenge) {
        const subjects = [
            "Exploring Potential Collaboration",
            "Connecting on Business Opportunities",
            "Introduction and Partnership Discussion",
            "Opportunity for Collaboration",
            "Exploring Synergies"
        ];

        return {
            subject: subjects[Math.floor(Math.random() * subjects.length)],
            content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 550px; margin: 0 auto; padding: 15px; }
.paragraph { margin-bottom: 14px; }
.signature { margin-top: 18px; border-top: 1px solid #eee; padding-top: 15px; }
</style>
</head>
<body>
<div class="paragraph">Hello ${receiverName},</div>

<div class="paragraph">Hope you're having a productive week.</div>

<div class="paragraph">I'm ${senderName} from our outreach team. We help businesses connect with key decision-makers through strategic engagement.</div>

<div class="paragraph">Given your expertise in ${topic}, I wanted to explore potential collaboration around ${challenge}.</div>

<div class="paragraph">Would you be open to a brief 15-minute call next week?</div>

<div class="signature">
Best regards,<br>
<strong>${senderName}</strong><br>
<small>${this.generateHashCode()}</small>
</div>
</body>
</html>`,
            provider: 'template-format1',
            format: 'html',
            hashCode: this.generateHashCode()
        };
    }

    // 🎯 FORMAT 2: Value-Focused Approach
    generateFormat2(senderName, receiverName, industry, topic, challenge) {
        return {
            subject: "Value Creation Opportunity",
            content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.5; color: #2c3e50; max-width: 540px; margin: 0 auto; padding: 18px; background: #f8f9fa; }
.paragraph { margin-bottom: 16px; padding: 8px 0; }
.highlight { background: #e8f4fd; padding: 12px; border-left: 4px solid #3498db; margin: 15px 0; }
.signature { margin-top: 20px; color: #7f8c8d; }
</style>
</head>
<body>
<div class="paragraph">Hi ${receiverName},</div>

<div class="paragraph">I came across your work in ${topic} and was impressed by your approach.</div>

<div class="highlight">We specialize in helping companies address ${challenge} through targeted outreach strategies.</div>

<div class="paragraph">Our team has helped businesses improve engagement rates by focusing on meaningful connections.</div>

<div class="paragraph">Would you have 20 minutes to discuss potential synergies?</div>

<div class="signature">
Cheers,<br>
${senderName}<br>
<small>${this.generateHashCode()}</small>
</div>
</body>
</html>`,
            provider: 'template-format2',
            format: 'html',
            hashCode: this.generateHashCode()
        };
    }

    // 🎯 FORMAT 3: Direct and Concise
    generateFormat3(senderName, receiverName, industry, topic, challenge) {
        return {
            subject: "Quick Connect",
            content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.4; color: #1a1a1a; max-width: 520px; margin: 0 auto; padding: 20px; }
.paragraph { margin-bottom: 12px; }
.bullet { margin: 8px 0; padding-left: 15px; }
.signature { margin-top: 15px; font-size: 14px; }
</style>
</head>
<body>
<div class="paragraph">${receiverName} -</div>

<div class="paragraph">Quick introduction: I'm ${senderName}. Our team focuses on ${topic} and helping businesses overcome ${challenge}.</div>

<div class="bullet">• Strategic outreach planning</div>
<div class="bullet">• Decision-maker engagement</div>
<div class="bullet">• Measurable results</div>

<div class="paragraph">Open to a quick chat about collaboration possibilities?</div>

<div class="signature">
— ${senderName}<br>
<small>${this.generateHashCode()}</small>
</div>
</body>
</html>`,
            provider: 'template-format3',
            format: 'html',
            hashCode: this.generateHashCode()
        };
    }

    // 🎯 FORMAT 4: Problem-Solution Focused
    generateFormat4(senderName, receiverName, industry, topic, challenge) {
        return {
            subject: `Re: ${challenge} Solutions`,
            content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: Georgia, serif; line-height: 1.5; color: #2c3e50; max-width: 560px; margin: 0 auto; padding: 25px; }
.paragraph { margin-bottom: 18px; }
.quote { border-left: 3px solid #bdc3c7; padding-left: 15px; margin: 20px 0; color: #7f8c8d; }
.signature { margin-top: 25px; font-style: italic; }
</style>
</head>
<body>
<div class="paragraph">Dear ${receiverName},</div>

<div class="paragraph">I hope this message finds you well.</div>

<div class="paragraph">In your work with ${topic}, you've likely encountered challenges around ${challenge}.</div>

<div class="quote">Many organizations struggle with this, yet few have effective strategies to address it systematically.</div>

<div class="paragraph">Our approach has helped companies navigate these challenges through focused engagement and strategic partnerships.</div>

<div class="paragraph">Might you have time for a brief discussion next week?</div>

<div class="signature">
Sincerely,<br>
${senderName}<br>
<small>${this.generateHashCode()}</small>
</div>
</body>
</html>`,
            provider: 'template-format4',
            format: 'html',
            hashCode: this.generateHashCode()
        };
    }

    // 🎯 FORMAT 5: Modern Business Approach
    generateFormat5(senderName, receiverName, industry, topic, challenge) {
        return {
            subject: "Business Growth Discussion",
            content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: 'Inter', sans-serif; line-height: 1.5; color: #374151; max-width: 530px; margin: 0 auto; padding: 22px; background: white; }
.paragraph { margin-bottom: 16px; }
.cta { background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
.signature { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
</style>
</head>
<body>
<div class="paragraph">👋 Hi ${receiverName},</div>

<div class="paragraph">Noticed your work in ${topic} - impressive stuff!</div>

<div class="paragraph">At our firm, we help businesses tackle ${challenge} through data-driven outreach and strategic partnerships.</div>

<div class="paragraph">The results speak for themselves: better engagement, stronger connections, measurable growth.</div>

<div class="paragraph">Worth a 15-minute chat to explore possibilities?</div>

<div class="signature">
Best,<br>
${senderName}<br>
<small style="color: #6b7280;">${this.generateHashCode()}</small>
</div>
</body>
</html>`,
            provider: 'template-format5',
            format: 'html',
            hashCode: this.generateHashCode()
        };
    }

    // 🎯 FORMAT 6: Professional Network Building
    generateFormat6(senderName, receiverName, industry, topic, challenge) {
        return {
            subject: "Professional Connection",
            content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #2d3748; max-width: 545px; margin: 0 auto; padding: 24px; }
.paragraph { margin-bottom: 18px; }
.network { background: #f0fff4; padding: 15px; border-radius: 8px; margin: 18px 0; }
.signature { margin-top: 22px; color: #4a5568; }
</style>
</head>
<body>
<div class="paragraph">Hello ${receiverName},</div>

<div class="paragraph">I'm reaching out because of our shared interest in ${topic}.</div>

<div class="network">
<strong>Common ground:</strong> We both understand the complexities of ${challenge} in today's business environment.
</div>

<div class="paragraph">My team specializes in creating meaningful business connections that drive results.</div>

<div class="paragraph">Would you be open to connecting and exploring how we might collaborate?</div>

<div class="signature">
Warm regards,<br>
${senderName}<br>
<small>${this.generateHashCode()}</small>
</div>
</body>
</html>`,
            provider: 'template-format6',
            format: 'html',
            hashCode: this.generateHashCode()
        };
    }

    async generateWithAI(prompt) {
        // 🚨 IMMEDIATE TEMPLATE FALLBACK - HuggingFace API is unreliable
        console.log('🤖 Using template system (AI API deprecated)');
        return null;
    }

    async generateReply(originalEmail) {
        const replyFormats = [
            // Format 1: Professional acceptance
            `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; line-height: 1.5; max-width: 550px; margin: 0 auto; padding: 15px;">
<div>Thanks for reaching out. Your approach sounds interesting.</div>
<div>I'd be open to learning more about your process.</div>
<div>How about we schedule a quick call next week?</div>
<div style="margin-top: 15px;">Best,<br>Team</div>
<small>${this.generateHashCode()}</small>
</body></html>`,

            // Format 2: Interested but busy
            `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; line-height: 1.4; max-width: 530px; margin: 0 auto; padding: 18px;">
<div>Appreciate you connecting. Currently quite busy but interested in your work.</div>
<div>Could you share more details about your approach?</div>
<div>Might have availability in a couple of weeks.</div>
<div style="margin-top: 15px;">Thanks,<br>Team</div>
<small>${this.generateHashCode()}</small>
</body></html>`,

            // Format 3: Quick response
            `<!DOCTYPE html><html><body style="font-family: Georgia, serif; line-height: 1.5; max-width: 540px; margin: 0 auto; padding: 20px;">
<div>Thank you for your message.</div>
<div>Your team's focus on meaningful connections aligns with our values.</div>
<div>Yes, let's find time to discuss further.</div>
<div style="margin-top: 15px;">Sincerely,<br>Team</div>
<small>${this.generateHashCode()}</small>
</body></html>`
        ];

        return {
            reply_content: replyFormats[Math.floor(Math.random() * replyFormats.length)],
            provider: 'template-reply',
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

    generateHashCode: () => new AIService().generateHashCode(),

    // Export industries for use in other parts of the system
    industryContexts
};