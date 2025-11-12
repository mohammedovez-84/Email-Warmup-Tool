const axios = require("axios");

const PYTHON_API = process.env.PYTHON_API_URL || "http://localhost:8000";

// === 1. Generate a new warmup email ===
async function generateEmail(fromEmail, toEmail) {
    try {
        console.log(`📧 Generating email from ${fromEmail} to ${toEmail}`);

        const response = await axios.get(`${PYTHON_API}/generate-email`, {
            params: { sender_email: fromEmail, receiver_email: toEmail },
            timeout: 60000, // ⬅ Increased timeout to 60 seconds
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.data?.subject || !response.data?.body_html) {
            console.error("❌ Invalid response from Python API:", response.data);
            throw new Error("Invalid response from email generator");
        }

        const { subject, body_html } = response.data;
        console.log(`✅ Email generated: ${subject}`);
        return { subject, body: body_html };
    } catch (err) {
        console.error("❌ Error generating email from Python:", err.message);
        return generateFallbackEmail(fromEmail, toEmail);
    }
}

// === 2. Generate a reply ===
async function generateReply(originalEmail, replierEmail, originalSenderEmail) {
    try {
        console.log(`📧 Generating reply from ${replierEmail} to ${originalSenderEmail}`);

        const response = await axios.post(`${PYTHON_API}/generate-reply`, {
            original_email: originalEmail,
            replier_email: replierEmail,
            original_sender_email: originalSenderEmail,
        }, {
            timeout: 60000, // ⬅ Increased timeout to 60 seconds
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.data?.subject || !response.data?.body_html) {
            console.error("❌ Invalid response from Python API:", response.data);
            throw new Error("Invalid response from reply generator");
        }

        const { subject, body_html } = response.data;
        console.log(`✅ Reply generated: ${subject}`);
        return { subject, body: body_html };
    } catch (err) {
        console.error("❌ Error generating reply from Python:", err.message);
        return generateFallbackReply(replierEmail, originalSenderEmail);
    }
}

// === 3. Fallback email generation (Styled, clean format) ===
function generateFallbackEmail(fromEmail, toEmail) {
    const subjects = [
        "Exploring collaboration opportunities",
        "Professional connection",
        "Following up on industry developments"
    ];

    const fromName = extractNameFromEmail(fromEmail);
    const toName = extractNameFromEmail(toEmail);
    const domain = fromEmail.split('@')[1] || 'company.com';

    const body = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {
    font-family: "Segoe UI", Arial, sans-serif;
    line-height: 1.7;
    color: #222;
    max-width: 620px;
    margin: 0 auto;
    padding: 22px;
}
.paragraph { margin-bottom: 18px; }
.signature { margin-top: 28px; color: #444; }
</style>
</head>
<body>

<p>Hey 👋</p>

<p>I hope everything is going well for you.</p>

<p>Hi ${toName}, my name is ${fromName} and I'm reaching out to introduce you to our efficient email marketing software. Our tool has helped thousands of busy professionals like yourself save time and boost productivity. I'd love to schedule a short call to discuss how our software can benefit your business.</p>

<p>Have a splendid day!</p>

<p class="signature">Cheers,<br><strong>${fromName}</strong><br>${domain}<br><br>${generateRandomToken()}</p>

</body>
</html>
`;

    return {
        subject: subjects[Math.floor(Math.random() * subjects.length)],
        body: body
    };
}

// === 4. Fallback reply generation ===
function generateFallbackReply(replierEmail, originalSenderEmail) {
    const replierName = extractNameFromEmail(replierEmail);
    const senderName = extractNameFromEmail(originalSenderEmail);
    const domain = replierEmail.split('@')[1] || 'company.com';

    const body = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {
    font-family: "Segoe UI", Arial, sans-serif;
    line-height: 1.7;
    color: #222;
    max-width: 620px;
    margin: 0 auto;
    padding: 22px;
}
.paragraph { margin-bottom: 18px; }
.signature { margin-top: 28px; color: #444; }
</style>
</head>
<body>

<p>Hi ${senderName},</p>

<p>Thank you for your message. I appreciate you reaching out and will review the information you've shared.</p>

<p>I'll get back to you with a more detailed response soon.</p>

<p class="signature">Best regards,<br><strong>${replierName}</strong><br>${domain}</p>

</body>
</html>
`;

    return {
        subject: "Re: Your message",
        body: body
    };
}

// === 5. Helper function to extract name from email ===
function extractNameFromEmail(email) {
    if (!email || !email.includes('@')) return 'Valued Contact';

    const localPart = email.split('@')[0];
    const cleanName = localPart.replace(/[0-9._-]/g, ' ');
    const parts = cleanName.split(' ').filter(p => p.length > 1);

    if (parts.length > 0) {
        return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    const fallback = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan'];
    return fallback[Math.floor(Math.random() * fallback.length)];
}

// === 6. Random unique footer code ===
function generateRandomToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

module.exports = { generateEmail, generateReply };
