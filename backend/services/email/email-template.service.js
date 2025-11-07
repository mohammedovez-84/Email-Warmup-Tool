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
