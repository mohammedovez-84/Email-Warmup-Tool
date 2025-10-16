


// const axios = require("axios");
// const API_BASE = "http://localhost:8000/api"; // your FastAPI URL
// async function generateEmail(senderName, receiverName, industry) {
//     try {
//         const res = await axios.post("http://localhost:8000/api/generate-email", {
//             sender_name: senderName,
//             receiver_name: receiverName,
//             industry: industry
//         }, {
//             headers: { "Content-Type": "application/json" }
//         });

//         return res.data;
//     } catch (err) {
//         console.error("generateEmail error:", err.response?.data || err.message);
//         return null;
//     }
// }

// async function generateReply(emailId) {
//     try {
//         const res = await axios.post("http://localhost:8000/api/reply-email", {
//             email_id: emailId
//         }, {
//             headers: { "Content-Type": "application/json" }
//         });

//         return res.data;
//     } catch (err) {
//         console.error("generateReply error:", err.response?.data || err.message);
//         return null;
//     }
// }

// module.exports = { generateEmail, generateReply };


const OpenAI = require("openai")
const dotenv = require("dotenv")
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


async function generateEmail(senderName, receiverName, industry) {
    const prompt = `
  Generate a professional warmup email from ${senderName} to ${receiverName}
  for the ${industry} industry. Return JSON with "subject" and "content".
  Keep it warm and friendly.
  `;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a professional email marketing expert." },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
        });

        const content = completion.choices[0].message.content;
        const jsonStart = content.indexOf("{");
        const jsonEnd = content.lastIndexOf("}") + 1;

        let subject = `Let's connect - ${industry} insights`;
        let body = `Hi ${receiverName}, connecting with ${industry} pros...`;

        if (jsonStart !== -1 && jsonEnd !== 0) {
            const parsed = JSON.parse(content.slice(jsonStart, jsonEnd));
            subject = parsed.subject || subject;
            body = parsed.content || body;
        }

        return { subject, content: body };
    } catch (err) {
        console.error("OpenAI Error:", err.message);
        return {
            subject: `Let's connect - ${industry} insights`,
            content: `Hi ${receiverName}, connecting with ${industry} pros...`,
        };
    }
}


async function generateReply(originalEmail) {

    console.log("original email: ", originalEmail);

    const prompt = `
  Reply professionally to the following email:
  ${originalEmail.content}

  From: ${originalEmail.sender_name} → ${originalEmail.receiver_name}
  Industry: ${originalEmail.industry}

  Keep it warm, friendly, and concise.
  `;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a professional email assistant." },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
        });

        const reply = completion.choices[0].message.content;
        return reply;
    } catch (err) {
        console.error("OpenAI Reply Error:", err.message);
        return "Thanks for your email! Looking forward to connecting soon.";
    }
}


module.exports = { generateEmail, generateReply }